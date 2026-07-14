import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { checkAgentHealth, listPortfolioThemes } from "@/lib/agent-client";

const FALLBACK_THEMES = [
  {
    id: "financials",
    label: "金融",
    style: "defensive",
    risk_hint: "相對防禦、偏息收；仍受利率與信用循環影響",
  },
  {
    id: "thermal",
    label: "散熱",
    style: "cyclical",
    risk_hint: "題材／景氣循環色彩較濃，波動通常高於金融",
  },
  {
    id: "ai",
    label: "AI",
    style: "growth",
    risk_hint: "成長／題材導向，估值與景氣敏感度高",
  },
];

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "未登入" }, { status: 401 });
  }

  const healthy = await checkAgentHealth();
  if (!healthy) {
    return NextResponse.json({ themes: FALLBACK_THEMES, source: "fallback" });
  }

  try {
    const themes = await listPortfolioThemes();
    if (themes.length === 0) {
      return NextResponse.json({ themes: FALLBACK_THEMES, source: "fallback" });
    }
    return NextResponse.json({ themes, source: "agent" });
  } catch {
    return NextResponse.json({ themes: FALLBACK_THEMES, source: "fallback" });
  }
}
