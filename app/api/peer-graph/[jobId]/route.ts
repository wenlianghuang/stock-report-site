import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { checkAgentHealth, getPeerGraphJob } from "@/lib/agent-client";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { jobId } = await context.params;
  if (!jobId?.trim()) {
    return NextResponse.json({ error: "缺少 job id" }, { status: 400 });
  }

  const healthy = await checkAgentHealth();
  if (!healthy) {
    return NextResponse.json(
      { error: "Stock API 未啟動。請先啟動 stock-winning-rate API（:8765）。" },
      { status: 503 },
    );
  }

  try {
    const job = await getPeerGraphJob(jobId.trim());
    return NextResponse.json({ job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "無法讀取同業決策";
    const status = message.includes("找不到") ? 404 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
