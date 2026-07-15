import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { checkAgentHealth, listPortfolioThemes } from "@/lib/agent-client";
import { FALLBACK_PORTFOLIO_THEMES } from "@/lib/portfolio-themes";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const healthy = await checkAgentHealth();
  if (!healthy) {
    return NextResponse.json({
      themes: FALLBACK_PORTFOLIO_THEMES,
      source: "fallback",
    });
  }

  try {
    const themes = await listPortfolioThemes();
    if (themes.length === 0) {
      return NextResponse.json({
        themes: FALLBACK_PORTFOLIO_THEMES,
        source: "fallback",
      });
    }
    return NextResponse.json({ themes, source: "agent" });
  } catch {
    return NextResponse.json({
      themes: FALLBACK_PORTFOLIO_THEMES,
      source: "fallback",
    });
  }
}
