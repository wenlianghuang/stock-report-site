import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { checkAgentHealth, createPortfolioJob } from "@/lib/agent-client";
import {
  createPortfolio,
  isValidPortfolioAmount,
  isValidPortfolioMode,
  isValidPortfolioProfile,
  isValidPortfolioThemes,
  isValidTradeDate,
  listPortfoliosForUser,
} from "@/lib/db";

function themeSlug(themes: string[]): string {
  return `theme_${[...themes].sort().join("_")}`;
}

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const portfolios = await listPortfoliosForUser(user.id);
  return NextResponse.json({ portfolios });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  let body: {
    mode?: string;
    profile?: string;
    themes?: string[];
    amount?: number;
    date?: string;
    force?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "請求格式錯誤" }, { status: 400 });
  }

  const mode = body.mode ?? "beginner";
  if (!isValidPortfolioMode(mode)) {
    return NextResponse.json(
      { error: "mode 須為 beginner 或 theme" },
      { status: 400 },
    );
  }

  const themes = Array.isArray(body.themes)
    ? body.themes.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
    : [];

  let profile = "";
  if (mode === "theme") {
    if (!isValidPortfolioThemes(themes)) {
      return NextResponse.json(
        { error: "請至少選擇一個主題（最多三個），例如金融、散熱、AI" },
        { status: 400 },
      );
    }
    profile = themeSlug(themes);
  } else {
    profile = body.profile ?? "";
    if (!isValidPortfolioProfile(profile) || profile.startsWith("theme_")) {
      return NextResponse.json(
        { error: "請選擇風險型態（保守 / 穩健 / 積極）" },
        { status: 400 },
      );
    }
  }

  const amount = Number(body.amount);
  if (!isValidPortfolioAmount(amount)) {
    return NextResponse.json(
      {
        error: `投入金額須為整數，且不得低於 ${Number(50_000).toLocaleString("zh-TW")} 元`,
      },
      { status: 400 },
    );
  }

  const date = body.date?.trim() ?? "";
  if (date && !isValidTradeDate(date)) {
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
    const agentJob = await createPortfolioJob({
      mode,
      profile: mode === "beginner" ? profile : undefined,
      themes: mode === "theme" ? themes : undefined,
      amount,
      date: date || undefined,
      force: Boolean(body.force),
    });

    const initial = agentJob.portfolio;
    const artifactKey =
      agentJob.profile ||
      initial?.artifact_key ||
      initial?.facts.profile ||
      profile;

    const portfolio = await createPortfolio({
      userId: user.id,
      agentJobId: agentJob.id,
      mode,
      profile: artifactKey,
      themes: mode === "theme" ? themes : [],
      amount,
      tradeDate:
        agentJob.trade_date ||
        initial?.facts.trade_date ||
        date ||
        undefined,
      status:
        agentJob.status === "done"
          ? "done"
          : agentJob.status === "failed"
            ? "failed"
            : "gating",
      narrative: initial?.narrative ?? null,
      factsJson: initial?.facts ?? null,
      generatedVia: initial?.generated_via ?? null,
    });

    return NextResponse.json({ portfolio, agentJob });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "無法產生投資組合建議";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
