import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { fetchUsIndices } from "@/lib/us-indices";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  try {
    const indices = await fetchUsIndices();
    return NextResponse.json({ indices });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "無法取得美股指數";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
