import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listHoldingsForUser } from "@/lib/db";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const holdings = await listHoldingsForUser(user.id, { limit: 100 });
  return NextResponse.json({
    holdings: holdings.map((holding) => ({
      stockId: holding.stockId,
      shareCount: holding.shareCount,
      avgCost: holding.avgCost,
      usesMargin: holding.usesMargin,
    })),
  });
}
