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

function AlignChip({ label }: { label?: string | null }) {
  if (!label || label === "unavailable") {
    return <span className="text-zinc-400">—</span>;
  }
  const tone =
    label === "一致"
      ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
      : label === "背離"
        ? "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
}

export function TwMarketWeeklyDashboard() {
  const [windowInfo, setWindowInfo] = useState<ResolveWindow | null>(null);
  const [records, setRecords] = useState<MarketWeeklyRecord[]>([]);
  const [active, setActive] = useState<MarketWeeklyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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

  async function onDelete(record: MarketWeeklyRecord) {
    const label =
      record.weekStart && record.weekEnd
        ? `${record.weekStart}～${record.weekEnd}`
        : "此筆";
    if (!window.confirm(`確定要刪除 ${label} 的市場週報嗎？`)) {
      return;
    }

    setError(null);
    setDeletingId(record.id);
    try {
      const response = await fetch(`/api/market-weekly/${record.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "刪除失敗");
      }
      setRecords((prev) => {
        const next = prev.filter((item) => item.id !== record.id);
        return next;
      });
      setActive((current) => {
        if (current?.id !== record.id) return current;
        const remaining = records.filter((item) => item.id !== record.id);
        return remaining[0] ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "刪除失敗");
    } finally {
      setDeletingId(null);
    }
  }

  const facts: MarketWeekFacts | undefined = active?.factsJson;
  const summary: MarketWeekSummary | undefined = active?.summaryJson;
  const marketReturn =
    summary?.market?.week_return_pct ?? facts?.market?.week_return_pct;
  const us = summary?.us ?? facts?.us;
  const ixicRet =
    us?.ixic_week_return_pct ?? us?.indices?.IXIC?.week_return_pct ?? null;
  const soxRet =
    us?.sox_week_return_pct ?? us?.indices?.SOX?.week_return_pct ?? null;
  const ixicAlign =
    us?.ixic_vs_taiex ?? us?.alignment?.ixic_vs_taiex ?? null;
  const soxAlign =
    us?.sox_vs_tw_semi ?? us?.alignment?.sox_vs_tw_semi ?? null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              台股市場週報
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              大盤 + 權值結構 + 證交所類股強弱 + 那指／費半對照。週五 17:30（台北）前對應上週，之後才是本週。
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
                <h3 className="text-sm font-semibold">美股週對照</h3>
                {us?.available === false && !ixicRet && !soxRet ? (
                  <p className="mt-3 text-sm text-zinc-500">本週美股指數資料不足</p>
                ) : (
                  <dl className="mt-3 space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-zinc-600 dark:text-zinc-400">那斯達克</dt>
                      <dd className="flex items-center gap-2 tabular-nums">
                        {formatPct(typeof ixicRet === "number" ? ixicRet : null)}
                        <AlignChip label={ixicAlign} />
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-zinc-600 dark:text-zinc-400">費半</dt>
                      <dd className="flex items-center gap-2 tabular-nums">
                        {formatPct(typeof soxRet === "number" ? soxRet : null)}
                        <AlignChip label={soxAlign} />
                      </dd>
                    </div>
                    <p className="pt-1 text-xs text-zinc-500">
                      chip：那指 vs 大盤／費半 vs 半導體類
                    </p>
                  </dl>
                )}
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-2">
                <h3 className="text-sm font-semibold">歷史週報</h3>
                <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-sm">
                  {records.map((item) => (
                    <li
                      key={item.id}
                      className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
                        active.id === item.id
                          ? "bg-zinc-100 dark:bg-zinc-800"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setActive(item)}
                        className="min-w-0 flex-1 text-left"
                      >
                        {item.weekStart}～{item.weekEnd}{" "}
                        <span className="text-zinc-500">({item.status})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDelete(item)}
                        disabled={deletingId === item.id || generating}
                        className="shrink-0 text-xs text-red-600 hover:text-red-700 disabled:opacity-60 dark:text-red-400 dark:hover:text-red-300"
                      >
                        {deletingId === item.id ? "刪除中…" : "刪除"}
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

          {(() => {
            const fromSummary = summary?.news_titles ?? [];
            const fromFacts = facts?.news_titles ?? [];
            const fromItems = (
              summary?.news_items ??
              facts?.news_items ??
              []
            )
              .map((item) => item.title)
              .filter((title): title is string => Boolean(title));
            const newsTitles =
              fromSummary.length > 0
                ? fromSummary
                : fromFacts.length > 0
                  ? fromFacts
                  : fromItems;
            if (!active || newsTitles.length === 0) {
              return null;
            }
            return (
              <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="text-sm font-semibold">本週對帳新聞</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  交叉解讀應原文引用下列標題，並以大盤／權值／類股數字判定一致或背離。
                </p>
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                  {newsTitles.slice(0, 12).map((title) => (
                    <li key={title}>{title}</li>
                  ))}
                </ul>
                {summary?.cross ? (
                  <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {summary.cross}
                  </p>
                ) : null}
              </section>
            );
          })()}

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
