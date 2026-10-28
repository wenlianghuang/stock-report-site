import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { PaperActionError, placePaperOrderForUser } from "@/lib/paper-actions";
import type { PaperOrderType, PaperSide } from "@/lib/paper-trade";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const body = (await request.json()) as {
    stockId?: string;
    side?: string;
    orderType?: string;
    shares?: number;
    limitPrice?: string;
  };
  const stockId = body.stockId?.trim() ?? "";
  const side = body.side;
  const orderType = body.orderType;
  const shares = Number(body.shares);
  if (side !== "buy" && side !== "sell") {
    return NextResponse.json({ error: "請選擇買進或賣出" }, { status: 400 });
  }
  if (orderType !== "market" && orderType !== "limit") {
    return NextResponse.json({ error: "請選擇市價或限價" }, { status: 400 });
  }

  try {
    const order = await placePaperOrderForUser({
      stockId,
      side: side as PaperSide,
      orderType: orderType as PaperOrderType,
      shares,
      limitPrice: body.limitPrice ?? null,
    });
    return NextResponse.json(order);
  } catch (error) {
    if (error instanceof PaperActionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
