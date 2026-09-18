import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  checkAgentHealth,
  createMarketDailyJob,
  getMarketDailyCurrent,
  listMarketDailyBriefs,
  resolveMarketDaily,
} from "@/lib/agent-client";
import { briefItemToRecord, jobToRecord } from "@/lib/market-daily-shared";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  let window = null;
  try {
    window = await resolveMarketDaily();
  } catch {
    window = null;
  }

  try {
    const { items } = await listMarketDailyBriefs();
    const records = items
      .filter((item) => item.has_report || item.markdown)
      .map(briefItemToRecord);
    let currentReady = false;
    try {
      const current = await getMarketDailyCurrent();
      currentReady = current.ready;
      window = current.window ?? window;
    } catch {
      currentReady = false;
    }
    return NextResponse.json({
      window,
      records,
      shared: true,
      currentReady,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "無法載入共用市場日報";
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
        error:
          "Stock API 未啟動。請先在 stock-winning-rate-Go 執行：go run ./cmd/api",
      },
      { status: 503 },
    );
  }

  try {
    const agentJob = await createMarketDailyJob({
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
    const message =
      error instanceof Error ? error.message : "無法建立市場日報任務";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
