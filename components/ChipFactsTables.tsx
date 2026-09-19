import type { ReactNode } from "react";
import type { ChipFacts, HistoryDay, InstitutionalFlowDay } from "@/lib/types";
import {
  CHIP_REGIME_LABEL,
  INSTITUTIONAL_LABEL,
  MA20_SLOPE_LABEL,
  MA_ALIGNMENT_LABEL,
  MA_STACK_LABEL,
  RSI_ZONE_LABEL,
  RS_LABEL,
  TREND_STRENGTH_LABEL,
  VOLATILITY_REGIME_LABEL,
} from "@/lib/chart-labels";
import {
  formatLots,
  formatPct,
  formatPrice,
  maPositionLabel,
} from "@/lib/format-metrics";

type ChipFactsTablesProps = {
  facts: ChipFacts;
  history?: HistoryDay[];
  flow?: InstitutionalFlowDay[];
};

function KvTable({ rows }: { rows: Array<[string, string]> }) {
  const visible = rows.filter(([, value]) => value && value !== "—");
  if (visible.length === 0) {
    return null;
  }
  return (
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
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h3>
      {children}
    </section>
  );
}

function hasValues(rows: Array<[string, string]>): boolean {
  return rows.some(([, value]) => value && value !== "—");
}

function todayBar(facts: ChipFacts, history: HistoryDay[]): HistoryDay | undefined {
  if (facts.trade_date) {
    const hit = history.find((day) => day.date === facts.trade_date);
    if (hit) {
      return hit;
    }
  }
  return history.at(-1);
}

function withMa(label: string, position?: string, pct?: number | null): string {
  const side = maPositionLabel(position);
  const deviation = formatPct(pct, { signed: true });
  if (!side && deviation === "—") {
    return "—";
  }
  if (side && deviation !== "—") {
    return `${side} ${label}（${deviation}）`;
  }
  return side || deviation;
}

