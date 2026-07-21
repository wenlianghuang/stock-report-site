import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { parseVoiceReportCommand } from "@/lib/voice-parse";
import { resolveVoiceEngine, whisperSttUrl } from "@/lib/voice-config";
import { resolveVoiceStockId } from "@/lib/tw-stock-registry";
import { toTraditionalChinese } from "@/lib/zh-convert";
import { collapseRepeatedSpeechFragments } from "@/lib/speech-cleanup";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  if (resolveVoiceEngine() !== "whisper") {
    return NextResponse.json(
      {
        error: "伺服器未設定 Whisper STT，請改用瀏覽器語音辨識",
        useBrowser: true,
      },
      { status: 503 },
    );
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

  const base = whisperSttUrl();
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
        error: `STT 服務連不上（${base}）`,
        useBrowser: true,
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
      {
        error: sttPayload.error ?? "語音辨識失敗",
        useBrowser: true,
      },
      { status: sttResponse.status >= 400 ? sttResponse.status : 502 },
    );
  }

  const rawText = (sttPayload.text ?? "").trim();
  // Whisper `zh` often emits Simplified; match/display as Traditional.
  const text = collapseRepeatedSpeechFragments(toTraditionalChinese(rawText));
  const parsed = parseVoiceReportCommand(text);
  const { stockId, stockName, nameHint, fuzzyCandidates } =
    await resolveVoiceStockId(text, parsed.fields.stockId);
  const warnings = parsed.warnings.filter(
    (w) => !(stockId && (w.includes("股號") || w.includes("股票"))),
  );
  if (!stockId && !warnings.some((w) => w.includes("股號") || w.includes("股票"))) {
    warnings.push(
      fuzzyCandidates.length > 0
        ? "找到相近公司名稱，請從下方選取確認"
        : "找不到對應的股票，請手動輸入股號或搜尋公司名稱",
    );
  }

  return NextResponse.json({
    text,
    durationSec: sttPayload.duration_sec,
    elapsedMs: sttPayload.elapsed_ms,
    fields: {
      ...parsed.fields,
      stockId,
    },
    stockName,
    nameHint,
    fuzzyCandidates,
    warnings,
    canConfirm: /^\d{4,6}$/.test(stockId),
    engine: "whisper",
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
