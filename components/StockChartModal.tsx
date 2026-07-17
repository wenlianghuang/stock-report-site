"use client";

import { useEffect, useState } from "react";
import { ReportChartsPanel } from "@/components/ReportChartsPanel";
import type { StockChart } from "@/lib/agent-client";

type StockChartModalProps = {
  stockId: string;
  stockName?: string;
  tradeDate?: string;
  onClose: () => void;
};

type ChartResponse = {
  chart?: StockChart;
  error?: string;
};

export function StockChartModal({
  stockId,
  stockName,
  tradeDate,
  onClose,
}: StockChartModalProps) {
  const [chart, setChart] = useState<StockChart | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setChart(null);

    async function load() {
      try {
        const params = new URLSearchParams();
        if (tradeDate) {
          params.set("date", tradeDate);
        }
        const query = params.toString();
        const response = await fetch(
          `/api/stocks/${encodeURIComponent(stockId)}/chart${
            query ? `?${query}` : ""
          }`,
          { cache: "no-store" },
        );
        const data = (await response.json()) as ChartResponse;
        if (cancelled) {
          return;
        }
        if (!response.ok || !data.chart) {
          setError(data.error ?? "讀取圖表失敗");
          return;
        }
        setChart(data.chart);
      } catch {
        if (!cancelled) {
          setError("無法連線到 API");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [stockId, tradeDate]);

  const title = stockName ? `${stockName}（${stockId}）` : stockId;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            {chart?.tradeDate ? (
              <p className="text-xs text-zinc-500">資料日期 {chart.tradeDate}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="關閉"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-zinc-500">圖表載入中…</p>
        ) : error ? (
          <p className="py-10 text-center text-sm text-zinc-600 dark:text-zinc-400">
            {error}
          </p>
        ) : chart && chart.history.length > 0 ? (
          <ReportChartsPanel
            facts={chart.facts ?? { stock_id: chart.stockId }}
            history={chart.history}
          />
        ) : (
          <p className="py-10 text-center text-sm text-zinc-600 dark:text-zinc-400">
            尚無圖表資料。
          </p>
        )}

        <p className="mt-4 text-xs text-zinc-400">
          本內容僅供教育參考、非投資建議，投資有風險。
        </p>
      </div>
    </div>
  );
}
