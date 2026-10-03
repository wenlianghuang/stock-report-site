import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  checkAgentHealth,
  claimPeerGraphSend,
  finishPeerGraphSend,
} from "@/lib/agent-client";
import { markdownToEmailHtml, sendEmail } from "@/lib/email";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }
  if (!user.email) {
    return NextResponse.json({ error: "帳號沒有信箱，無法寄出" }, { status: 400 });
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

  let claimed;
  try {
    claimed = await claimPeerGraphSend(jobId.trim());
  } catch (error) {
    const message = error instanceof Error ? error.message : "無法核准寄出";
    const status = message.includes("找不到") ? 404 : 409;
    return NextResponse.json({ error: message }, { status });
  }

  const subject = claimed.digestSubject?.trim() ?? "";
  const body = claimed.digestBody?.trim() ?? "";
  if (!subject || !body) {
    try {
      await finishPeerGraphSend(jobId.trim(), false, "草稿是空的");
    } catch {
      // The claim already moved the job; surface the empty-draft error below.
    }
    return NextResponse.json({ error: "草稿是空的" }, { status: 409 });
  }

  try {
    await sendEmail({
      to: user.email,
      subject,
      html: markdownToEmailHtml(
        body,
        "免責聲明：本信由同日籌碼 facts 的規則比較整理而成，非投資建議。",
      ),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "寄送失敗";
    try {
      await finishPeerGraphSend(jobId.trim(), false, message);
    } catch {
      // Keep the SMTP error as the response even if status rollback fails.
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }

  try {
    const job = await finishPeerGraphSend(jobId.trim(), true);
    return NextResponse.json({ job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "信已寄出，但狀態沒寫回";
    return NextResponse.json(
      { error: message, sent: true },
      { status: 502 },
    );
  }
}
