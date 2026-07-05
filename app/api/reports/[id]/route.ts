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

  if (report.status === "done" && report.markdown) {
    return NextResponse.json({
      report,
      markdown: report.markdown,
      agentJob: null,
    });
  }

  try {
    const agentJob = await getAgentJob(report.agentJobId);
    const patch: Parameters<typeof updateReport>[1] = {};

    if (isValidReportStatus(agentJob.status)) {
      patch.status = agentJob.status;
    }
    if (agentJob.trade_date) {
      patch.tradeDate = agentJob.trade_date;
    }
    if (agentJob.error) {
      patch.error = agentJob.error;
    }
    if (agentJob.markdown) {
      patch.markdown = agentJob.markdown;
    }

    if (Object.keys(patch).length > 0) {
      await updateReport(report.id, patch);
    }

    const refreshed = await findReportById(id);
    return NextResponse.json({
      report: refreshed,
      markdown: agentJob.markdown ?? refreshed?.markdown ?? null,
      agentJob,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "無法取得任務狀態";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
