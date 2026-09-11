import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  checkAgentHealth,
  createMarketWeeklyJob,
  listMarketWeeklyBriefs,
  resolveMarketWeekly,
} from "@/lib/agent-client";
import { briefItemToRecord, jobToRecord } from "@/lib/market-weekly-shared";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  let window = null;
  try {
    window = await resolveMarketWeekly();
  } catch {
    window = null;
  }

  try {
    const { items } = await listMarketWeeklyBriefs();
    const records = items
      .filter((item) => item.has_report || item.markdown)
      .map(briefItemToRecord);
    const currentReady = Boolean(
      window?.week_end && records.some((row) => row.weekEnd === window.week_end),
    );
    return NextResponse.json({
      window,
      records,
      shared: true,
      currentReady,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "無法載入共用市場週報";
    return NextResponse.json({ error: message, window, records: [] }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  let body: { force?: boolean; weekEnd?: string; asOf?: string } = {};
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
          "Stock API 未啟動。請先在 stock-winning-rate 執行：uv run --extra server --extra ui --extra stock python main.py api",
      },
      { status: 503 },
    );
  }

  try {
    const agentJob = await createMarketWeeklyJob({
      force: Boolean(body.force),
      weekEnd: body.weekEnd?.trim() || undefined,
      asOf: body.asOf?.trim() || undefined,
    });
    return NextResponse.json({
      record: jobToRecord(agentJob),
      agentJob,
      shared: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "無法建立市場週報任務";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
