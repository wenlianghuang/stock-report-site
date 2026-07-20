import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { parseVoiceReportCommand } from "@/lib/voice-parse";
import {
  resolveStockIdFromText,
  resolveStockNameById,
} from "@/lib/tw-stock-registry";
import { toTraditionalChinese } from "@/lib/zh-convert";

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
  const text = toTraditionalChinese(rawText);
  const parsed = parseVoiceReportCommand(text);
  let stockId = parsed.fields.stockId;
  if (!stockId) {
    stockId = (await resolveStockIdFromText(text)) ?? "";
  }
  const stockName = stockId ? await resolveStockNameById(stockId) : null;
  return NextResponse.json({
    text,
    fields: {
      ...parsed.fields,
      stockId,
    },
    stockName,
    warnings: parsed.warnings,
    canConfirm: /^\d{4,6}$/.test(stockId),
    engine: "browser",
  });
}
