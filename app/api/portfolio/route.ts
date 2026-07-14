import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { checkAgentHealth, getPortfolio } from "@/lib/agent-client";
import type { PortfolioProfile } from "@/lib/types";

const PROFILES: PortfolioProfile[] = ["conservative", "balanced", "aggressive"];

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const profile = (searchParams.get("profile") ?? "") as PortfolioProfile;
  const amountRaw = searchParams.get("amount");
  const date = searchParams.get("date")?.trim() ?? "";

  if (!PROFILES.includes(profile)) {
    return NextResponse.json(
      { error: "請選擇風險型態（保守 / 穩健 / 積極）" },
      { status: 400 },
    );
  }

  const MIN_AMOUNT = 50_000;
  let amount: number | undefined;
  if (amountRaw) {
    amount = Number(amountRaw);
    if (
      !Number.isFinite(amount) ||
      !Number.isInteger(amount) ||
      amount < MIN_AMOUNT
    ) {
      return NextResponse.json(
        {
          error: `投入金額須為整數，且不得低於 ${MIN_AMOUNT.toLocaleString("zh-TW")} 元`,
        },
        { status: 400 },
      );
    }
  }

  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "交易日期格式須為 YYYY-MM-DD" },
      { status: 400 },
    );
  }

  const healthy = await checkAgentHealth();
  if (!healthy) {
    return NextResponse.json(
      {
        error:
          "Stock API 未啟動。請先在 stock-winning-rate 執行：uv run --extra server --extra ui --extra stock python main.py api",
      },
      { status: 503 },
    );
  }

  try {
    const portfolio = await getPortfolio({
      profile,
      amount: amount ? Math.round(amount) : undefined,
      date: date || undefined,
    });
    return NextResponse.json({ portfolio });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "無法產生投資組合建議";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
