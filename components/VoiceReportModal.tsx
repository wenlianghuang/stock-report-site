"use client";

import { useEffect, useRef, useState } from "react";
import { isBrowserSpeechSupported, listenOnce } from "@/lib/browser-speech";
import type { VoiceReportFields } from "@/lib/voice-parse";

export type VoicePreviewPayload = {
  text: string;
  fields: VoiceReportFields;
  warnings: string[];
  canConfirm: boolean;
  engine?: string;
};

type VoiceEngine = "whisper" | "browser";

type Props = {
  open: boolean;
  disabled?: boolean;
  onClose: () => void;
  onConfirm: (fields: VoiceReportFields) => void;
};

type RecState = "idle" | "recording" | "uploading";
type Step = "speak" | "confirm";

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

function draftReady(fields: VoiceReportFields): boolean {
  if (!/^\d{4,6}$/.test(fields.stockId.trim())) return false;
  if (!fields.isHolding) return true;
  const shares = Number(fields.shareCount);
  const cost = Number(fields.avgCost);
  return (
    Number.isFinite(shares) &&
    shares > 0 &&
    Number.isInteger(shares) &&
    Number.isFinite(cost) &&
    cost > 0
  );
}

async function applyParsedText(text: string): Promise<VoicePreviewPayload> {
  const response = await fetch("/api/voice/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const payload = (await response.json()) as VoicePreviewPayload & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error ?? "解析失敗");
  }
  return payload;
}

