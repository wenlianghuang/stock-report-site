import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listHoldingsForUser } from "@/lib/db";
import { isValidStockId, isValidTradeDate } from "@/lib/validate";
import { checkAgentHealth, getTriage } from "@/lib/agent-client";

/** fetch=true may pull several CSVs from FinMind before ranking. */
export const maxDuration = 180;

const MAX_STOCKS = 60;

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const url = new URL(request.url);
  const tradeDate = url.searchParams.get("date")?.trim() ?? "";
  const fetchMissing = url.searchParams.get("fetch") === "true";
  const topKRaw = Number(url.searchParams.get("topK") ?? "3");
  const requested = (url.searchParams.get("ids") ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (tradeDate && !isValidTradeDate(tradeDate)) {
    return NextResponse.json({ error: "交易日期格式須為 YYYY-MM-DD" }, { status: 400 });
  }
  if (requested.some((stockId) => !isValidStockId(stockId))) {
    return NextResponse.json({ error: "代號須為 4～6 位數" }, { status: 400 });
  }
  if (!Number.isInteger(topKRaw) || topKRaw < 1 || topKRaw > 8) {
    return NextResponse.json({ error: "最多深挖檔數須為 1～8" }, { status: 400 });
  }

  const holdings = await listHoldingsForUser(user.id, { limit: 100 });
  const heldSet = new Set(holdings.map((holding) => holding.stockId));
  const stockIds = [...new Set(requested.length > 0 ? requested : [...heldSet])];

  if (stockIds.length === 0) {
    return NextResponse.json(
      { error: "還沒有登記持股。請先在「台股籌碼報告」填持股，或改用自訂代號／主題。" },
      { status: 400 },
    );
  }
  if (stockIds.length > MAX_STOCKS) {
    return NextResponse.json({ error: `一次最多 ${MAX_STOCKS} 檔` }, { status: 400 });
  }

  const healthy = await checkAgentHealth();
  if (!healthy) {
    return NextResponse.json(
      { error: "Stock API 未啟動。請先啟動 stock-winning-rate API（:8765）。" },
      { status: 503 },
    );
  }

  try {
    const triage = await getTriage({
      stockIds,
      heldIds: stockIds.filter((stockId) => heldSet.has(stockId)),
      tradeDate: tradeDate || undefined,
      topK: topKRaw,
      fetchMissing,
    });
    return NextResponse.json({ triage });
  } catch (error) {
    const message = error instanceof Error ? error.message : "無法分流";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
