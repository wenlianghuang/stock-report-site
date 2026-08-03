import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  checkAgentHealth,
  createMarketDailyJob,
  resolveMarketDaily,
} from "@/lib/agent-client";
import { createMarketDaily, listMarketDailiesForUser } from "@/lib/db";

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

  const records = await listMarketDailiesForUser(user.id);
  return NextResponse.json({ window, records });
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
          "Stock API 未啟動。請先在 stock-winning-rate 執行：uv run --extra server --extra ui --extra stock python main.py api",
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

    const record = await createMarketDaily({
      userId: user.id,
      agentJobId: agentJob.id,
      tradeDate: agentJob.trade_date ?? undefined,
      forSession: agentJob.for_session ?? undefined,
      status:
        agentJob.status === "done"
          ? "done"
          : agentJob.status === "failed"
            ? "failed"
            : "gating",
      markdown: agentJob.markdown ?? null,
      factsJson: agentJob.facts ?? null,
      summaryJson: agentJob.summary ?? null,
    });

    return NextResponse.json({ record, agentJob });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "無法建立市場日報任務";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
