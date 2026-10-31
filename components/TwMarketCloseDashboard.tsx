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
import type { MarketCloseFacts, MarketCloseLeader, MarketCloseRecord } from "@/lib/types";

type ResolveWindow = {
  trade_date: string;
  cutover?: string;
  resolved_as_of?: string;
};

function formatPct(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "—";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

function formatClose(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "尚未公布";
  return value.toLocaleString("zh-TW", { maximumFractionDigits: 2 });
}

function formatYi(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "尚未公布";
  const yi = value / 1e8;
  const prefix = yi > 0 ? "+" : "";
  return `${prefix}${yi.toLocaleString("zh-TW", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} 億元`;
}

function formatLots(value?: number | null, published?: boolean) {
  if (!published || value == null || Number.isNaN(value)) return "尚未公布";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toLocaleString("zh-TW")} 張`;
}

function pctClass(value?: number | null) {
  if (value == null || Number.isNaN(value) || value === 0) {
    return "text-zinc-700 dark:text-zinc-300";
  }
  return value > 0
    ? "text-red-600 dark:text-red-400"
    : "text-emerald-600 dark:text-emerald-400";
}

function volumeLabel(regime?: string | null) {
  if (regime === "expand") return "量增";
  if (regime === "shrink") return "量縮";
  if (regime === "normal") return "量平";
  return "尚未公布";
}

function friendlyError(message: string): string {
  if (message.includes("Not Found") || message.includes("尚未實作")) {
    return "收盤日報端點還沒載入。請重開 stock_api.py 後再產生。";
  }
  return message;
}

function extractSection(markdown: string, keywords: string[]): string {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex(
    (line) => keywords.some((word) => line.includes(word)) && /^#{1,3}\s/.test(line.trim()),
  );
  if (start < 0) return "";
  const chunks: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line.trim())) break;
    chunks.push(line);
  }
  return chunks.join("\n").trim();
}

export function TwMarketCloseDashboard() {
  const [windowInfo, setWindowInfo] = useState<ResolveWindow | null>(null);
  const [records, setRecords] = useState<MarketCloseRecord[]>([]);
  const [active, setActive] = useState<MarketCloseRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMarkdown, setShowMarkdown] = useState(false);
  const [currentReady, setCurrentReady] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/market-close");
      const payload = (await response.json()) as {
        window?: ResolveWindow | null;
        records?: MarketCloseRecord[];
        error?: string;
        currentReady?: boolean;
      };
      if (!response.ok) {
        throw new Error(payload.error || "無法載入收盤日報");
      }
      setWindowInfo(payload.window ?? null);
      setCurrentReady(Boolean(payload.currentReady));
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
      setError(err instanceof Error ? friendlyError(err.message) : "載入失敗");
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
      const response = await fetch(`/api/market-close/${id}`);
      const payload = (await response.json()) as {
        record?: MarketCloseRecord;
        error?: string;
      };
      if (!response.ok || !payload.record) continue;
      const record = payload.record;
      setRecords((prev) => [record, ...prev.filter((item) => item.id !== record.id)]);
      setActive(record);
      if (record.status === "done" || record.status === "failed") return;
    }
  }

  async function generate(force = false) {
    if (generating) return;
    setGenerating(true);
    setError(null);
    try {
      const response = await fetch("/api/market-close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const payload = (await response.json()) as {
        record?: MarketCloseRecord;
        error?: string;
      };
      if (!response.ok || !payload.record) {
        throw new Error(payload.error || "產生失敗");
      }
      const record = payload.record;
      setRecords((prev) => [record, ...prev.filter((item) => item.id !== record.id)]);
      setActive(record);
      if (record.status !== "done" && record.status !== "failed") {
        await pollRecord(record.agentJobId || record.id);
      }
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? friendlyError(err.message) : "產生失敗");
    } finally {
      setGenerating(false);
    }
  }

  const facts: MarketCloseFacts | undefined = active?.factsJson ?? active?.summaryJson;
  const market = facts?.market;
  const volume = facts?.volume;
  const institutional = facts?.institutional;
  const leaders: MarketCloseLeader[] = facts?.leaders ?? [];
  const news = facts?.news_items ?? [];
  const marketReturn = market?.day_return_pct ?? null;
  const closeNote = useMemo(() => {
    if (!active?.markdown) return "";
    return extractSection(active.markdown, ["今日收盤", "收盤"]);
  }, [active?.markdown]);
  const chartRows = leaders
    .filter((leader) => typeof leader.day_return_pct === "number")
    .map((leader) => ({
      name: leader.name,
      value: leader.day_return_pct as number,
    }));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">收盤日報</h2>
            <p className="mt-1 text-sm text-zinc-500">
              交易日 17:30 後的台股收盤總結。只看大盤、七檔權值法人和當天新聞，跟早上的開盤前日報分開。
            </p>
            {windowInfo ? (
              <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
                {currentReady ? "這一天的收盤日報已就緒：" : "目前收盤日："}
                <span className="font-medium"> {windowInfo.trade_date}</span>
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
              {generating ? "產生中…" : currentReady ? "查看當天" : "產生收盤日報"}
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
      ) : active ? (
        <>
          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 lg:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">大盤收盤</h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    {active.tradeDate ?? windowInfo?.trade_date ?? "—"} · {active.status}
                  </p>
                </div>
                <p className={`text-3xl font-semibold tabular-nums ${pctClass(marketReturn)}`}>
                  {formatPct(marketReturn)}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-zinc-600 dark:text-zinc-400">
                <span>
                  收盤{" "}
                  <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                    {formatClose(market?.close)}
                  </span>
                </span>
                <span>
                  區間位置{" "}
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {market?.close_in_day_range_pct != null
                      ? `${market.close_in_day_range_pct}%`
                      : "尚未公布"}
                  </span>
                </span>
                <span>
                  量能{" "}
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {volumeLabel(volume?.regime)}
                    {volume?.vs_avg5_ratio != null ? `（${volume.vs_avg5_ratio}x）` : ""}
                  </span>
                </span>
              </div>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-sm font-semibold">收盤歷史</h3>
              <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-sm">
                {records.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`w-full rounded-md px-2 py-1.5 text-left ${
                        active.id === item.id
                          ? "bg-zinc-100 dark:bg-zinc-800"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                      }`}
                      onClick={() => setActive(item)}
                    >
                      <span className="block truncate font-medium">{item.tradeDate ?? item.id}</span>
                      <span className="block text-xs text-zinc-500">{item.status}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-sm font-semibold">全市場外資</h3>
              <p className="mt-2 text-lg font-semibold tabular-nums">
                {formatYi(institutional?.foreign_net)}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {institutional?.available ? institutional.consensus_label : "尚未公布"}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-sm font-semibold">投信／自營</h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                投信 {formatYi(institutional?.trust_net)}
              </p>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                自營 {formatYi(institutional?.dealer_net)}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 md:col-span-2">
              <h3 className="text-sm font-semibold">權值漲跌</h3>
              {chartRows.length > 0 ? (
                <div className="mt-2 h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} width={36} />
                      <ReferenceLine y={0} stroke="#a1a1aa" />
                      <Tooltip formatter={(value) => formatPct(typeof value === "number" ? value : null)} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {chartRows.map((row) => (
                          <Cell
                            key={row.name}
                            fill={row.value > 0 ? CHART_COLORS.up : row.value < 0 ? CHART_COLORS.down : "#a1a1aa"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="mt-2 text-sm text-zinc-500">權值收盤價尚未公布。</p>
              )}
            </div>
          </section>

          <section className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="px-4 pt-4 text-sm font-semibold">權值法人</h3>
            <table className="mt-2 min-w-full text-left text-sm">
              <thead className="text-xs text-zinc-500">
                <tr>
                  <th className="px-4 py-2 font-medium">標的</th>
                  <th className="px-4 py-2 font-medium">漲跌</th>
                  <th className="px-4 py-2 font-medium">外資</th>
                  <th className="px-4 py-2 font-medium">投信</th>
                  <th className="px-4 py-2 font-medium">自營</th>
                </tr>
              </thead>
              <tbody>
                {leaders.map((leader) => {
                  const published = leader.institutional_status === "published";
                  return (
                    <tr key={leader.stock_id} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="px-4 py-3">
                        {leader.name}
                        <span className="ml-2 text-zinc-400">{leader.stock_id}</span>
                      </td>
                      <td className={`px-4 py-3 tabular-nums ${pctClass(leader.day_return_pct)}`}>
                        {formatPct(leader.day_return_pct)}
                      </td>
                      <td className={`px-4 py-3 tabular-nums ${pctClass(leader.foreign_net_lots)}`}>
                        {formatLots(leader.foreign_net_lots, published)}
                      </td>
                      <td className={`px-4 py-3 tabular-nums ${pctClass(leader.trust_net_lots)}`}>
                        {formatLots(leader.trust_net_lots, published)}
                      </td>
                      <td className={`px-4 py-3 tabular-nums ${pctClass(leader.dealer_net_lots)}`}>
                        {formatLots(leader.dealer_net_lots, published)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-semibold">當天新聞</h3>
            {news.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                {news.map((item) => (
                  <li key={item.title}>
                    <span className="text-zinc-500">{item.name} · </span>
                    {item.title}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">沒有對得上的收盤新聞。</p>
            )}
          </section>

          {closeNote ? (
            <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="text-sm font-semibold">今日收盤</h3>
              <div className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                <MarkdownReport markdown={closeNote} />
              </div>
            </section>
          ) : null}

          {active.error ? (
            <p className="text-sm text-rose-600 dark:text-rose-400">{active.error}</p>
          ) : null}

          {active.markdown ? (
            <section className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">完整報告</h3>
                <button
                  type="button"
                  className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                  onClick={() => setShowMarkdown((value) => !value)}
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
          還沒有收盤日報。交易日 17:30 後按「產生收盤日報」。缺的法人會標成尚未公布，不會整份失敗。
        </p>
      )}
    </div>
  );
}
