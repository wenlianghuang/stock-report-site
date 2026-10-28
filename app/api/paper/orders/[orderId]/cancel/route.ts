import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { cancelPaperOrderForUser, PaperActionError } from "@/lib/paper-actions";

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "未登入" }, { status: 401 });

  const { orderId } = await context.params;
  try {
    const order = await cancelPaperOrderForUser(orderId);
    return NextResponse.json(order);
  } catch (error) {
    if (error instanceof PaperActionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
