import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { PaperActionError } from "@/lib/paper-actions";
import { askPaperLedger } from "@/lib/paper-link-query";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  let body: { question?: unknown; proposedSql?: unknown };
  try {
    body = (await request.json()) as { question?: unknown; proposedSql?: unknown };
  } catch {
    return NextResponse.json({ error: "要有問句" }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question : "";
  const proposedSql = typeof body.proposedSql === "string" ? body.proposedSql : undefined;

  try {
    const result = await askPaperLedger(question, proposedSql);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PaperActionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
