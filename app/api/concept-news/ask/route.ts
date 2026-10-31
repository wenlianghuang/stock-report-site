import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { askConceptNews } from "@/lib/agent-client";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  let body: { theme?: string; date?: string; message?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "無效的 JSON" }, { status: 400 });
  }
  const theme = body.theme?.trim() ?? "";
  const date = body.date?.trim() ?? "";
  const message = body.message?.trim() ?? "";
  if (!theme || !date) {
    return NextResponse.json({ error: "請指定題材與日期" }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ error: "請輸入問題" }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: "問題過長" }, { status: 400 });
  }

  try {
    const result = await askConceptNews({ theme, date, message });
    return NextResponse.json(result);
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "無法回答";
    const status = messageText.includes("還沒有") ? 404 : 502;
    return NextResponse.json({ error: messageText }, { status });
  }
}
