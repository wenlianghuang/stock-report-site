import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isValidStockId } from "@/lib/validate";
import { checkAgentHealth, getConceptPeers } from "@/lib/agent-client";

type RouteContext = {
  params: Promise<{ stockId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { stockId: rawStockId } = await context.params;
  const stockId = rawStockId?.trim() ?? "";
  if (!isValidStockId(stockId)) {
    return NextResponse.json(
      { error: "請輸入 4～6 位數台股代號" },
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
    const peers = await getConceptPeers(stockId);
    return NextResponse.json({ peers });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "無法取得概念股清單";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