export function VoiceReportModal({
  open,
  disabled,
  onClose,
  onConfirm,
}: Props) {
  const [engine, setEngine] = useState<VoiceEngine>("browser");
  const [engineLabel, setEngineLabel] = useState("");
  const [recState, setRecState] = useState<RecState>("idle");
  const [step, setStep] = useState<Step>("speak");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<VoicePreviewPayload | null>(null);
  const [draft, setDraft] = useState<VoiceReportFields | null>(null);
  const [liveTranscript, setLiveTranscript] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  function resetSession() {
    setRecState("idle");
    setStep("speak");
    setError("");
    setPreview(null);
    setDraft(null);
    setLiveTranscript("");
    chunksRef.current = [];
  }

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (!open) {
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      mediaRecorderRef.current = null;
      resetSession();
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/voice/config", { cache: "no-store" });
        if (!response.ok) {
          setEngine(isBrowserSpeechSupported() ? "browser" : "whisper");
          return;
        }
        const data = (await response.json()) as {
          engine?: VoiceEngine;
          label?: string;
        };
        if (cancelled) return;
        if (data.engine === "whisper") {
          setEngine("whisper");
        } else {
          setEngine(isBrowserSpeechSupported() ? "browser" : "whisper");
        }
        setEngineLabel(data.label ?? "");
      } catch {
        if (!cancelled) {
          setEngine(isBrowserSpeechSupported() ? "browser" : "whisper");
        }
      }
    })();

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && recState !== "recording") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose, recState]);

  function stopTracks() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function showPreview(payload: VoicePreviewPayload) {
    setPreview({
      text: payload.text,
      fields: payload.fields,
      warnings: payload.warnings ?? [],
      canConfirm: payload.canConfirm,
      engine: payload.engine,
    });
    setDraft({ ...payload.fields });
    setStep("confirm");
  }

  async function startBrowserListening() {
    setError("");
    setPreview(null);
    setDraft(null);
    setLiveTranscript("");
    setStep("speak");
    setRecState("recording");

    try {
      const text = await listenOnce();
      setLiveTranscript(text);
      setRecState("uploading");
      const payload = await applyParsedText(text);
      showPreview(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "語音辨識失敗");
    } finally {
      setRecState("idle");
    }
  }

  async function startWhisperRecording() {
    setError("");
    setPreview(null);
    setDraft(null);
    setStep("speak");

    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("此瀏覽器不支援麥克風錄音");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        void uploadRecording(recorder.mimeType || mimeType || "audio/webm");
      };

      recorder.start();
      setRecState("recording");
    } catch {
      stopTracks();
      setError("無法開啟麥克風，請檢查瀏覽器權限");
      setRecState("idle");
    }
  }

  async function startRecording() {
    if (engine === "browser") {
      await startBrowserListening();
      return;
    }
    await startWhisperRecording();
  }

  function stopRecording() {
    if (engine === "browser") {
      // browser path auto-stops; button hidden in browser mode
      return;
    }
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      stopTracks();
      setRecState("idle");
      return;
    }
    recorder.stop();
    setRecState("uploading");
  }

  async function uploadRecording(mimeType: string) {
    const blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];
    stopTracks();
    mediaRecorderRef.current = null;

    if (blob.size < 200) {
      setError("錄音太短，請再試一次");
      setRecState("idle");
      return;
    }

    const form = new FormData();
    const ext = mimeType.includes("mp4")
      ? "m4a"
      : mimeType.includes("ogg")
        ? "ogg"
        : "webm";
    form.append("audio", blob, `voice.${ext}`);

    try {
      const response = await fetch("/api/voice/transcribe", {
        method: "POST",
        body: form,
      });
      const payload = (await response.json()) as VoicePreviewPayload & {
        error?: string;
        useBrowser?: boolean;
      };

      if (!response.ok) {
        if (payload.useBrowser && isBrowserSpeechSupported()) {
          setEngine("browser");
          setEngineLabel("瀏覽器語音辨識");
          setError("伺服器辨識不可用，已改為瀏覽器語音。請再按一次開始。");
          setRecState("idle");
          return;
        }
        setError(payload.error ?? "語音辨識失敗");
        setRecState("idle");
        return;
      }

      showPreview(payload);
    } catch {
      setError("網路錯誤，請稍後再試");
    } finally {
      setRecState("idle");
    }
  }

  function updateDraft<K extends keyof VoiceReportFields>(
    key: K,
    value: VoiceReportFields[K],
  ) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function handleRetry() {
    resetSession();
  }

  if (!open) return null;

  const busy = disabled || recState === "uploading";
  const isBrowserMode = engine === "browser";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-modal-title"
      onClick={recState === "recording" ? undefined : onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="voice-modal-title" className="text-base font-semibold">
              語音填寫
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              請口述股號與持股資訊，辨識後請確認是否正確。
              {engineLabel ? (
                <span className="mt-0.5 block text-zinc-400">
                  辨識引擎：{engineLabel}
                </span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={recState === "recording"}
            className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800"
            aria-label="關閉"
          >
            ✕
          </button>
        </div>

        {step === "speak" ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              <p className="font-medium text-zinc-900 dark:text-zinc-100">
                您正在使用語音模式
              </p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                範例：「分析二三零三，持股兩千股，均價五十」或「幫我看聯電，沒有持股」
              </p>
              {isBrowserMode ? (
                <p className="mt-2 text-xs text-zinc-500">
                  正式網站使用瀏覽器內建語音辨識，無需本機 STT 服務。
                </p>
              ) : null}
            </div>

            {recState === "recording" ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                </span>
                <p className="text-sm font-medium text-red-600">
                  {isBrowserMode ? "請開始說話…" : "錄音中…"}
                </p>
                {!isBrowserMode ? (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-white hover:bg-red-500"
                  >
                    說完了，停止辨識
                  </button>
                ) : null}
                {liveTranscript ? (
                  <p className="text-center text-xs text-zinc-500">{liveTranscript}</p>
                ) : null}
              </div>
            ) : recState === "uploading" ? (
              <p className="py-6 text-center text-sm text-zinc-500">辨識中…</p>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void startRecording()}
                className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {isBrowserMode ? "開始說話" : "開始錄音"}
              </button>
            )}

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
        ) : null}

        {step === "confirm" && preview && draft ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-zinc-500">辨識文字</p>
              <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">
                {preview.text || "（空白）"}
              </p>
            </div>

            {preview.warnings.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-xs text-amber-700 dark:text-amber-400">
                {preview.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}

            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
              <p className="mb-3 text-xs font-medium text-zinc-500">
                以下內容是否正確？
              </p>
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">股號</dt>
                  <dd>
                    <input
                      value={draft.stockId}
                      onChange={(e) => updateDraft("stockId", e.target.value)}
                      className="w-24 rounded border border-zinc-300 bg-white px-2 py-1 text-right text-sm dark:border-zinc-600 dark:bg-black"
                    />
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">有持股</dt>
                  <dd>
                    <input
                      type="checkbox"
                      checked={draft.isHolding}
                      onChange={(e) =>
                        updateDraft("isHolding", e.target.checked)
                      }
                      className="h-4 w-4"
                    />
                  </dd>
                </div>
                {draft.isHolding ? (
                  <>
                    <div className="flex justify-between gap-4">
                      <dt className="text-zinc-500">持股股數</dt>
                      <dd>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={draft.shareCount}
                          onChange={(e) =>
                            updateDraft("shareCount", e.target.value)
                          }
                          className="w-28 rounded border border-zinc-300 bg-white px-2 py-1 text-right text-sm dark:border-zinc-600 dark:bg-black"
                        />
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-zinc-500">持股均價</dt>
                      <dd>
                        <input
                          type="number"
                          min={0.01}
                          step={0.01}
                          value={draft.avgCost}
                          onChange={(e) =>
                            updateDraft("avgCost", e.target.value)
                          }
                          className="w-28 rounded border border-zinc-300 bg-white px-2 py-1 text-right text-sm dark:border-zinc-600 dark:bg-black"
                        />
                      </dd>
                    </div>
                  </>
                ) : null}
              </dl>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!draftReady(draft) || disabled}
                onClick={() => onConfirm(draft)}
                className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
              >
                正確，填入表單
              </button>
              <button
                type="button"
                onClick={handleRetry}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                重新錄音
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
