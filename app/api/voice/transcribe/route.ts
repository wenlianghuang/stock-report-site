import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { parseVoiceReportCommand } from "@/lib/voice-parse";

const DEFAULT_STT_URL = "http://127.0.0.1:8787";

function sttBaseUrl(): string {
  return process.env.STT_API_URL?.trim() || DEFAULT_STT_URL;
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "無法讀取上傳內容" }, { status: 400 });
  }

  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json(
      { error: "請上傳音訊（欄位 audio）" },
      { status: 400 },
    );
  }

  const upstream = new FormData();
  upstream.append(
    "audio",
    audio,
    audio.name || `recording.${guessExt(audio.type)}`,
  );

  const base = sttBaseUrl();
  let sttResponse: Response;
  try {
    sttResponse = await fetch(`${base}/transcribe`, {
      method: "POST",
      body: upstream,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      {
        error: `STT 服務連不上（${base}）。請在 stt 目錄執行：make serve`,
      },
      { status: 503 },
    );
  }

  const sttPayload = (await sttResponse.json().catch(() => ({}))) as {
    text?: string;
    error?: string;
    duration_sec?: number;
    elapsed_ms?: number;
  };

  if (!sttResponse.ok) {
    return NextResponse.json(
      { error: sttPayload.error ?? "語音辨識失敗" },
      { status: sttResponse.status >= 400 ? sttResponse.status : 502 },
    );
  }

  const text = (sttPayload.text ?? "").trim();
  const parsed = parseVoiceReportCommand(text);

  return NextResponse.json({
    text,
    durationSec: sttPayload.duration_sec,
    elapsedMs: sttPayload.elapsed_ms,
    fields: parsed.fields,
    warnings: parsed.warnings,
    canConfirm: parsed.canConfirm,
  });
}

function guessExt(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  return "webm";
}
