"use client";

import { useCallback, useEffect, useState } from "react";
import type { UsIndexSnapshot } from "@/lib/us-indices";

const POLL_INTERVAL_MS = 60_000;

function formatPrice(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatChangePct(value: number | null): string {
  if (value === null) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatMarketTime(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "America/New_York",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function changeClass(changePct: number | null): string {
  if (changePct === null || changePct === 0) {
    return "text-zinc-600 dark:text-zinc-400";
  }
  return changePct > 0
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-600 dark:text-red-400";
}

function IndexCard({ index }: { index: UsIndexSnapshot }) {
  const marketTime = formatMarketTime(index.marketTime);

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {index.symbol}
          </p>
          <h3 className="mt-1 text-base font-semibold">{index.name}</h3>
        </div>
        {marketTime ? (
          <p className="shrink-0 text-right text-xs text-zinc-400 dark:text-zinc-500">
            ET {marketTime}
          </p>
        ) : null}
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight">
        {formatPrice(index.price)}
      </p>
      <p className={`mt-1 text-sm font-medium ${changeClass(index.changePct)}`}>
        {formatChangePct(index.changePct)}
      </p>
    </article>
  );
}

function IndexSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-2 h-5 w-28 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-4 h-9 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-2 h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}

export function UsStockDashboard() {
  const [indices, setIndices] = useState<UsIndexSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadIndices = useCallback(async () => {
    try {
      const response = await fetch("/api/us-indices");
      const payload = (await response.json()) as {
        indices?: UsIndexSnapshot[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "無法取得美股指數");
      }
      setIndices(payload.indices ?? []);
      setError(null);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error ? fetchError.message : "無法取得美股指數",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadIndices();

    const timer = window.setInterval(() => {
      void loadIndices();
    }, POLL_INTERVAL_MS);

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        void loadIndices();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadIndices]);

  return (
    <div className="space-y-6">
      <section aria-label="美股指數">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">美股指數</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              資料來源 Yahoo Finance，盤中可能有約 15 分鐘延遲
            </p>
          </div>
          {!loading && error ? (
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                void loadIndices();
              }}
              className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              重試
            </button>
          ) : null}
        </div>

        {error && !loading && indices.length === 0 ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {loading && indices.length === 0
            ? Array.from({ length: 3 }, (_, index) => (
                <IndexSkeleton key={index} />
              ))
            : indices.map((index) => (
                <IndexCard key={index.symbol} index={index} />
              ))}
        </div>
      </section>

      <section className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-12 text-center dark:border-zinc-700 dark:bg-zinc-950">
        <div className="mb-4 inline-flex rounded-full bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          施工中
        </div>
        <h3 className="text-xl font-semibold">美股專區</h3>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          美股科技新聞日報與個股分析功能正在建置中，完成後會在此提供報告與更多內容。
        </p>
      </section>
    </div>
  );
}
