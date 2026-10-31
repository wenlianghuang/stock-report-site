"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { TwStockDashboard } from "@/components/TwStockDashboard";
import { TwPortfolioDashboard } from "@/components/TwPortfolioDashboard";
import { TwMarketWeeklyDashboard } from "@/components/TwMarketWeeklyDashboard";
import { TwMarketDailyDashboard } from "@/components/TwMarketDailyDashboard";
import { TwMarketCloseDashboard } from "@/components/TwMarketCloseDashboard";
import { ThemeWorkspace } from "@/components/ThemeWorkspace";
import { UsStockDashboard } from "@/components/UsStockDashboard";
import { PaperTradingDashboard } from "@/components/PaperTradingDashboard";
import { canonicalThemeSearch, readThemeNav, type ThemeLens } from "@/lib/theme-nav";
import { parseDailyBrief, type DailyBrief } from "@/lib/daily-brief";

type MarketTab = "tw" | "us";
type TwView = "chip" | "portfolio" | "theme" | "weekly" | "daily" | "paper";

function tabClass(active: boolean): string {
  return active
    ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
    : "text-zinc-600 hover:bg-white hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100";
}

function parseTwView(raw: string | null): TwView {
  if (raw === "portfolio") return "portfolio";
  if (raw === "weekly") return "weekly";
  if (raw === "daily") return "daily";
  if (raw === "paper") return "paper";
  if (raw === "theme" || raw === "triage" || raw === "groups" || raw === "concept-news") {
    return "theme";
  }
  return "chip";
}

const THEME_LENSES: { id: ThemeLens; label: string; title: string }[] = [
  { id: "news", label: "新聞", title: "題材新聞" },
  { id: "peers", label: "同儕", title: "族群比較" },
  { id: "changes", label: "今日變化", title: "今日分流" },
];

export function HomeShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const market: MarketTab = searchParams.get("market") === "us" ? "us" : "tw";
  const rawView = searchParams.get("view");
  const twView: TwView = parseTwView(rawView);
  const themeNav = readThemeNav({
    view: rawView,
    lens: searchParams.get("lens"),
    scope: searchParams.get("scope"),
  });
  const dailyBrief: DailyBrief = parseDailyBrief(searchParams.get("brief"));
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const next = canonicalThemeSearch(searchParams);
    if (!next) return;
    if (next.toString() === searchParams.toString()) return;
    router.replace(`/?${next.toString()}`);
  }, [searchParams, router]);

  function selectMarket(next: MarketTab) {
    router.replace(next === "us" ? "/?market=us" : "/");
  }

  function selectTwView(next: TwView) {
    if (next === "theme") {
      if (twView === "theme" && themeNav.scope === "theme") return;
      const params = new URLSearchParams();
      params.set("view", "theme");
      params.set("lens", "news");
      params.set("scope", "theme");
      const theme = searchParams.get("theme");
      if (theme) params.set("theme", theme);
      router.replace(`/?${params.toString()}`);
      return;
    }
    if (next === "chip") {
      router.replace("/");
      return;
    }
    router.replace(`/?view=${next}`);
  }

  function selectThemeLens(next: ThemeLens) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("market");
    params.set("view", "theme");
    params.set("scope", "theme");
    params.set("lens", next);
    router.replace(`/?${params.toString()}`);
  }

  function selectDailyBrief(next: DailyBrief) {
    const params = new URLSearchParams();
    params.set("view", "daily");
    if (next === "close") params.set("brief", "close");
    router.replace(`/?${params.toString()}`);
  }

  async function logout() {
    if (loggingOut) {
      return;
    }
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Still redirect so the user is not left on a protected page.
    }
    window.location.href = "/login";
  }

  const wide =
    market === "tw" &&
    (twView === "theme" ||
      twView === "portfolio" ||
      twView === "weekly" ||
      twView === "daily" ||
      twView === "paper");

  return (
    <div className="min-h-full bg-zinc-100 dark:bg-zinc-950">
      {loggingOut ? <LoadingOverlay label="登出中，正在返回登入頁…" /> : null}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Stock Report Hub
              </p>
              <h1 className="text-xl font-semibold">投資研究首頁</h1>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              disabled={loggingOut}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              {loggingOut ? "登出中…" : "登出"}
            </button>
          </div>

          <nav
            aria-label="市場分類"
            className="inline-flex w-fit rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900"
          >
            <button
              type="button"
              onClick={() => selectMarket("tw")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tabClass(market === "tw")}`}
            >
              台股
            </button>
            <button
              type="button"
              onClick={() => selectMarket("us")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tabClass(market === "us")}`}
            >
              美股
            </button>
          </nav>

          {market === "tw" ? (
            <nav
              aria-label="台股功能分類"
              className="inline-flex w-fit flex-wrap rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900"
            >
              <button
                type="button"
                onClick={() => selectTwView("chip")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tabClass(twView === "chip")}`}
              >
                台股籌碼報告
              </button>
              <button
                type="button"
                onClick={() => selectTwView("portfolio")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tabClass(twView === "portfolio")}`}
              >
                選股組合建議
              </button>
              <button
                type="button"
                onClick={() => selectTwView("theme")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tabClass(twView === "theme")}`}
              >
                題材
              </button>
              <button
                type="button"
                onClick={() => selectTwView("weekly")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tabClass(twView === "weekly")}`}
              >
                市場週報
              </button>
              <button
                type="button"
                onClick={() => selectTwView("daily")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tabClass(twView === "daily")}`}
              >
                日報
              </button>
              <button
                type="button"
                onClick={() => selectTwView("paper")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tabClass(twView === "paper")}`}
              >
                模擬交易
              </button>
            </nav>
          ) : null}

          {market === "tw" && twView === "theme" && themeNav.scope === "theme" ? (
            <nav
              aria-label="題材鏡頭"
              className="inline-flex w-fit flex-wrap rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900"
            >
              {THEME_LENSES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  title={item.title}
                  onClick={() => selectThemeLens(item.id)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tabClass(themeNav.lens === item.id)}`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          ) : null}

          {market === "tw" && twView === "daily" ? (
            <nav
              aria-label="日報種類"
              className="inline-flex w-fit flex-wrap rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900"
            >
              <button
                type="button"
                onClick={() => selectDailyBrief("open")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tabClass(dailyBrief === "open")}`}
              >
                開盤前日報
              </button>
              <button
                type="button"
                onClick={() => selectDailyBrief("close")}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tabClass(dailyBrief === "close")}`}
              >
                收盤日報
              </button>
            </nav>
          ) : null}
        </div>
      </header>

      <main
        className={`mx-auto w-full px-6 py-8 ${wide ? "max-w-6xl" : "max-w-5xl"}`}
      >
        {market === "us" ? (
          <UsStockDashboard />
        ) : twView === "portfolio" ? (
          <TwPortfolioDashboard />
        ) : twView === "theme" ? (
          <ThemeWorkspace />
        ) : twView === "weekly" ? (
          <TwMarketWeeklyDashboard />
        ) : twView === "daily" ? (
          dailyBrief === "close" ? <TwMarketCloseDashboard /> : <TwMarketDailyDashboard />
        ) : twView === "paper" ? (
          <PaperTradingDashboard />
        ) : (
          <TwStockDashboard />
        )}
      </main>
    </div>
  );
}
