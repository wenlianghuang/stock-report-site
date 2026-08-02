"use client";

import { useCallback, useEffect, useState } from "react";
import { MarkdownReport } from "@/components/MarkdownReport";
import type {
  MarketWeekFacts,
  MarketWeekSummary,
  MarketWeeklyRecord,
} from "@/lib/types";

type ResolveWindow = {
  week_start: string;
  week_end: string;
  trading_days: string[];
  cutover_applied: boolean;
  resolved_as_of: string;
};

function formatPct(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "—";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

function RankTable({
  title,
  rows,
  kind,
}: {
  title: string;
  rows: Array<{
    name?: string;
    stock_id?: string;
    week_return_pct?: number | null;
    excess_vs_taiex_pct?: number | null;
  }>;
  kind: "leader" | "sector";
}) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h3>
        <p className="mt-2 text-sm text-zinc-500">尚無資料</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h3>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs text-zinc-500">
            <tr>
              <th className="pb-2 pr-3 font-medium">
                {kind === "leader" ? "標的" : "類股"}
              </th>
              <th className="pb-2 pr-3 font-medium">週報酬</th>
              <th className="pb-2 font-medium">相對大盤</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.stock_id ?? ""}${row.name}`}
                className="border-t border-zinc-100 dark:border-zinc-800"
              >
                <td className="py-2 pr-3 text-zinc-800 dark:text-zinc-200">
                  {kind === "leader"
                    ? `${row.name ?? ""}（${row.stock_id ?? ""}）`
                    : row.name}
                </td>
                <td className="py-2 pr-3 tabular-nums">
                  {formatPct(row.week_return_pct)}
                </td>
                <td className="py-2 tabular-nums">
                  {formatPct(row.excess_vs_taiex_pct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TwMarketWeeklyDashboard() {
  const [windowInfo, setWindowInfo] = useState<ResolveWindow | null>(null);
  const [records, setRecords] = useState<MarketWeeklyRecord[]>([]);
  const [active, setActive] = useState<MarketWeeklyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/market-weekly");
      const payload = (await response.json()) as {
        window?: ResolveWindow | null;
        records?: MarketWeeklyRecord[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "無法載入市場週報");
      }
      setWindowInfo(payload.window ?? null);
      const list = payload.records ?? [];
      setRecords(list);
      setActive((prev) => {
        if (prev) {
          const refreshed = list.find((item) => item.id === prev.id);
          return refreshed ?? list[0] ?? null;
        }
        return list[0] ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入失敗");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  async function pollRecord(id: string) {
    for (let i = 0; i < 90; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 4000));
      const response = await fetch(`/api/market-weekly/${id}`);
      const payload = (await response.json()) as {
        record?: MarketWeeklyRecord;
        error?: string;
      };
      if (!response.ok || !payload.record) {
        continue;
      }
      const record = payload.record;
      setRecords((prev) => {
        const others = prev.filter((item) => item.id !== record.id);
        return [record, ...others];
      });
      setActive(record);
      if (record.status === "done" || record.status === "failed") {
        return;
      }
    }
  }

  async function generate(force = false) {
    if (generating) return;
    setGenerating(true);
    setError(null);
    try {
      const response = await fetch("/api/market-weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const payload = (await response.json()) as {
        record?: MarketWeeklyRecord;
        error?: string;
      };
      if (!response.ok || !payload.record) {
        throw new Error(payload.error || "產生失敗");
      }
      const record = payload.record;
      setRecords((prev) => [record, ...prev.filter((item) => item.id !== record.id)]);
      setActive(record);
      if (record.status !== "done" && record.status !== "failed") {
        await pollRecord(record.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "產生失敗");
    } finally {
      setGenerating(false);
    }
  }

  const facts: MarketWeekFacts | undefined = active?.factsJson;
  const summary: MarketWeekSummary | undefined = active?.summaryJson;
  const marketReturn =
    summary?.market?.week_return_pct ?? facts?.market?.week_return_pct;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              台股市場週報
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              大盤 + 權值結構 + 證交所類股強弱。週五 17:30（台北）前對應上週，之後才是本週。
            </p>
            {windowInfo ? (
              <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
                目前將產生：
                <span className="font-medium">
                  {" "}
                  {windowInfo.week_start}～{windowInfo.week_end}
                </span>
                <span className="text-zinc-500">
                  {" "}
                  （{windowInfo.trading_days.length} 個交易日）
                </span>
              </p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void generate(false)}
              disabled={generating}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {generating ? "產生中…" : "產生週報"}
            </button>
            <button
              type="button"
              onClick={() => void generate(true)}
              disabled={generating}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200"
            >
              強制重跑
            </button>
          </div>
        </div>
        {error ? (
          <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>
        ) : null}
      </section>

      {loading ? (
        <p className="text-sm text-zinc-500">載入中…</p>
      ) : (
        <>
          {active ? (
            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="text-sm font-semibold">大盤摘要</h3>
                <p className="mt-2 text-2xl font-semibold tabular-nums">
                  {formatPct(
                    typeof marketReturn === "number" ? marketReturn : null,
                  )}
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  {active.weekStart}～{active.weekEnd} · 狀態 {active.status}
                </p>
                {summary?.market?.headline ? (
                  <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {summary.market.headline}
                  </p>
                ) : null}
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="text-sm font-semibold">歷史週報</h3>
                <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-sm">
                  {records.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setActive(item)}
                        className={`w-full rounded-md px-2 py-1.5 text-left ${
                          active.id === item.id
                            ? "bg-zinc-100 dark:bg-zinc-800"
                            : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                        }`}
                      >
                        {item.weekStart}～{item.weekEnd}{" "}
                        <span className="text-zinc-500">({item.status})</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <RankTable
                title="權值／廣基相對強勢"
                kind="leader"
                rows={facts?.leaders?.top ?? summary?.leaders?.top ?? []}
              />
              <RankTable
                title="權值／廣基相對弱勢"
                kind="leader"
                rows={facts?.leaders?.bottom ?? summary?.leaders?.bottom ?? []}
              />
              <RankTable
                title="強勢類股（TWSE）"
                kind="sector"
                rows={facts?.sectors?.strong ?? summary?.sectors?.strong ?? []}
              />
              <RankTable
                title="弱勢類股（TWSE）"
                kind="sector"
                rows={facts?.sectors?.weak ?? summary?.sectors?.weak ?? []}
              />
            </section>
          ) : (
            <p className="text-sm text-zinc-500">尚未有市場週報，請先產生一週。</p>
          )}

          {active?.markdown ? (
            <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="mb-3 text-sm font-semibold">完整週報</h3>
              <MarkdownReport markdown={active.markdown} />
            </section>
          ) : null}

          {active?.status === "failed" && active.error ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">
              失敗：{active.error}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
