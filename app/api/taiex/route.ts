import { NextResponse } from "next/server";
import { fetchTaiexDaily } from "@/lib/taiex";

export const revalidate = 1800;

export async function GET() {
  try {
    const snapshot = await fetchTaiexDaily();
    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "無法取得加權指數資料";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
