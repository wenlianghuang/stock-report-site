"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MarkdownReport } from "@/components/MarkdownReport";
import { CHART_COLORS } from "@/lib/chart-colors";
import type {
  MarketWeekFacts,
  MarketWeekLeader,
  MarketWeekSector,
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

type RankRow = {
  name?: string;
  stock_id?: string;
  week_return_pct?: number | null;
  excess_vs_taiex_pct?: number | null;
};

function formatPct(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "—";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

function formatClose(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("zh-TW", { maximumFractionDigits: 2 });
}

/** Taiwan market convention: 漲紅跌綠 */
function pctClass(value?: number | null) {
  if (value == null || Number.isNaN(value) || value === 0) {
    return "text-zinc-700 dark:text-zinc-300";
  }
  return value > 0
    ? "text-red-600 dark:text-red-400"
    : "text-emerald-600 dark:text-emerald-400";
}

function barFill(value: number) {
  if (value > 0) return CHART_COLORS.up;
  if (value < 0) return CHART_COLORS.down;
  return "#a1a1aa";
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

function WeekRangeBar({
  pct,
  low,
  high,
  last,
}: {
  pct?: number | null;
  low?: number | null;
  high?: number | null;
  last?: number | null;
}) {
  const clamped =
    pct == null || Number.isNaN(pct) ? null : Math.min(100, Math.max(0, pct));
  return (
    <div className="mt-4">
      <div className="mb-1 flex justify-between text-xs text-zinc-500">
        <span>週低 {formatClose(low)}</span>
        <span>收盤位於區間 {clamped == null ? "—" : `${clamped.toFixed(1)}%`}</span>
        <span>週高 {formatClose(high)}</span>
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        {clamped != null ? (
          <div
            className="absolute top-0 h-full w-1 rounded-full bg-zinc-900 dark:bg-zinc-100"
            style={{ left: `calc(${clamped}% - 2px)` }}
            title={`收盤 ${formatClose(last)}`}
          />
        ) : null}
        <div
          className="h-full rounded-full bg-zinc-300/80 dark:bg-zinc-600/80"
          style={{ width: clamped == null ? "0%" : `${clamped}%` }}
        />
      </div>
    </div>
  );
}

function ExcessMiniBar({ value }: { value?: number | null }) {
  if (value == null || Number.isNaN(value)) {
    return <span className="text-zinc-400">—</span>;
  }
  // Each side of center is 50% of the track; never overflow into the label.
  const halfWidthPct = Math.min(Math.abs(value) / 12, 1) * 50;
  return (
    <div className="flex min-w-[10rem] items-center gap-2.5">
      <span
        className={`w-[4.5rem] shrink-0 text-right tabular-nums ${pctClass(value)}`}
      >
        {formatPct(value)}
      </span>
      <div className="relative h-1.5 min-w-[4.5rem] flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        {value >= 0 ? (
          <div
            className="absolute top-0 left-1/2 h-full rounded-r-full"
            style={{
              width: `${halfWidthPct}%`,
              backgroundColor: barFill(value),
            }}
          />
        ) : (
          <div
            className="absolute top-0 right-1/2 h-full rounded-l-full"
            style={{
              width: `${halfWidthPct}%`,
              backgroundColor: barFill(value),
            }}
          />
        )}
        <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-px bg-zinc-300 dark:bg-zinc-600" />
      </div>
    </div>
  );
}

function RankTable({
  title,
  rows,
  kind,
}: {
  title: string;
  rows: RankRow[];
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
                <td
                  className={`py-2 pr-3 tabular-nums ${pctClass(row.week_return_pct)}`}
                >
                  {formatPct(row.week_return_pct)}
                </td>
                <td className="py-2">
                  <ExcessMiniBar value={row.excess_vs_taiex_pct} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CrossMarketChart({
  items,
}: {
  items: Array<{ name: string; value: number | null }>;
}) {
  const data = items.filter(
    (item): item is { name: string; value: number } =>
      item.value != null && !Number.isNaN(item.value),
  );
  if (!data.length) {
    return <p className="text-sm text-zinc-500">尚無指數週報酬可繪圖</p>;
  }
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: "#71717a" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#71717a" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}%`}
            width={40}
          />
          <Tooltip
            formatter={(value) => formatPct(typeof value === "number" ? value : null)}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e4e4e7",
              fontSize: 12,
            }}
          />
          <ReferenceLine y={0} stroke="#a1a1aa" />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {data.map((entry) => (
              <Cell key={entry.name} fill={barFill(entry.value)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ExcessBarChart({
  title,
  rows,
  labelKey,
}: {
  title: string;
  rows: Array<{ label: string; excess: number }>;
  labelKey?: string;
}) {
  const data = useMemo(
    () =>
      [...rows].sort((a, b) => a.excess - b.excess),
    [rows],
  );
  if (!data.length) return null;
  const height = Math.max(180, data.length * 28 + 40);
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h3>
      <p className="mt-1 text-xs text-zinc-500">相對大盤超額（百分點）</p>
      <div className="mt-2 w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "#71717a" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={96}
              tick={{ fontSize: 11, fill: "#71717a" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value) => formatPct(typeof value === "number" ? value : null)}
              labelFormatter={(label) => String(label)}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid #e4e4e7",
                fontSize: 12,
              }}
            />
            <ReferenceLine x={0} stroke="#a1a1aa" />
            <Bar dataKey="excess" name={labelKey ?? "超額"} radius={[0, 4, 4, 0]} maxBarSize={14}>
              {data.map((entry) => (
                <Cell key={entry.label} fill={barFill(entry.excess)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function toLeaderExcessRows(rows: MarketWeekLeader[]): Array<{ label: string; excess: number }> {
  return rows
    .filter((r) => typeof r.excess_vs_taiex_pct === "number")
    .map((r) => ({
      label: r.stock_id ? `${r.name}` : r.name,
      excess: r.excess_vs_taiex_pct as number,
    }));
}

function toSectorExcessRows(rows: MarketWeekSector[]): Array<{ label: string; excess: number }> {
  return rows
    .filter((r) => typeof r.excess_vs_taiex_pct === "number")
    .map((r) => ({
      label: (r.name || "").replace(/類指數$/, ""),
      excess: r.excess_vs_taiex_pct as number,
    }));
}

export function TwMarketWeeklyDashboard() {
  const [windowInfo, setWindowInfo] = useState<ResolveWindow | null>(null);
  const [records, setRecords] = useState<MarketWeeklyRecord[]>([]);
  const [active, setActive] = useState<MarketWeeklyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMarkdown, setShowMarkdown] = useState(false);
  const [showNews, setShowNews] = useState(false);

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

  useEffect(() => {
    setShowMarkdown(false);
    setShowNews(false);
  }, [active?.id]);

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
      setRecords((prev) => prev.filter((item) => item.id !== record.id));
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
  const market = facts?.market;
  const marketReturn =
    summary?.market?.week_return_pct ?? market?.week_return_pct ?? null;
  const lastClose = summary?.market?.last_close ?? market?.last_close ?? null;
  const rangePct = market?.close_in_week_range_pct ?? null;
  const weekLow = market?.week_low ?? null;
  const weekHigh = market?.week_high ?? null;

  const us = summary?.us ?? facts?.us;
  const ixicRet =
    us?.ixic_week_return_pct ?? us?.indices?.IXIC?.week_return_pct ?? null;
  const soxRet =
    us?.sox_week_return_pct ?? us?.indices?.SOX?.week_return_pct ?? null;
  const twSemi =
    us?.tw_semi_week_return_pct ??
    facts?.sectors?.semiconductor_week_return_pct ??
    null;
  const ixicAlign =
    us?.ixic_vs_taiex ?? us?.alignment?.ixic_vs_taiex ?? null;
  const soxAlign =
    us?.sox_vs_tw_semi ?? us?.alignment?.sox_vs_tw_semi ?? null;
  const gapIxic = us?.gaps?.ixic_minus_taiex_pct ?? null;
  const gapSox = us?.gaps?.sox_minus_tw_semi_pct ?? null;

  const leadersTop = facts?.leaders?.top ?? summary?.leaders?.top ?? [];
  const leadersBottom = facts?.leaders?.bottom ?? summary?.leaders?.bottom ?? [];
  const sectorsStrong = facts?.sectors?.strong ?? summary?.sectors?.strong ?? [];
  const sectorsWeak = facts?.sectors?.weak ?? summary?.sectors?.weak ?? [];

  const leaderExcess = useMemo(
    () => [...toLeaderExcessRows(leadersTop), ...toLeaderExcessRows(leadersBottom)],
    [leadersTop, leadersBottom],
  );
  const sectorExcess = useMemo(
    () => [...toSectorExcessRows(sectorsStrong), ...toSectorExcessRows(sectorsWeak)],
    [sectorsStrong, sectorsWeak],
  );

  const newsTitles = useMemo(() => {
    const fromSummary = summary?.news_titles ?? [];
    const fromFacts = facts?.news_titles ?? [];
    const fromItems = (summary?.news_items ?? facts?.news_items ?? [])
      .map((item) => item.title)
      .filter((title): title is string => Boolean(title));
    if (fromSummary.length > 0) return fromSummary;
    if (fromFacts.length > 0) return fromFacts;
    return fromItems;
  }, [summary, facts]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              台股市場週報
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              以大盤、權值、類股與那指／費半數字對照為主。週五 17:30（台北）前對應上週。
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
            <>
              <section className="grid gap-4 lg:grid-cols-3">
                <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">大盤</h3>
                      <p className="mt-1 text-sm text-zinc-500">
                        {active.weekStart}～{active.weekEnd} · {active.status}
                      </p>
                    </div>
                    <p
                      className={`text-3xl font-semibold tabular-nums ${pctClass(marketReturn)}`}
                    >
                      {formatPct(
                        typeof marketReturn === "number" ? marketReturn : null,
                      )}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-zinc-600 dark:text-zinc-400">
                    <span>
                      收盤{" "}
                      <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                        {formatClose(typeof lastClose === "number" ? lastClose : null)}
                      </span>
                    </span>
                  </div>
                  <WeekRangeBar
                    pct={typeof rangePct === "number" ? rangePct : null}
                    low={typeof weekLow === "number" ? weekLow : null}
                    high={typeof weekHigh === "number" ? weekHigh : null}
                    last={typeof lastClose === "number" ? lastClose : null}
                  />
                </div>

                <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
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
              </section>

              <section className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="text-sm font-semibold">台美週報酬對照</h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    加權／那指／費半／半導體類 · 漲紅跌綠
                  </p>
                  <div className="mt-3">
                    <CrossMarketChart
                      items={[
                        { name: "加權", value: typeof marketReturn === "number" ? marketReturn : null },
                        { name: "那指", value: typeof ixicRet === "number" ? ixicRet : null },
                        { name: "費半", value: typeof soxRet === "number" ? soxRet : null },
                        { name: "半導體", value: typeof twSemi === "number" ? twSemi : null },
                      ]}
                    />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60">
                      <dt className="text-zinc-500">那指 vs 大盤</dt>
                      <dd className="flex items-center gap-2">
                        <span className={`tabular-nums ${pctClass(gapIxic)}`}>
                          {formatPct(typeof gapIxic === "number" ? gapIxic : null)}
                        </span>
                        <AlignChip label={ixicAlign} />
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/60">
                      <dt className="text-zinc-500">費半 vs 半導體</dt>
                      <dd className="flex items-center gap-2">
                        <span className={`tabular-nums ${pctClass(gapSox)}`}>
                          {formatPct(typeof gapSox === "number" ? gapSox : null)}
                        </span>
                        <AlignChip label={soxAlign} />
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="grid gap-4">
                  <ExcessBarChart title="權值／廣基超額" rows={leaderExcess} />
                  <ExcessBarChart title="類股超額（強弱榜）" rows={sectorExcess} />
                </div>
              </section>

              <section className="grid gap-4 lg:grid-cols-2">
                <RankTable title="權值／廣基相對強勢" kind="leader" rows={leadersTop} />
                <RankTable title="權值／廣基相對弱勢" kind="leader" rows={leadersBottom} />
                <RankTable title="強勢類股（TWSE）" kind="sector" rows={sectorsStrong} />
                <RankTable title="弱勢類股（TWSE）" kind="sector" rows={sectorsWeak} />
              </section>

              {newsTitles.length > 0 ? (
                <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <button
                    type="button"
                    onClick={() => setShowNews((v) => !v)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <h3 className="text-sm font-semibold">
                      本週對帳新聞（{Math.min(newsTitles.length, 12)}）
                    </h3>
                    <span className="text-xs text-zinc-500">
                      {showNews ? "收合" : "展開"}
                    </span>
                  </button>
                  {showNews ? (
                    <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                      {newsTitles.slice(0, 12).map((title) => (
                        <li key={title}>{title}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ) : null}

              {active.markdown ? (
                <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <button
                    type="button"
                    onClick={() => setShowMarkdown((v) => !v)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <h3 className="text-sm font-semibold">文字週報（選讀）</h3>
                    <span className="text-xs text-zinc-500">
                      {showMarkdown ? "收合" : "展開"}
                    </span>
                  </button>
                  {showMarkdown ? (
                    <div className="mt-3">
                      <MarkdownReport markdown={active.markdown} />
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-zinc-500">
                      數字與圖表已涵蓋本週結構；文字敘事預設收合。
                    </p>
                  )}
                </section>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-zinc-500">尚未有市場週報，請先產生一週。</p>
          )}

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
