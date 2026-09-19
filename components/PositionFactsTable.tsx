import { formatMarginQuantity } from "@/lib/holding-legs";
import {
  RSI_ZONE_LABEL,
  TREND_STRENGTH_LABEL,
  VOLATILITY_REGIME_LABEL,
} from "@/lib/chart-labels";
import {
  formatPct,
  formatPrice,
  formatShares,
} from "@/lib/format-metrics";
import type { ChipFacts, HistoryDay, PositionSummary, ReportRecord } from "@/lib/types";

type PositionFactsTableProps = {
  report: ReportRecord;
  facts?: ChipFacts;
  history?: HistoryDay[];
  position?: PositionSummary;
};

function closePrice(facts?: ChipFacts, history?: HistoryDay[]): number | undefined {
  if (facts?.close != null) {
    return facts.close;
  }
  if (facts?.trade_date && history) {
    const hit = history.find((day) => day.date === facts.trade_date);
    if (hit) {
      return hit.close;
    }
  }
  return history?.at(-1)?.close;
}

function pnlPct(close?: number, avgCost?: number): number | undefined {
  if (close == null || avgCost == null || avgCost <= 0) {
    return undefined;
  }
  return ((close - avgCost) / avgCost) * 100;
}

export function PositionFactsTable({
  report,
  facts,
  history = [],
  position,
}: PositionFactsTableProps) {
  const close = position ? undefined : closePrice(facts, history);
  const shares = position?.shares ?? report.shareCount;
  const avgCost = position?.avg_cost ?? report.avgCost;
  const unrealized = position?.unrealized_pnl_pct ?? pnlPct(close, avgCost);
  const usesMargin = position?.uses_margin ?? Boolean(report.usesMargin);
  const name = [facts?.stock_name ?? report.stockName, facts?.stock_id ?? report.stockId]
    .filter(Boolean)
    .join(" ");

  const rows: Array<[string, string]> = [
    ["總持股（股）", formatShares(shares)],
    ["加權均價（元）", formatPrice(avgCost)],
    [
      "現股股數",
      formatShares(position?.cash?.shares ?? report.cashShareCount ?? (usesMargin ? undefined : shares)),
    ],
    [
      "現股均價（元）",
      formatPrice(position?.cash?.avg_cost ?? report.cashAvgCost ?? (usesMargin ? undefined : avgCost)),
    ],
    ["是否融資", usesMargin ? "是" : "否"],
    [
      "融資數量",
      position?.margin?.shares != null
        ? formatMarginQuantity(position.margin.shares)
        : report.marginShareCount != null
          ? formatMarginQuantity(report.marginShareCount)
          : "—",
    ],
    ["融資均價（元）", formatPrice(position?.margin?.avg_cost ?? report.marginAvgCost)],
    ["收盤價（元）", formatPrice(close ?? history.at(-1)?.close)],
    ["未實現損益", formatPct(unrealized, { signed: true })],
    ["損益分類", position?.pnl_bucket_label || "—"],
    ["系統傾向", position?.position_bias_label || "—"],
    ["綜合優先序", position?.priority_label || "—"],
    [
      "收盤偏離 MA20",
      formatPct(facts?.close_vs_ma20_pct, { signed: true }),
    ],
    [
      "RSI14",
      facts?.rsi_14 != null
        ? `${facts.rsi_14.toFixed(1)}（${RSI_ZONE_LABEL[facts.rsi_zone ?? ""] ?? facts.rsi_zone ?? "—"}）`
        : "—",
    ],
    [
      "ATR14",
      facts?.atr_14 != null
        ? `${facts.atr_14.toFixed(2)}${
            facts.atr_pct != null ? ` / ${formatPct(facts.atr_pct)}` : ""
          }${
            facts.volatility_regime
              ? `（${VOLATILITY_REGIME_LABEL[facts.volatility_regime] ?? facts.volatility_regime}）`
              : ""
          }`
        : "—",
    ],
    [
      "ADX14",
      facts?.adx_14 != null
        ? `${facts.adx_14.toFixed(1)}（${TREND_STRENGTH_LABEL[facts.trend_strength ?? ""] ?? facts.trend_strength ?? "—"}）`
        : "—",
    ],
    ["近20日低（停損參考）", formatPrice(facts?.low_20d)],
    ["近20日高（停利/壓力參考）", formatPrice(facts?.high_20d)],
  ];

  if (usesMargin && position?.maintenance_rate_pct != null) {
    rows.push(
      ["融資維持率", formatPct(position.maintenance_rate_pct, { digits: 1 })],
      [
        "距追繳",
        position.distance_to_call_pp != null
          ? `${position.distance_to_call_pp > 0 ? "+" : ""}${position.distance_to_call_pp.toFixed(1)}pp`
          : "—",
      ],
      ["估算追繳價", formatPrice(position.margin_call_price)],
    );
  }

  const visible = rows.filter(([, value]) => value && value !== "—");

  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <h2 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        部位摘要{name ? `（${name}）` : ""}
      </h2>
      {facts?.trade_date || report.tradeDate ? (
        <p className="mb-3 text-xs text-zinc-500">
          資料日期：{facts?.trade_date ?? report.tradeDate}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-700">
              <th className="px-3 py-2 font-medium">項目</th>
              <th className="px-3 py-2 font-medium">數值</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(([label, value]) => (
              <tr
                key={label}
                className="border-b border-zinc-100 dark:border-zinc-800"
              >
                <td className="px-3 py-2 text-zinc-500">{label}</td>
                <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                  {value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
