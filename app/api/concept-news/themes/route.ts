import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listConceptNewsThemes } from "@/lib/agent-client";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }
  try {
    const themes = await listConceptNewsThemes();
    return NextResponse.json({ themes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "無法載入題材";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
