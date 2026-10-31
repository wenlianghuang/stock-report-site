import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getConceptNewsJob } from "@/lib/agent-client";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }
  const { jobId } = await context.params;
  try {
    const job = await getConceptNewsJob(jobId);
    return NextResponse.json({ job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "無法取得題材新聞任務";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
