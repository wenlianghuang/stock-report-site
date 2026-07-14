import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getPortfolioJob } from "@/lib/agent-client";
import {
  deletePortfolio,
  findPortfolioById,
  isValidPortfolioStatus,
  updatePortfolio,
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
  const portfolio = await findPortfolioById(id);
  if (!portfolio || portfolio.userId !== user.id) {
    return NextResponse.json({ error: "找不到組合紀錄" }, { status: 404 });
  }

  if (portfolio.status === "done" && portfolio.factsJson) {
    return NextResponse.json({ portfolio, agentJob: null });
  }

  try {
    const agentJob = await getPortfolioJob(portfolio.agentJobId);
    const patch: Parameters<typeof updatePortfolio>[1] = {};

    if (isValidPortfolioStatus(agentJob.status)) {
      patch.status = agentJob.status;
    } else if (agentJob.status === "queued" || agentJob.status === "fetching") {
      patch.status = "gating";
    }

    if (agentJob.trade_date) {
      patch.tradeDate = agentJob.trade_date;
    }
    if (agentJob.error) {
      patch.error = agentJob.error;
    }
    if (agentJob.portfolio?.facts) {
      patch.factsJson = agentJob.portfolio.facts;
      if (agentJob.portfolio.facts.trade_date) {
        patch.tradeDate = agentJob.portfolio.facts.trade_date;
      }
    }
    if (agentJob.portfolio?.narrative) {
      patch.narrative = agentJob.portfolio.narrative;
    }
    if (agentJob.portfolio?.generated_via) {
      patch.generatedVia = agentJob.portfolio.generated_via;
    }

    if (Object.keys(patch).length > 0) {
      await updatePortfolio(portfolio.id, patch);
    }

    const refreshed = await findPortfolioById(id);
    return NextResponse.json({
      portfolio: refreshed,
      agentJob,
    });
  } catch (error) {
    if (portfolio.factsJson) {
      return NextResponse.json({ portfolio, agentJob: null });
    }
    const message =
      error instanceof Error ? error.message : "無法取得組合任務狀態";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { id } = await context.params;
  const portfolio = await findPortfolioById(id);
  if (!portfolio || portfolio.userId !== user.id) {
    return NextResponse.json({ error: "找不到組合紀錄" }, { status: 404 });
  }

  const deleted = await deletePortfolio(id, user.id);
  if (!deleted) {
    return NextResponse.json({ error: "無法刪除組合紀錄" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
