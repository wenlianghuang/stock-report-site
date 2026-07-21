import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { parseVoiceReportCommand } from "@/lib/voice-parse";
import { resolveVoiceStockId } from "@/lib/tw-stock-registry";
import { toTraditionalChinese } from "@/lib/zh-convert";
import { collapseRepeatedSpeechFragments } from "@/lib/speech-cleanup";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { text?: string };
  const rawText = body.text?.trim() ?? "";
  if (!rawText) {
    return NextResponse.json({ error: "請提供辨識文字" }, { status: 400 });
  }

  // Whisper / mixed STT may be Simplified; show & match in Traditional.
  const text = collapseRepeatedSpeechFragments(toTraditionalChinese(rawText));
  const parsed = parseVoiceReportCommand(text);
  const { stockId, stockName } = await resolveVoiceStockId(
    text,
    parsed.fields.stockId,
  );
  const warnings = parsed.warnings.filter(
    (w) => !(stockId && w.includes("聽不到清楚的股號")),
  );
  if (!stockId && !warnings.some((w) => w.includes("股號"))) {
    warnings.push("聽不到清楚的股號，請手動確認或改口說四碼代號");
  }

  return NextResponse.json({
    text,
    fields: {
      ...parsed.fields,
      stockId,
    },
    stockName,
    warnings,
    canConfirm: /^\d{4,6}$/.test(stockId),
    engine: "browser",
  });
}
