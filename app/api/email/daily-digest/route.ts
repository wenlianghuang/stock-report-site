import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createDailyDigest } from "@/lib/agent-client";
import { isValidTradeDate, listDoneReportsForUserByTradeDate } from "@/lib/db";
import { markdownToEmailHtml, sendEmail } from "@/lib/email";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const body = (await request.json()) as { date?: string };
  const date = body.date?.trim() ?? "";
  if (!isValidTradeDate(date)) {
    return NextResponse.json({ error: "日期格式須為 YYYY-MM-DD" }, { status: 400 });
  }

  const reports = await listDoneReportsForUserByTradeDate(user.id, date);
  if (reports.length === 0) {
    return NextResponse.json(
      { error: "該日期沒有已完成的報告（done）" },
      { status: 404 },
    );
  }

  // Ensure content exists (API polling should have persisted markdown already).
  const items = reports
    .filter((report) => Boolean(report.markdown))
    .map((report) => ({
      stockId: report.stockId,
      stockName: report.stockName,
      tradeDate: report.tradeDate,
      markdown: report.markdown ?? "",
      positionMarkdown: report.positionMarkdown,
    }));

  if (items.length === 0) {
    return NextResponse.json(
      { error: "該日期的報告尚未寫入內容，請稍後再試" },
      { status: 409 },
    );
  }

  try {
    const digest = await createDailyDigest({ digestDate: date, items });
    const html = markdownToEmailHtml(digest.mainDetailMarkdown);
    await sendEmail({ to: user.email, subject: digest.subject, html });
    return NextResponse.json({ ok: true, subject: digest.subject });
  } catch (error) {
    const message = error instanceof Error ? error.message : "寄送失敗";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

