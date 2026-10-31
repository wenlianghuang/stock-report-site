import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listConceptNewsReports } from "@/lib/agent-client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }
  const theme = new URL(request.url).searchParams.get("theme")?.trim() ?? "";
  if (!theme) {
    return NextResponse.json({ error: "請指定題材" }, { status: 400 });
  }
  try {
    const listed = await listConceptNewsReports(theme);
    return NextResponse.json({
      theme,
      items: listed.items,
      news_as_of: listed.newsAsOf,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "無法載入已寫好的報告";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
