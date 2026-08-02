import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getMarketWeeklyJob } from "@/lib/agent-client";
import {
  deleteMarketWeekly,
  findMarketWeeklyById,
  isValidMarketWeeklyStatus,
  updateMarketWeekly,
} from "@/lib/db";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { id } = await context.params;
  const record = await findMarketWeeklyById(id);
  if (!record || record.userId !== user.id) {
    return NextResponse.json({ error: "找不到市場週報紀錄" }, { status: 404 });
  }

  if (record.status === "done" && record.markdown) {
    return NextResponse.json({ record, agentJob: null });
  }

  try {
    const agentJob = await getMarketWeeklyJob(record.agentJobId);
    const patch: Parameters<typeof updateMarketWeekly>[1] = {};

    if (isValidMarketWeeklyStatus(agentJob.status)) {
      patch.status = agentJob.status;
    } else if (
      agentJob.status === "queued" ||
      agentJob.status === "fetching"
    ) {
      patch.status = "gating";
    }

    if (agentJob.week_start) patch.weekStart = agentJob.week_start;
    if (agentJob.week_end) patch.weekEnd = agentJob.week_end;
    if (agentJob.error) patch.error = agentJob.error;
    if (agentJob.markdown) patch.markdown = agentJob.markdown;
    if (agentJob.facts) patch.factsJson = agentJob.facts;
    if (agentJob.summary) patch.summaryJson = agentJob.summary;

    if (Object.keys(patch).length > 0) {
      await updateMarketWeekly(record.id, patch);
    }

    const refreshed = await findMarketWeeklyById(id);
    return NextResponse.json({ record: refreshed, agentJob });
  } catch (error) {
    if (record.markdown) {
      return NextResponse.json({ record, agentJob: null });
    }
    const message =
      error instanceof Error ? error.message : "無法取得市場週報任務狀態";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }
  const { id } = await context.params;
  const ok = await deleteMarketWeekly(id, user.id);
  if (!ok) {
    return NextResponse.json({ error: "刪除失敗" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
