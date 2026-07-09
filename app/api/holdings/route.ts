import { NextResponse } from "next/server";
import {
  findHoldingForUserStock,
  isValidAvgCost,
  isValidShareCount,
  isValidStockId,
  upsertHoldingForUserStock,
} from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const url = new URL(request.url);
  const stockId = url.searchParams.get("stockId")?.trim() ?? "";
  if (!isValidStockId(stockId)) {
    return NextResponse.json({ error: "請輸入 4～6 位數台股代號" }, { status: 400 });
  }

  const holding = await findHoldingForUserStock(user.id, stockId);
  return NextResponse.json({ holding: holding ?? null });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const body = (await request.json()) as {
    stockId?: string;
    shareCount?: number;
    avgCost?: number;
  };

  const stockId = body.stockId?.trim() ?? "";
  const shareCount = body.shareCount !== undefined ? Number(body.shareCount) : undefined;
  const avgCost = body.avgCost !== undefined ? Number(body.avgCost) : undefined;

  if (!isValidStockId(stockId)) {
    return NextResponse.json({ error: "請輸入 4～6 位數台股代號" }, { status: 400 });
  }
  if (shareCount === undefined || !isValidShareCount(shareCount)) {
    return NextResponse.json({ error: "請輸入有效的持股股數（正整數）" }, { status: 400 });
  }
  if (avgCost === undefined || !isValidAvgCost(avgCost)) {
    return NextResponse.json({ error: "請輸入有效的持股均價" }, { status: 400 });
  }

  try {
    const holding = await upsertHoldingForUserStock({
      userId: user.id,
      stockId,
      shareCount,
      avgCost,
    });
    return NextResponse.json({ holding });
  } catch (error) {
    const message = error instanceof Error ? error.message : "無法儲存持股資料";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

