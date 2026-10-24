import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { checkAgentHealth, getConceptGroups } from "@/lib/agent-client";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const healthy = await checkAgentHealth();
  if (!healthy) {
    return NextResponse.json(
      { error: "Stock API 未啟動。請先啟動 stock-winning-rate API（:8765）。" },
      { status: 503 },
    );
  }

  try {
    const themes = await getConceptGroups();
    return NextResponse.json({ themes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "無法取得概念族群";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
