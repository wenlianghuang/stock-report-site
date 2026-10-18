import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { checkAgentHealth, createAgentJob } from "@/lib/agent-client";
import { createReport, listHoldingsForUser } from "@/lib/db";
import { selectHoldingsForAnalysis } from "@/lib/holding-report";
import type { ReportRecord } from "@/lib/types";
import { isValidTradeDate } from "@/lib/validate";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    tradeDate?: string;
  };
  const tradeDate = body.tradeDate?.trim() ?? "";
  if (tradeDate && !isValidTradeDate(tradeDate)) {
    return NextResponse.json(
      { error: "交易日期格式須為 YYYY-MM-DD" },
      { status: 400 },
    );
  }

  const holdings = await listHoldingsForUser(user.id, { limit: 100 });
  const { selected, truncated } = selectHoldingsForAnalysis(holdings);
  if (selected.length === 0) {
    return NextResponse.json(
      {
        error:
          "尚未儲存可分析的持股。請先勾選「有持股」並填好均價與股數，分析過的標的會記下來。",
      },
      { status: 404 },
    );
  }

  const healthy = await checkAgentHealth();
  if (!healthy) {
    return NextResponse.json(
      {
        error:
          "Stock API 未啟動。請先在 stock-winning-rate 執行 API（:8765）。",
      },
      { status: 503 },
    );
  }

  const reports: ReportRecord[] = [];
  const failures: Array<{ stockId: string; error: string }> = [];

  for (const fields of selected) {
    try {
      const agentJob = await createAgentJob({
        stockId: fields.stockId,
        tradeDate: tradeDate || undefined,
        isHolding: true,
        shareCount: fields.shareCount,
        avgCost: fields.avgCost,
        usesMargin: fields.usesMargin,
        cashShareCount: fields.cashShareCount,
        cashAvgCost: fields.cashAvgCost,
        marginShareCount: fields.marginShareCount,
        marginAvgCost: fields.marginAvgCost,
      });
      const report = await createReport({
        userId: user.id,
        stockId: fields.stockId,
        agentJobId: agentJob.id,
        tradeDate: tradeDate || undefined,
        isHolding: true,
        shareCount: fields.shareCount,
        avgCost: fields.avgCost,
        usesMargin: fields.usesMargin,
        cashShareCount: fields.cashShareCount,
        cashAvgCost: fields.cashAvgCost,
        marginShareCount: fields.marginShareCount,
        marginAvgCost: fields.marginAvgCost,
      });
      reports.push(report);
    } catch (error) {
      failures.push({
        stockId: fields.stockId,
        error: error instanceof Error ? error.message : "無法建立分析任務",
      });
    }
  }

  if (reports.length === 0) {
    return NextResponse.json(
      {
        error: failures.map((item) => `${item.stockId}: ${item.error}`).join("；"),
        failures,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ reports, failures, truncated });
}
