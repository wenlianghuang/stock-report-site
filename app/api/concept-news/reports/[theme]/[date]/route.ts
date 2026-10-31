import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getConceptNewsReport } from "@/lib/agent-client";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ theme: string; date: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }
  const { theme, date } = await context.params;
  try {
    const report = await getConceptNewsReport(theme, date);
    return NextResponse.json({ report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "無法讀取題材新聞";
    const status = message.includes("還沒有") ? 404 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
