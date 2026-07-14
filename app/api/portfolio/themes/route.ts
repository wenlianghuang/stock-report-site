import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { checkAgentHealth, listPortfolioThemes } from "@/lib/agent-client";
import type { PortfolioThemeMeta } from "@/lib/types";

/** Keep in sync with portfolio_theme_universe.json themes (agent offline fallback). */
const FALLBACK_THEMES: PortfolioThemeMeta[] = [
  {
    id: "financials",
    label: "金融",
    style: "defensive",
    risk_hint: "相對防禦、偏息收；仍受利率與信用循環影響",
  },
  {
    id: "dividend",
    label: "高股息",
    style: "defensive",
    risk_hint: "以息收為主；股價波動通常低於純題材股，但不保證配息維持",
  },
  {
    id: "telecom",
    label: "電信",
    style: "defensive",
    risk_hint: "現金流較穩、波動相對低；成長性通常有限",
  },
  {
    id: "consumer",
    label: "食品消費",
    style: "defensive",
    risk_hint: "防禦型消費需求較穩，但漲幅空間通常有限",
  },
  {
    id: "ai",
    label: "AI",
    style: "growth",
    risk_hint: "成長／題材導向，估值與景氣敏感度高",
  },
  {
    id: "semiconductor",
    label: "半導體",
    style: "growth",
    risk_hint: "製程與景氣循環影響大，波動通常高於金融／電信",
  },
  {
    id: "servers",
    label: "伺服器組裝",
    style: "growth",
    risk_hint: "與雲端／AI 資本支出連動強，訂單與毛利波動大",
  },
  {
    id: "pcb",
    label: "載板／PCB",
    style: "cyclical",
    risk_hint: "與電子週期、載板供需連動；題材熱時波動放大",
  },
  {
    id: "thermal",
    label: "散熱",
    style: "cyclical",
    risk_hint: "題材／景氣循環色彩較濃，波動通常高於金融",
  },
  {
    id: "shipping",
    label: "航運",
    style: "cyclical",
    risk_hint: "運價與景氣循環敏感，波動通常很大",
  },
  {
    id: "green_energy",
    label: "綠能／儲能",
    style: "growth",
    risk_hint: "政策與題材驅動強，營運能見度與估值波動都偏高",
  },
  {
    id: "biotech",
    label: "生技",
    style: "growth",
    risk_hint: "研發／授權事件驅動，個股非系統性風險高",
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
