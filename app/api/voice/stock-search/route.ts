import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { searchStocksByQuery } from "@/lib/tw-stock-registry";

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) {
    return NextResponse.json({ results: [] });
  }

  const results = await searchStocksByQuery(q, 8);
  return NextResponse.json({ results });
}
