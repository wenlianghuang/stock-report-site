import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  checkAgentHealth,
  createMarketCloseJob,
  getMarketCloseCurrent,
  listMarketCloseBriefs,
} from "@/lib/agent-client";
import { briefItemToRecord, jobToRecord } from "@/lib/market-close-shared";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  let window = null;
  try {
    const current = await getMarketCloseCurrent();
    window = current.window;
    const { items } = await listMarketCloseBriefs();
    const records = items
      .filter((item) => item.has_report || item.markdown)
      .map(briefItemToRecord);
    return NextResponse.json({
      window,
      records,
      shared: true,
      currentReady: current.ready,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "無法載入收盤日報";
    return NextResponse.json({ error: message, window, records: [] }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  let body: { force?: boolean; tradeDate?: string; asOf?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const healthy = await checkAgentHealth();
  if (!healthy) {
    return NextResponse.json(
      {
        error: "Stock API 未啟動。請先在 stock-winning-rate-Go 執行：go run ./cmd/api",
      },
      { status: 503 },
    );
  }

  try {
    const agentJob = await createMarketCloseJob({
      force: Boolean(body.force),
      tradeDate: body.tradeDate?.trim() || undefined,
      asOf: body.asOf?.trim() || undefined,
    });
    return NextResponse.json({
      record: jobToRecord(agentJob),
      agentJob,
      shared: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "無法建立收盤日報任務";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
