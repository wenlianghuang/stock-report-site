import { NextResponse } from "next/server";
import {
  createReport,
  isValidAvgCost,
  isValidShareCount,
  isValidStockId,
  isValidTradeDate,
  listReportsForUser,
} from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { checkAgentHealth, createAgentJob } from "@/lib/agent-client";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const reports = await listReportsForUser(user.id);
  return NextResponse.json({ reports });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const body = (await request.json()) as {
    stockId?: string;
    tradeDate?: string;
    isHolding?: boolean;
    shareCount?: number;
    avgCost?: number;
  };
  const stockId = body.stockId?.trim() ?? "";
  const tradeDate = body.tradeDate?.trim() ?? "";
  const isHolding = body.isHolding === true;
  const shareCount =
    body.shareCount !== undefined ? Number(body.shareCount) : undefined;
  const avgCost =
    body.avgCost !== undefined ? Number(body.avgCost) : undefined;

  if (!isValidStockId(stockId)) {
    return NextResponse.json(
      { error: "請輸入 4～6 位數台股代號" },
      { status: 400 },
    );
  }

  if (tradeDate && !isValidTradeDate(tradeDate)) {
    return NextResponse.json(
      { error: "交易日期格式須為 YYYY-MM-DD" },
      { status: 400 },
    );
  }

  if (isHolding) {
    if (shareCount === undefined || !isValidShareCount(shareCount)) {
      return NextResponse.json(
        { error: "請輸入有效的持股股數（正整數）" },
        { status: 400 },
      );
    }
    if (avgCost === undefined || !isValidAvgCost(avgCost)) {
      return NextResponse.json(
        { error: "持股分析需要輸入有效的持股均價" },
        { status: 400 },
      );
    }
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
    const agentJob = await createAgentJob({
      stockId,
      tradeDate: tradeDate || undefined,
      isHolding,
      shareCount: isHolding ? shareCount : undefined,
      avgCost: isHolding ? avgCost : undefined,
    });
    const report = await createReport({
      userId: user.id,
      stockId,
      agentJobId: agentJob.id,
      tradeDate: tradeDate || undefined,
      isHolding,
      shareCount: isHolding ? shareCount : undefined,
      avgCost: isHolding ? avgCost : undefined,
    });

    return NextResponse.json({ report, agentJob });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "無法建立分析任務";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
