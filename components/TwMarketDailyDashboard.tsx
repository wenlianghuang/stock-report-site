"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MarkdownReport } from "@/components/MarkdownReport";
import type {
  MarketDailyRecord,
  MarketDayFacts,
  MarketDaySummary,
} from "@/lib/types";

type ResolveWindow = {
  trade_date: string;
  for_session: string;
  prior_trade_date: string | null;
  lookback_days: string[];
  cutover_applied: boolean;
  resolved_as_of: string;
  us_as_of?: string;
  us_cutover_passed?: boolean;
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

function formatNet(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "—";
  const lots = value / 1000;
  const prefix = lots > 0 ? "+" : "";
  return `${prefix}${lots.toLocaleString("zh-TW", { maximumFractionDigits: 0 })} 張`;
}

function pctClass(value?: number | null) {
  if (value == null || Number.isNaN(value) || value === 0) {
    return "text-zinc-700 dark:text-zinc-300";
  }
  return value > 0
    ? "text-red-600 dark:text-red-400"
    : "text-emerald-600 dark:text-emerald-400";
}

function BiasChip({ hint }: { hint?: string | null }) {
  const label =
    hint === "bullish" ? "偏多" : hint === "bearish" ? "偏空" : "中性";
  const tone =
    hint === "bullish"
      ? "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300"
      : hint === "bearish"
        ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
        : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${tone}`}>
      {label}
    </span>
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

export function TwMarketDailyDashboard() {
  const [windowInfo, setWindowInfo] = useState<ResolveWindow | null>(null);
  const [records, setRecords] = useState<MarketDailyRecord[]>([]);
  const [active, setActive] = useState<MarketDailyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMarkdown, setShowMarkdown] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/market-daily");
      const payload = (await response.json()) as {
        window?: ResolveWindow | null;
        records?: MarketDailyRecord[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "無法載入市場日報");
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
  }, [active?.id]);

  async function pollRecord(id: string) {
    for (let i = 0; i < 90; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 4000));
      const response = await fetch(`/api/market-daily/${id}`);
      const payload = (await response.json()) as {
        record?: MarketDailyRecord;
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
      const response = await fetch("/api/market-daily", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const payload = (await response.json()) as {
        record?: MarketDailyRecord;
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

  async function onDelete(record: MarketDailyRecord) {
    const label = record.tradeDate || "此筆";
    if (!window.confirm(`確定要刪除 ${label} 的開盤前 brief 嗎？`)) {
      return;
    }

    setError(null);
    setDeletingId(record.id);
    try {
      const response = await fetch(`/api/market-daily/${record.id}`, {
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

  const facts: MarketDayFacts | undefined = active?.factsJson;
  const summary: MarketDaySummary | undefined = active?.summaryJson;
  const marketReturn =
    summary?.market?.day_return_pct ?? facts?.market?.day_return_pct ?? null;
  const lastClose = summary?.market?.close ?? facts?.market?.close ?? null;
  const biasHint = summary?.bias_hint ?? facts?.bias_hint ?? "neutral";
  const volume = summary?.volume ?? facts?.volume;
  const institutional = summary?.institutional ?? facts?.institutional;
  const technical = summary?.technical ?? facts?.technical;
  const tsmc = summary?.tsmc ?? facts?.tsmc;
  const us = summary?.us ?? facts?.us;
  const ixicRet =
    us?.ixic_day_return_pct ?? us?.indices?.IXIC?.day_return_pct ?? null;
  const soxRet =
    us?.sox_day_return_pct ?? us?.indices?.SOX?.day_return_pct ?? null;
  const ixicAlign = us?.ixic_vs_taiex ?? us?.alignment?.ixic_vs_taiex ?? null;
  const soxAlign = us?.sox_vs_tsmc ?? us?.alignment?.sox_vs_tsmc ?? null;

  const biasText = useMemo(() => (summary?.bias || "").trim(), [summary?.bias]);
  const dashboardText = useMemo(
    () => (summary?.dashboard || "").trim(),
    [summary?.dashboard],
  );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              開盤前戰術 brief
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              以當日量價、三大法人、技術錨點與那指／費半對帳，整理下一交易日開盤偏誤（Phase 1，無夜盤）。
            </p>
            {windowInfo ? (
              <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
                目前將產生：
                <span className="font-medium"> {windowInfo.trade_date}</span>
                <span className="text-zinc-500">
                  {" "}
                  → 服務 {windowInfo.for_session} 開盤
                  {windowInfo.us_as_of
                    ? ` · 美股 as_of ${windowInfo.us_as_of}`
                    : ""}
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
              {generating ? "產生中…" : "產生日報"}
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
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">大盤與偏誤</h3>
                        <BiasChip hint={biasHint} />
                      </div>
                      <p className="mt-1 text-sm text-zinc-500">
                        {active.tradeDate} → {active.forSession} · {active.status}
                      </p>
                    </div>
                    <p
                      className={`text-3xl font-semibold tabular-nums ${pctClass(
                        typeof marketReturn === "number" ? marketReturn : null,
                      )}`}
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
                    <span>
                      量能{" "}
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {volume?.regime ?? "—"}
                        {volume?.vs_avg5_ratio != null
                          ? `（${volume.vs_avg5_ratio}x）`
                          : ""}
                      </span>
                    </span>
                    <span>
                      法人{" "}
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {institutional?.consensus_label ?? "—"}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="text-sm font-semibold">歷史日報</h3>
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
                          className="min-w-0 flex-1 text-left"
                          onClick={() => setActive(item)}
                        >
                          <span className="block truncate font-medium">
                            {item.tradeDate ?? "未知日期"}
                          </span>
                          <span className="block text-xs text-zinc-500">
                            → {item.forSession ?? "—"} · {item.status}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="shrink-0 text-xs text-zinc-400 hover:text-rose-600"
                          disabled={deletingId === item.id}
                          onClick={() => void onDelete(item)}
                        >
                          {deletingId === item.id ? "…" : "刪"}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="text-sm font-semibold">外資淨額</h3>
                  <p className={`mt-2 text-lg font-semibold tabular-nums ${pctClass(institutional?.foreign_net)}`}>
                    {formatNet(institutional?.foreign_net)}
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="text-sm font-semibold">投信／自營</h3>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                    投信 {formatNet(institutional?.trust_net)}
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">
                    自營 {formatNet(institutional?.dealer_net)}
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="text-sm font-semibold">技術</h3>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                    vs MA5：{technical?.vs_ma5 ?? "—"}
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">
                    vs MA20：{technical?.vs_ma20 ?? "—"}
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="text-sm font-semibold">台積電</h3>
                  <p className={`mt-2 text-lg font-semibold tabular-nums ${pctClass(tsmc?.day_return_pct)}`}>
                    {formatPct(tsmc?.day_return_pct)}
                  </p>
                  <p className="text-sm text-zinc-500">
                    收 {formatClose(tsmc?.close)}
                  </p>
                </div>
              </section>

              <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <h3 className="text-sm font-semibold">美股對帳</h3>
                <p className="mt-1 text-xs text-zinc-500">
                  as_of {us?.as_of ?? "—"}
                  {us?.cutover_passed === false
                    ? "（台北 05:30 前，仍用前一日美股）"
                    : us?.cutover_passed
                      ? "（台北 05:30 後，已用最新美股）"
                      : ""}
                  {us?.ixic_session_date || us?.indices?.IXIC?.session_date
                    ? ` · session ${
                        us?.ixic_session_date ??
                        us?.indices?.IXIC?.session_date ??
                        ""
                      }`
                    : ""}
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>那指 {formatPct(typeof ixicRet === "number" ? ixicRet : null)}</span>
                    <AlignChip label={ixicAlign} />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>費半 {formatPct(typeof soxRet === "number" ? soxRet : null)}</span>
                    <AlignChip label={soxAlign} />
                  </div>
                </div>
                {!us?.available ? (
                  <p className="mt-2 text-xs text-zinc-500">美股指數資料不足</p>
                ) : null}
              </section>

              {biasText ? (
                <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="text-sm font-semibold">明日開盤偏誤</h3>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {biasText}
                  </p>
                </section>
              ) : null}

              {dashboardText ? (
                <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="text-sm font-semibold">開盤儀表板</h3>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {dashboardText}
                  </p>
                </section>
              ) : null}

              {active.error ? (
                <p className="text-sm text-rose-600 dark:text-rose-400">
                  {active.error}
                </p>
              ) : null}

              {active.markdown ? (
                <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">完整 Markdown</h3>
                    <button
                      type="button"
                      className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                      onClick={() => setShowMarkdown((v) => !v)}
                    >
                      {showMarkdown ? "收合" : "展開"}
                    </button>
                  </div>
                  {showMarkdown ? (
                    <div className="mt-4">
                      <MarkdownReport markdown={active.markdown} />
                    </div>
                  ) : null}
                </section>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-zinc-500">
              尚無日報。請先確認 Stock API 已啟動，再點「產生日報」。
            </p>
          )}
        </>
      )}
    </div>
  );
}
