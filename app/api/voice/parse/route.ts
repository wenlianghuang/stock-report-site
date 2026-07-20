import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { companyNameByStockId, parseVoiceReportCommand } from "@/lib/voice-parse";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { text?: string };
  const text = body.text?.trim() ?? "";
  if (!text) {
    return NextResponse.json({ error: "請提供辨識文字" }, { status: 400 });
  }

  const parsed = parseVoiceReportCommand(text);
  return NextResponse.json({
    text,
    fields: parsed.fields,
    stockName: companyNameByStockId(parsed.fields.stockId),
    warnings: parsed.warnings,
    canConfirm: parsed.canConfirm,
    engine: "browser",
  });
}
