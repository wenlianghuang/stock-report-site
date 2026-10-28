import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { PaperActionError, runPaperCloseForUser } from "@/lib/paper-actions";

export async function POST() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  try {
    const result = await runPaperCloseForUser();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PaperActionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