export function ChipFactsTables({
  facts,
  history = [],
  flow = [],
}: ChipFactsTablesProps) {
  const today = todayBar(facts, history);
  const name = [facts.stock_name, facts.stock_id].filter(Boolean).join(" ");
  const lookback = facts.lookback_days ?? history.length;

  const priceRows: Array<[string, string]> = [
    ["開盤價", formatPrice(today?.open)],
    ["最高價", formatPrice(today?.high)],
    ["最低價", formatPrice(today?.low)],
    ["收盤價", formatPrice(today?.close ?? facts.close)],
    ["漲跌幅", formatPct(today?.change_pct ?? facts.today_change_pct, { signed: true })],
    ["成交量（張）", formatLots(today?.volume ?? facts.volume_today_lots)],
  ];

  const chipRows: Array<[string, string]> = [
    ["外資買賣超（張）", formatLots(facts.foreign_net_lots, { signed: true })],
    ["投信買賣超（張）", formatLots(facts.trust_net_lots, { signed: true })],
    ["自營商買賣超（張）", formatLots(facts.dealer_net_lots, { signed: true })],
    [
      "主力買賣超（張）",
      facts.major_available === false
        ? "未取得"
        : formatLots(facts.major_net_lots, { signed: true }),
    ],
    ["融資增減（張）", formatLots(facts.margin_today_delta_lots, { signed: true })],
    ["借券賣出（張）", formatLots(facts.borrow_sell_today_lots)],
    ["當沖佔成交量", formatPct(facts.day_trade_ratio_pct)],
    [
      "籌碼型態",
      facts.chip_regime
        ? (CHIP_REGIME_LABEL[facts.chip_regime] ?? facts.chip_regime)
        : "—",
    ],
    [
      "法人共識",
      facts.institutional_consensus
        ? (INSTITUTIONAL_LABEL[facts.institutional_consensus] ??
          facts.institutional_consensus)
        : "—",
    ],
  ];

  const marketRows: Array<[string, string]> = [
    ["加權指數收盤", formatPrice(facts.market_close, 2)],
    ["大盤當日漲跌幅", formatPct(facts.market_change_pct, { signed: true })],
    ["大盤區間漲跌幅", formatPct(facts.market_period_return_pct, { signed: true })],
    [
      "大盤 vs MA5",
      maPositionLabel(facts.market_ma5_position) || "—",
    ],
    [
      "大盤 vs MA20",
      maPositionLabel(facts.market_ma20_position) || "—",
    ],
    [
      "個股當日相對大盤",
      facts.rs_today ? (RS_LABEL[facts.rs_today] ?? facts.rs_today) : "—",
    ],
    [
      "個股區間相對大盤",
      facts.rs_period ? (RS_LABEL[facts.rs_period] ?? facts.rs_period) : "—",
    ],
  ];

  const trendRows: Array<[string, string]> = [
    ["區間漲跌幅", formatPct(facts.period_return_pct, { signed: true })],
    ["外資累計買賣超（張）", formatLots(facts.foreign_cum_lots, { signed: true })],
    ["主力累計買賣超（張）", formatLots(facts.major_cum_lots, { signed: true })],
    ["融資餘額淨變化（張）", formatLots(facts.margin_delta_lots, { signed: true })],
    ["融券餘額淨變化（張）", formatLots(facts.short_delta_lots, { signed: true })],
    ["成交量均值（張）", formatLots(facts.avg_volume_lots)],
    ["當沖佔比均值", formatPct(facts.avg_day_trade_ratio_pct)],
    ["收盤 vs MA5", withMa("MA5", facts.ma5_position, facts.close_vs_ma5_pct)],
    ["收盤 vs MA10", withMa("MA10", facts.ma10_position, facts.close_vs_ma10_pct)],
    ["收盤 vs MA20", withMa("MA20", facts.ma20_position, facts.close_vs_ma20_pct)],
    [
      "均線排列",
      facts.ma_stack ? (MA_STACK_LABEL[facts.ma_stack] ?? facts.ma_stack) : "—",
    ],
    [
      "短中線對齊",
      facts.ma_alignment
        ? (MA_ALIGNMENT_LABEL[facts.ma_alignment] ?? facts.ma_alignment)
        : "—",
    ],
    [
      "月線斜率",
      facts.ma20_slope
        ? `${MA20_SLOPE_LABEL[facts.ma20_slope] ?? facts.ma20_slope}${
            facts.ma20_slope_pct != null
              ? `（${formatPct(facts.ma20_slope_pct, { signed: true })}）`
              : ""
          }`
        : "—",
    ],
    [
      "RSI14",
      facts.rsi_14 != null
        ? `${facts.rsi_14.toFixed(1)}（${RSI_ZONE_LABEL[facts.rsi_zone ?? ""] ?? facts.rsi_zone ?? "—"}）`
        : "—",
    ],
    [
      "ATR14",
      facts.atr_14 != null
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
      facts.adx_14 != null
        ? `${facts.adx_14.toFixed(1)}（${TREND_STRENGTH_LABEL[facts.trend_strength ?? ""] ?? facts.trend_strength ?? "—"}）`
        : "—",
    ],
    [
      "券資比",
      formatPct(facts.margin_short_ratio_pct),
    ],
    [
      "融資動能",
      formatPct(facts.margin_momentum_pct, { signed: true }),
    ],
  ];

  const flowByDate = new Map(flow.map((row) => [row.date, row]));
  const historyRows = history.map((day) => {
    const inst = flowByDate.get(day.date);
    return {
      date: day.date,
      close: formatPrice(day.close),
      change: formatPct(day.change_pct, { signed: true }),
      volume: formatLots(day.volume),
      foreign: formatLots(inst?.foreign, { signed: true }),
      trust: formatLots(inst?.trust, { signed: true }),
      dealer: formatLots(inst?.dealer, { signed: true }),
      major:
        inst?.major == null && inst?.foreign == null
          ? "—"
          : formatLots(inst?.major, { signed: true }),
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          籌碼數據{name ? `（${name}）` : ""}
        </h2>
        {facts.trade_date ? (
          <p className="mt-1 text-xs text-zinc-500">資料日期：{facts.trade_date}</p>
        ) : null}
      </div>
      {hasValues(priceRows) ? (
        <Section title="當日價量">
          <KvTable rows={priceRows} />
        </Section>
      ) : null}
      {hasValues(chipRows) ? (
        <Section title="當日籌碼面">
          <KvTable rows={chipRows} />
        </Section>
      ) : null}
      {hasValues(marketRows) ? (
        <Section title="大盤脈絡（加權指數 TAIEX）">
          <KvTable rows={marketRows} />
        </Section>
      ) : null}
      {hasValues(trendRows) ? (
        <Section title={`區間趨勢摘要${lookback ? `（近 ${lookback} 日）` : ""}`}>
          <KvTable rows={trendRows} />
        </Section>
      ) : null}
      {historyRows.length > 0 ? (
        <Section title="近 N 日歷史明細">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-700">
                  <th className="px-3 py-2 font-medium">日期</th>
                  <th className="px-3 py-2 font-medium">收盤</th>
                  <th className="px-3 py-2 font-medium">漲跌</th>
                  <th className="px-3 py-2 font-medium">成交量</th>
                  <th className="px-3 py-2 font-medium">外資</th>
                  <th className="px-3 py-2 font-medium">投信</th>
                  <th className="px-3 py-2 font-medium">自營</th>
                  <th className="px-3 py-2 font-medium">主力</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((row) => (
                  <tr
                    key={row.date}
                    className="border-b border-zinc-100 dark:border-zinc-800"
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                      {row.date}
                    </td>
                    <td className="px-3 py-2 font-medium">{row.close}</td>
                    <td className="px-3 py-2">{row.change}</td>
                    <td className="px-3 py-2">{row.volume}</td>
                    <td className="px-3 py-2">{row.foreign}</td>
                    <td className="px-3 py-2">{row.trust}</td>
                    <td className="px-3 py-2">{row.dealer}</td>
                    <td className="px-3 py-2">{row.major}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}
    </div>
  );
}
