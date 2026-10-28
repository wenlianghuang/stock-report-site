import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { loadPaperSnapshotForUser, PaperActionError } from "@/lib/paper-actions";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  try {
    const snapshot = await loadPaperSnapshotForUser();
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof PaperActionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
