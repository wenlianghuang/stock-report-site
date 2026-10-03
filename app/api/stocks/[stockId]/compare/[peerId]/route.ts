import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isValidStockId, isValidTradeDate } from "@/lib/validate";
import { checkAgentHealth, compareConceptStocks } from "@/lib/agent-client";

/** Peer may need on-demand fetch_chips + build_chip_facts. */
export const maxDuration = 120;

type RouteContext = {
  params: Promise<{ stockId: string; peerId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { stockId: rawStockId, peerId: rawPeerId } = await context.params;
  const stockId = rawStockId?.trim() ?? "";
  const peerId = rawPeerId?.trim() ?? "";
  if (!isValidStockId(stockId) || !isValidStockId(peerId)) {
    return NextResponse.json(
      { error: "請輸入 4～6 位數台股代號" },
      { status: 400 },
    );
  }
  if (stockId === peerId) {
    return NextResponse.json(
      { error: "比較標的不可與本檔相同" },
      { status: 400 },
    );
  }

  const url = new URL(request.url);
  const tradeDate = url.searchParams.get("date")?.trim() ?? "";
  if (tradeDate && !isValidTradeDate(tradeDate)) {
    return NextResponse.json(
      { error: "交易日期格式須為 YYYY-MM-DD" },
      { status: 400 },
    );
  }

  const healthy = await checkAgentHealth();
  if (!healthy) {
    return NextResponse.json(
      { error: "Stock API 未啟動。請先啟動 stock-winning-rate API（:8765）。" },
      { status: 503 },
    );
  }

  try {
    const comparison = await compareConceptStocks(
      stockId,
      peerId,
      tradeDate || undefined,
    );
    return NextResponse.json({ comparison });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "無法取得比較資料";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
