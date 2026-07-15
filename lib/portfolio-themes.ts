import type { PortfolioThemeMeta } from "@/lib/types";

/**
 * Offline fallback catalog — keep in sync with
 * stock-winning-rate/.agents/skills/portfolio-gate/portfolio_theme_universe.json
 * `themes` object.
 */
export const FALLBACK_PORTFOLIO_THEMES: PortfolioThemeMeta[] = [
  {
    id: "ai",
    label: "AI",
    style: "growth",
    risk_hint: "成長／題材導向，估值與景氣敏感度高",
  },
  {
    id: "biotech",
    label: "生技",
    style: "growth",
    risk_hint: "研發／授權事件驅動，個股非系統性風險高",
  },
  {
    id: "consumer",
    label: "食品消費",
    style: "defensive",
    risk_hint: "防禦型消費需求較穩，但漲幅空間通常有限",
  },
  {
    id: "dividend",
    label: "高股息",
    style: "defensive",
    risk_hint: "以息收為主；股價波動通常低於純題材股，但不保證配息維持",
  },
  {
    id: "financials",
    label: "金融",
    style: "defensive",
    risk_hint: "相對防禦、偏息收；仍受利率與信用循環影響",
  },
  {
    id: "green_energy",
    label: "綠能／儲能",
    style: "growth",
    risk_hint: "政策與題材驅動強，營運能見度與估值波動都偏高",
  },
  {
    id: "memory",
    label: "記憶體",
    style: "growth",
    risk_hint: "與電子週期、記憶體供需連動；波動通常高於金融",
  },
  {
    id: "panel",
    label: "面板",
    style: "cyclical",
    risk_hint: "與面板價格週期、消費電子需求連動；波動通常高",
  },
  {
    id: "passive_components",
    label: "被動元件",
    style: "cyclical",
    risk_hint: "與電子週期、被動元件供需連動；波動通常高於金融",
  },
  {
    id: "pcb",
    label: "載板／PCB",
    style: "cyclical",
    risk_hint: "與電子週期、載板供需連動；題材熱時波動放大",
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
    id: "shipping",
    label: "航運",
    style: "cyclical",
    risk_hint: "運價與景氣循環敏感，波動通常很大",
  },
  {
    id: "telecom",
    label: "電信",
    style: "defensive",
    risk_hint: "現金流較穩、波動相對低；成長性通常有限",
  },
  {
    id: "thermal",
    label: "散熱",
    style: "cyclical",
    risk_hint: "題材／景氣循環色彩較濃，波動通常高於金融",
  },
];
