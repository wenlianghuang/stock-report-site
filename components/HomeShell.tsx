"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { TwStockDashboard } from "@/components/TwStockDashboard";
import { UsStockDashboard } from "@/components/UsStockDashboard";

type MarketTab = "tw" | "us";

function tabClass(active: boolean): string {
  return active
    ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
    : "text-zinc-600 hover:bg-white hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100";
}

export function HomeShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const market: MarketTab = searchParams.get("market") === "us" ? "us" : "tw";
  const [loggingOut, setLoggingOut] = useState(false);

  function selectMarket(next: MarketTab) {
    router.replace(next === "us" ? "/?market=us" : "/");
  }

  async function logout() {
    if (loggingOut) {
      return;
    }
    // Keep the overlay up until the browser unloads this page for /login.
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Still redirect so the user is not left on a protected page.
    }
    window.location.href = "/login";
  }

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
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-8">
        {market === "tw" ? <TwStockDashboard /> : <UsStockDashboard />}
      </main>
    </div>
  );
}
