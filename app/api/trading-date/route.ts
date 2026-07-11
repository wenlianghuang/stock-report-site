import { NextResponse } from "next/server";
import { getLastTradingDate } from "@/lib/agent-client";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  try {
    const payload = await getLastTradingDate();
    return NextResponse.json(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "無法取得最近交易日";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
