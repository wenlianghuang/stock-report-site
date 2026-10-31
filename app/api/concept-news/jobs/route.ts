import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { checkAgentHealth, createConceptNewsJob } from "@/lib/agent-client";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  let body: { theme?: string; date?: string; force?: boolean } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const theme = body.theme?.trim() ?? "";
  if (!theme) {
    return NextResponse.json({ error: "請指定題材" }, { status: 400 });
  }

  const healthy = await checkAgentHealth();
  if (!healthy) {
    return NextResponse.json(
      {
        error:
          "Stock API 未啟動。請先執行：uv run --extra server --extra ui --extra stock python main.py api",
      },
      { status: 503 },
    );
  }

  try {
    const job = await createConceptNewsJob({
      theme,
      date: body.date?.trim() || undefined,
      force: Boolean(body.force),
    });
    return NextResponse.json({ job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "無法建立題材新聞任務";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
