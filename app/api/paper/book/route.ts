import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { loadPaperBookForUser, PaperActionError } from "@/lib/paper-actions";

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const stockId = new URL(request.url).searchParams.get("stockId") ?? "";
  try {
    const book = await loadPaperBookForUser(stockId);
    return NextResponse.json(book);
  } catch (error) {
    if (error instanceof PaperActionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
