import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { checkAgentHealth, createPeerGraphJob } from "@/lib/agent-client";
import { isValidStockId, isValidTradeDate } from "@/lib/validate";

export const maxDuration = 30;

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const healthy = await checkAgentHealth();
  if (!healthy) {
    return NextResponse.json(
      { error: "Stock API 未啟動。請先啟動 stock-winning-rate API（:8765）。" },
      { status: 503 },
    );
  }

  let body: {
    stockId?: string;
    peerId?: string;
    tradeDate?: string;
    isHolding?: boolean;
    shareCount?: number;
    avgCost?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "需要 JSON" }, { status: 400 });
  }

  const stockId = body.stockId?.trim() ?? "";
  const peerId = body.peerId?.trim() ?? "";
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
  const tradeDate = body.tradeDate?.trim() ?? "";
  if (tradeDate && !isValidTradeDate(tradeDate)) {
    return NextResponse.json(
      { error: "交易日期格式須為 YYYY-MM-DD" },
      { status: 400 },
    );
  }

  try {
    const job = await createPeerGraphJob({
      stockId,
      peerId,
      tradeDate: tradeDate || undefined,
      fetch: false,
      isHolding: Boolean(body.isHolding),
      shareCount: body.shareCount,
      avgCost: body.avgCost,
    });
    return NextResponse.json({ job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "無法啟動同業決策";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
