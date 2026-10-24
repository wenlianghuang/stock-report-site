import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isValidStockId, isValidTradeDate } from "@/lib/validate";
import { checkAgentHealth, getConceptGroupBrief } from "@/lib/agent-client";

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const url = new URL(request.url);
  const tradeDate = url.searchParams.get("date")?.trim() ?? "";
  const stockIds = (url.searchParams.get("ids") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const heldIds = (url.searchParams.get("held") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (tradeDate && !isValidTradeDate(tradeDate)) {
    return NextResponse.json({ error: "交易日期格式須為 YYYY-MM-DD" }, { status: 400 });
  }
  if (stockIds.some((stockId) => !isValidStockId(stockId))) {
    return NextResponse.json({ error: "代號須為 4～6 位數" }, { status: 400 });
  }
  if (heldIds.some((stockId) => !isValidStockId(stockId))) {
    return NextResponse.json({ error: "持股代號須為 4～6 位數" }, { status: 400 });
  }
  if (stockIds.length < 2) {
    return NextResponse.json({ error: "至少勾選兩檔" }, { status: 400 });
  }
  if (stockIds.length > 12) {
    return NextResponse.json({ error: "一次對照最多 12 檔" }, { status: 400 });
  }

  const healthy = await checkAgentHealth();
  if (!healthy) {
    return NextResponse.json(
      { error: "Stock API 未啟動。請先啟動 stock-winning-rate API（:8765）。" },
      { status: 503 },
    );
  }

  try {
    const brief = await getConceptGroupBrief({
      stockIds,
      heldIds,
      tradeDate: tradeDate || undefined,
    });
    return NextResponse.json({ brief });
  } catch (error) {
    const message = error instanceof Error ? error.message : "無法產生這一小群對照";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
