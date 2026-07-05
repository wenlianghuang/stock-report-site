import { NextResponse } from "next/server";
import {
  findReportById,
  isValidReportStatus,
  updateReport,
} from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getAgentJob } from "@/lib/agent-client";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { id } = await context.params;
  const report = await findReportById(id);
  if (!report || report.userId !== user.id) {
    return NextResponse.json({ error: "找不到報告" }, { status: 404 });
  }

  try {
    const agentJob = await getAgentJob(report.agentJobId);
    if (
      isValidReportStatus(agentJob.status) &&
      (agentJob.status !== report.status ||
        agentJob.trade_date !== report.tradeDate ||
        agentJob.error !== report.error)
    ) {
      await updateReport(report.id, {
        status: agentJob.status,
        tradeDate: agentJob.trade_date ?? undefined,
        error: agentJob.error ?? undefined,
      });
    }

    const refreshed = await findReportById(id);
    return NextResponse.json({
      report: refreshed,
      markdown: agentJob.markdown ?? null,
      agentJob,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "無法取得任務狀態";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
