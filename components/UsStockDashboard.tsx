"use client";

import { useCallback, useEffect, useState } from "react";
import { UsIndexIntradayChart } from "@/components/UsIndexIntradayChart";
import type { UsIndexSnapshot } from "@/lib/us-indices";

const POLL_INTERVAL_MS = 60_000;
const TIME_RANGES = ["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "All"] as const;

function formatPrice(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatChange(index: UsIndexSnapshot): string {
  if (index.changeAmount === null || index.changePct === null) {
    return "—";
  }
  const amountSign = index.changeAmount >= 0 ? "+" : "";
  const pctSign = index.changePct >= 0 ? "+" : "";
  return `${amountSign}${index.changeAmount.toFixed(2)} (${pctSign}${index.changePct.toFixed(2)}%)`;
}

function formatPctOnly(changePct: number | null): string {
  if (changePct === null) return "—";
  const sign = changePct >= 0 ? "+" : "";
  return `${sign}${changePct.toFixed(2)}%`;
}

function formatMarketStatus(index: UsIndexSnapshot): string | null {
  if (!index.marketTime) return null;
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    second: index.sessionOpen ? undefined : "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).format(new Date(index.marketTime));
  return index.sessionOpen ? `盤中 · ${formatted}` : `收盤 · ${formatted}`;
}

function changeClass(changePct: number | null): string {
  if (changePct === null || changePct === 0) {
    return "text-zinc-600 dark:text-zinc-400";
  }
  return changePct > 0
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-red-600 dark:text-red-400";
}

function IndexSelector({
  indices,
  selectedSymbol,
  onSelect,
}: {
  indices: UsIndexSnapshot[];
  selectedSymbol: string;
  onSelect: (symbol: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {indices.map((index) => {
        const selected = index.symbol === selectedSymbol;
        return (
          <button
            key={index.symbol}
            type="button"
            onClick={() => onSelect(index.symbol)}
            className={`rounded-xl border px-4 py-3 text-left transition ${
              selected
                ? "border-sky-300 bg-sky-50 ring-1 ring-sky-200 dark:border-sky-800 dark:bg-sky-950/40 dark:ring-sky-900"
                : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
            }`}
          >
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {index.name}
            </p>
            <p className="mt-0.5 text-xs text-zinc-400">{index.symbol}</p>
            <p className="mt-2 text-lg font-semibold tracking-tight">
              {formatPrice(index.price)}
            </p>
            <p className={`mt-0.5 text-sm font-medium ${changeClass(index.changePct)}`}>
              {formatPctOnly(index.changePct)}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function IndexDetail({ index }: { index: UsIndexSnapshot }) {
  const marketStatus = formatMarketStatus(index);
  const isUp =
    index.changeAmount !== null
      ? index.changeAmount >= 0
      : index.changePct !== null
        ? index.changePct >= 0
        : true;

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {index.name}
            <span className="ml-2 text-base font-normal text-zinc-500">
              ({index.symbol})
            </span>
          </h3>
          {marketStatus ? (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {marketStatus}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-1">
        <p className="text-4xl font-semibold tracking-tight sm:text-5xl">
          {formatPrice(index.price)}
        </p>
        <p className={`pb-1 text-lg font-medium sm:text-xl ${changeClass(index.changePct)}`}>
          {formatChange(index)}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-1">
        {TIME_RANGES.map((range) => {
          const active = range === "1D";
          return (
            <button
              key={range}
              type="button"
              disabled={!active}
              className={`rounded-md px-2.5 py-1 text-sm font-medium transition ${
                active
                  ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200"
                  : "cursor-not-allowed text-zinc-400 dark:text-zinc-600"
              }`}
              title={active ? undefined : "其他時間區間即將推出"}
            >
              {range}
            </button>
          );
        })}
      </div>

      <div className="mt-4 border-t border-zinc-100 pt-4 dark:border-zinc-800">
        <UsIndexIntradayChart
          symbol={index.symbol}
          points={index.points}
          previousClose={index.previousClose}
          isUp={isUp}
        />
      </div>

      {index.previousClose !== null ? (
        <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
          紅色虛線為前一日收盤價 {formatPrice(index.previousClose)} · 09:30–16:00 ET 盤中走勢
        </p>
      ) : (
        <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
          09:30–16:00 ET 盤中走勢（不含盤前盤後）
        </p>
      )}
    </article>
  );
}

function IndexSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="animate-pulse rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="mt-2 h-3 w-12 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="mt-3 h-6 w-28 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="mt-2 h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
        ))}
      </div>
      <div className="animate-pulse rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="h-7 w-56 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-3 h-4 w-40 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-5 h-12 w-64 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-5 h-8 w-72 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="mt-6 h-[360px] rounded-xl bg-zinc-100 dark:bg-zinc-900" />
      </div>
    </div>
  );
}

export function UsStockDashboard() {
  const [indices, setIndices] = useState<UsIndexSnapshot[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>("^DJI");
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
      const nextIndices = payload.indices ?? [];
      setIndices(nextIndices);
      setSelectedSymbol((current) =>
        nextIndices.some((index) => index.symbol === current)
          ? current
          : (nextIndices[0]?.symbol ?? "^DJI"),
      );
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

  const selectedIndex =
    indices.find((index) => index.symbol === selectedSymbol) ?? indices[0] ?? null;

  return (
    <div className="space-y-6">
      <section aria-label="美股指數">
        <div className="mb-4 flex items-end justify-between gap-4">
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

        {loading && indices.length === 0 ? (
          <IndexSkeleton />
        ) : indices.length > 0 ? (
          <div className="space-y-4">
            <IndexSelector
              indices={indices}
              selectedSymbol={selectedSymbol}
              onSelect={setSelectedSymbol}
            />
            {selectedIndex ? <IndexDetail index={selectedIndex} /> : null}
          </div>
        ) : null}
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
