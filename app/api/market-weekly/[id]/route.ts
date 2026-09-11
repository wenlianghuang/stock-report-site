import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  getMarketWeeklyJob,
  listMarketWeeklyBriefs,
} from "@/lib/agent-client";
import {
  briefItemToRecord,
  isWeekEndId,
  jobToRecord,
} from "@/lib/market-weekly-shared";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { id } = await context.params;

  if (isWeekEndId(id)) {
    try {
      const { items } = await listMarketWeeklyBriefs();
      const item = items.find((row) => row.week_end === id);
      if (!item || !(item.has_report || item.markdown)) {
        return NextResponse.json({ error: "找不到共用市場週報" }, { status: 404 });
      }
      return NextResponse.json({
        record: briefItemToRecord(item),
        agentJob: null,
        shared: true,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "無法取得共用市場週報";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  try {
    const agentJob = await getMarketWeeklyJob(id);
    return NextResponse.json({
      record: jobToRecord(agentJob),
      agentJob,
      shared: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "無法取得市場週報任務狀態";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function DELETE() {
  return NextResponse.json(
    { error: "共用週報由排程管理，不可從網站刪除" },
    { status: 403 },
  );
}
