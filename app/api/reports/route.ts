import { NextResponse } from "next/server";
import { createReport, isValidStockId, listReportsForUser } from "@/lib/db";
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

  const body = (await request.json()) as { stockId?: string };
  const stockId = body.stockId?.trim() ?? "";

  if (!isValidStockId(stockId)) {
    return NextResponse.json(
      { error: "請輸入 4～6 位數台股代號" },
      { status: 400 },
    );
  }

  const healthy = await checkAgentHealth();
  if (!healthy) {
    return NextResponse.json(
      {
        error:
          "Antigravity API 未啟動。請先在 antigravity_agent 執行：uv run --extra server --extra ui --extra stock python main.py api",
      },
      { status: 503 },
    );
  }

  try {
    const agentJob = await createAgentJob(stockId);
    const report = await createReport({
      userId: user.id,
      stockId,
      agentJobId: agentJob.id,
    });

    return NextResponse.json({ report, agentJob });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "無法建立分析任務";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
