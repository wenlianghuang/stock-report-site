import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { isValidStockId, isValidTradeDate } from "@/lib/db";
import { checkAgentHealth, getStockChart } from "@/lib/agent-client";

type RouteContext = {
  params: Promise<{ stockId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { stockId: rawStockId } = await context.params;
  const stockId = rawStockId?.trim() ?? "";
  if (!isValidStockId(stockId)) {
    return NextResponse.json(
      { error: "請輸入 4～6 位數台股代號" },
      { status: 400 },
    );
  }

  const url = new URL(request.url);
  const tradeDate = url.searchParams.get("date")?.trim() ?? "";
  if (tradeDate && !isValidTradeDate(tradeDate)) {
    return NextResponse.json(
      { error: "交易日期格式須為 YYYY-MM-DD" },
      { status: 400 },
    );
  }

  const healthy = await checkAgentHealth();
  if (!healthy) {
    return NextResponse.json(
      {
        error:
          "Stock API 未啟動。請先在 stock-winning-rate 執行：uv run --extra server --extra ui --extra stock python main.py api",
      },
      { status: 503 },
    );
  }

  try {
    const chart = await getStockChart(stockId, tradeDate || undefined);
    if (!chart) {
      return NextResponse.json(
        { error: "找不到該股票的圖表資料（尚未抓取）" },
        { status: 404 },
      );
    }
    return NextResponse.json({ chart });
  } catch (error) {
    const message = error instanceof Error ? error.message : "無法取得圖表資料";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
