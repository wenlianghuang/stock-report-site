import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { resolveStockNameById } from "@/lib/tw-stock-registry";

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const stockId = searchParams.get("stockId")?.trim() ?? "";
  if (!/^\d{4,6}$/.test(stockId)) {
    return NextResponse.json({ stockName: null });
  }

  const stockName = await resolveStockNameById(stockId);
  return NextResponse.json({ stockName });
}

