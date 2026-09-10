import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  getMarketDailyJob,
  listMarketDailyBriefs,
} from "@/lib/agent-client";
import {
  briefItemToRecord,
  isTradeDateId,
  jobToRecord,
} from "@/lib/market-daily-shared";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { id } = await context.params;

  if (isTradeDateId(id)) {
    try {
      const { items } = await listMarketDailyBriefs();
      const item = items.find((row) => row.trade_date === id);
      if (!item || !(item.has_report || item.markdown)) {
        return NextResponse.json({ error: "找不到共用市場日報" }, { status: 404 });
      }
      return NextResponse.json({
        record: briefItemToRecord(item),
        agentJob: null,
        shared: true,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "無法取得共用市場日報";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  try {
    const agentJob = await getMarketDailyJob(id);
    return NextResponse.json({
      record: jobToRecord(agentJob),
      agentJob,
      shared: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "無法取得市場日報任務狀態";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function DELETE() {
  return NextResponse.json(
    { error: "共用 brief 由排程管理，不可從網站刪除" },
    { status: 403 },
  );
}
