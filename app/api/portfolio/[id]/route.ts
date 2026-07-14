import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getPortfolioJob } from "@/lib/agent-client";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "缺少 job id" }, { status: 400 });
  }

  try {
    const job = await getPortfolioJob(id);
    return NextResponse.json({ job });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "無法取得組合任務狀態";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
