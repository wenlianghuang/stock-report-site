import { NextResponse } from "next/server";
import {
  findHoldingForUserStock,
  isValidAvgCost,
  isValidShareCount,
  isValidStockId,
  upsertHoldingForUserStock,
} from "@/lib/db";
import { blendHoldingLegs } from "@/lib/holding-legs";
import { requireUser } from "@/lib/auth";

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const url = new URL(request.url);
  const stockId = url.searchParams.get("stockId")?.trim() ?? "";
  if (!isValidStockId(stockId)) {
    return NextResponse.json({ error: "請輸入 4～6 碼台股代號" }, { status: 400 });
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
    usesMargin?: boolean;
    cashShareCount?: number;
    cashAvgCost?: number;
    marginShareCount?: number;
    marginLotCount?: number;
    marginAvgCost?: number;
  };

  const stockId = body.stockId?.trim() ?? "";
  if (!isValidStockId(stockId)) {
    return NextResponse.json({ error: "請輸入 4～6 碼台股代號" }, { status: 400 });
  }

  const blended = blendHoldingLegs({
    cashShareCount: body.cashShareCount,
    cashAvgCost: body.cashAvgCost,
    marginShareCount: body.marginShareCount,
    marginLotCount: body.marginLotCount,
    marginAvgCost: body.marginAvgCost,
  });

  let shareCount: number;
  let avgCost: number;
  let usesMargin: boolean;
  let cashShareCount: number | undefined;
  let cashAvgCost: number | undefined;
  let marginShareCount: number | undefined;
  let marginAvgCost: number | undefined;

  if (blended) {
    shareCount = blended.shareCount;
    avgCost = blended.avgCost;
    usesMargin = blended.usesMargin;
    cashShareCount = blended.cashShareCount;
    cashAvgCost = blended.cashAvgCost;
    marginShareCount = blended.marginShareCount;
    marginAvgCost = blended.marginAvgCost;
  } else {
    shareCount = body.shareCount !== undefined ? Number(body.shareCount) : NaN;
    avgCost = body.avgCost !== undefined ? Number(body.avgCost) : NaN;
    usesMargin = body.usesMargin === true;
    if (!isValidShareCount(shareCount) || !isValidAvgCost(avgCost)) {
      return NextResponse.json(
        {
          error:
            "請至少完整填寫現股（股）或融資（張）與均價；融資須為整張",
        },
        { status: 400 },
      );
    }
  }

  try {
    const holding = await upsertHoldingForUserStock({
      userId: user.id,
      stockId,
      shareCount,
      avgCost,
      usesMargin,
      cashShareCount,
      cashAvgCost,
      marginShareCount,
      marginAvgCost,
    });
    return NextResponse.json({ holding });
  } catch (error) {
    const message = error instanceof Error ? error.message : "無法儲存持股資料";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
