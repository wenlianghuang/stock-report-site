"use client";

import type { ReactNode } from "react";
import type {
  BaseRateTable,
  ChipFacts,
  HistoryDay,
  PositionSummary,
  ReportRecord,
  ReportSummaryJson,
} from "@/lib/types";
import {
  RSI_ZONE_LABEL,
  TREND_STRENGTH_LABEL,
  VOLATILITY_REGIME_LABEL,
} from "@/lib/chart-labels";
import { formatMarginQuantity } from "@/lib/holding-legs";

const MAX_FLOW_DAYS = 10;

type KvRow = {
  label: string;
  value: string;
};

function formatNum(
  value?: number | null,
  {
    signed = false,
    digits,
    suffix = "",
  }: { signed?: boolean; digits?: number; suffix?: string } = {},
): string | null {
  if (value == null || Number.isNaN(value)) {
    return null;
  }
  const abs = Math.abs(value);
  const resolvedDigits =
    digits ?? (Number.isInteger(value) || abs >= 100 ? 0 : 2);
  const formatted = value.toLocaleString("zh-TW", {
    minimumFractionDigits: resolvedDigits,
    maximumFractionDigits: resolvedDigits,
  });
  const prefix = signed && value > 0 ? "+" : "";
  return `${prefix}${formatted}${suffix}`;
}

function formatPct(value?: number | null, signed = false): string | null {
  if (value == null || Number.isNaN(value)) {
    return null;
  }
  const prefix = signed && value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

function todayHistory(history: HistoryDay[] | undefined, tradeDate?: string) {
  if (!history?.length) {
    return undefined;
  }
  if (tradeDate) {
    return history.find((day) => day.date === tradeDate) ?? history.at(-1);
  }
  return history.at(-1);
}

function kv(label: string, value: string | null | undefined): KvRow | null {
  if (!value || value === "—") {
    return null;
  }
  return { label, value };
}

function SectionCard({
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

function KeyValueTable({ rows }: { rows: Array<KvRow | null> }) {
  const visible = rows.filter((row): row is KvRow => Boolean(row));
  if (visible.length === 0) {
    return (
      <p className="text-sm text-zinc-500">此區塊尚無可用數字。</p>
    );
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
          {visible.map((row) => (
            <tr
              key={row.label}
              className="border-b border-zinc-100 dark:border-zinc-800"
            >
              <td className="px-3 py-2 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                {row.label}
              </td>
              <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function rsiCell(facts?: ChipFacts) {
  if (facts?.rsi_14 == null) {
    return null;
  }
  const zone = facts.rsi_zone
    ? RSI_ZONE_LABEL[facts.rsi_zone] ?? facts.rsi_zone
    : null;
  return zone
    ? `${facts.rsi_14.toFixed(1)}（${zone}）`
    : facts.rsi_14.toFixed(1);
}

function atrCell(facts?: ChipFacts) {
  if (facts?.atr_14 == null && facts?.atr_pct == null) {
    return null;
  }
  if (facts.atr_14 != null && facts.atr_pct != null) {
    const zone = facts.volatility_regime
      ? VOLATILITY_REGIME_LABEL[facts.volatility_regime]
      : null;
    const core = `${facts.atr_14.toFixed(2)} / ${facts.atr_pct.toFixed(1)}%`;
    return zone && !zone.endsWith("資料不足") ? `${core}（${zone}）` : core;
  }
  if (facts.atr_pct != null) {
    return `${facts.atr_pct.toFixed(1)}%`;
  }
  return facts.atr_14 != null ? facts.atr_14.toFixed(2) : null;
}

function adxCell(facts?: ChipFacts) {
  if (facts?.adx_14 == null) {
    return null;
  }
  const zone = facts.trend_strength
    ? TREND_STRENGTH_LABEL[facts.trend_strength]
    : null;
  return zone && !zone.endsWith("資料不足")
    ? `${facts.adx_14.toFixed(1)}（${zone}）`
    : facts.adx_14.toFixed(1);
}

function buildPriceRows(facts?: ChipFacts, bar?: HistoryDay): Array<KvRow | null> {
  return [
    kv("開盤價", formatNum(facts?.open ?? bar?.open)),
    kv("最高價", formatNum(facts?.high ?? bar?.high)),
    kv("最低價", formatNum(facts?.low ?? bar?.low)),
    kv("收盤價", formatNum(facts?.close ?? bar?.close)),
    kv(
      "漲跌幅",
      formatNum(facts?.today_change_pct ?? bar?.change_pct, {
        signed: true,
        digits: 2,
      }),
    ),
    kv(
      "成交量（張）",
      formatNum(facts?.volume_today_lots ?? bar?.volume),
    ),
  ];
}

function buildChipRows(facts?: ChipFacts): Array<KvRow | null> {
  const major = facts?.major_available
    ? [
        kv("主力買賣超（張）", formatNum(facts.major_net_lots, { signed: true })),
        kv("主力佔成交量", formatPct(facts.major_volume_pct)),
      ]
    : [kv("主力", facts ? "未取得（主力_擷取狀態 ≠ ok）" : null)];
  return [
    kv("外資買賣超（張）", formatNum(facts?.foreign_net_lots, { signed: true })),
    kv("投信買賣超（張）", formatNum(facts?.trust_net_lots, { signed: true })),
    kv("自營商買賣超（張）", formatNum(facts?.dealer_net_lots, { signed: true })),
    kv("融資餘額（張）", formatNum(facts?.margin_today_lots)),
    kv("融資增減（張）", formatNum(facts?.margin_today_delta_lots, { signed: true })),
    kv("融券餘額（張）", formatNum(facts?.short_today_lots)),
    kv("融券增減（張）", formatNum(facts?.short_today_delta_lots, { signed: true })),
    kv("借券賣出（張）", formatNum(facts?.borrow_sell_today_lots)),
    kv("券賣還券（張）", formatNum(facts?.borrow_return_lots)),
    kv("當沖成交量（張）", formatNum(facts?.day_trade_volume_lots)),
    kv("當沖佔成交量", formatPct(facts?.day_trade_ratio_pct)),
    ...major,
  ];
}

function buildMarketRows(facts?: ChipFacts): Array<KvRow | null> {
  return [
    kv("加權指數收盤", formatNum(facts?.market_close, { digits: 2 })),
    kv("大盤當日漲跌幅", formatPct(facts?.market_change_pct, true)),
    kv("大盤 MA5", formatNum(facts?.market_ma5, { digits: 2 })),
    kv("大盤收盤偏離 MA5", formatPct(facts?.market_close_vs_ma5_pct, true)),
    kv("大盤 MA20（月線）", formatNum(facts?.market_ma20, { digits: 2 })),
    kv("大盤收盤偏離 MA20", formatPct(facts?.market_close_vs_ma20_pct, true)),
    kv("大盤區間漲跌幅", formatPct(facts?.market_period_return_pct, true)),
  ];
}

function buildTrendRows(facts?: ChipFacts): Array<KvRow | null> {
  const lookback = facts?.lookback_days ?? 5;
  let majorCum = formatNum(facts?.major_cum_lots, { signed: true });
  if (majorCum && facts?.major_history_days != null) {
    majorCum = `${majorCum}（${facts.major_history_days}/${lookback} 日有資料）`;
  }
  return [
    kv("外資累計買賣超（張）", formatNum(facts?.foreign_cum_lots, { signed: true })),
    kv("投信累計買賣超（張）", formatNum(facts?.trust_cum_lots, { signed: true })),
    kv("自營商累計買賣超（張）", formatNum(facts?.dealer_cum_lots, { signed: true })),
    kv("主力累計買賣超（張）", majorCum),
    kv("融資餘額淨變化（張）", formatNum(facts?.margin_delta_lots, { signed: true })),
    kv("融券餘額淨變化（張）", formatNum(facts?.short_delta_lots, { signed: true })),
    kv("成交量均值（張）", formatNum(facts?.avg_volume_lots)),
    kv("當沖佔比均值", formatPct(facts?.avg_day_trade_ratio_pct)),
    kv("區間漲跌幅", formatPct(facts?.period_return_pct, true)),
    kv("MA5", formatNum(facts?.ma5, { digits: 2 })),
    kv("收盤偏離 MA5", formatPct(facts?.close_vs_ma5_pct, true)),
    kv("MA10（10 日線）", formatNum(facts?.ma10, { digits: 2 })),
    kv("收盤偏離 MA10", formatPct(facts?.close_vs_ma10_pct, true)),
    kv("MA20（月線）", formatNum(facts?.ma20, { digits: 2 })),
    kv("收盤偏離 MA20", formatPct(facts?.close_vs_ma20_pct, true)),
    kv("RSI14（14日）", rsiCell(facts)),
    kv("ATR14（14日）", atrCell(facts)),
    kv("ADX14（14日）", adxCell(facts)),
    kv(
      "券資比",
      facts?.margin_short_ratio_pct != null
        ? `${facts.margin_short_ratio_pct.toFixed(1)}%${
            facts.margin_short_ratio_zone
              ? `（${facts.margin_short_ratio_zone}）`
              : ""
          }`
        : null,
    ),
    kv(
      "融資動能",
      facts?.margin_momentum_pct != null
        ? `${formatNum(facts.margin_momentum_pct, { signed: true, digits: 1, suffix: "%" })}${
            facts.margin_momentum ? `（${facts.margin_momentum}）` : ""
          }`
        : null,
    ),
  ];
}

function buildPositionRows(
  report: ReportRecord,
  facts?: ChipFacts,
  position?: PositionSummary,
  close?: number | null,
): Array<KvRow | null> {
  const avgCost = position?.avg_cost ?? report.avgCost;
  const shares = position?.shares ?? report.shareCount;
  const costDiff =
    close != null && avgCost != null ? close - avgCost : null;
  return [
    kv("總持股（股）", formatNum(shares)),
    kv("加權均價（元）", formatNum(avgCost, { digits: 2 })),
    kv("現股股數", formatNum(position?.cash?.shares ?? report.cashShareCount)),
    kv(
      "現股均價（元）",
      formatNum(position?.cash?.avg_cost ?? report.cashAvgCost, { digits: 2 }),
    ),
    kv(
      "融資股數",
      position?.margin?.shares != null
        ? formatMarginQuantity(position.margin.shares)
        : report.marginShareCount
          ? formatMarginQuantity(report.marginShareCount)
          : null,
    ),
    kv(
      "融資均價（元）",
      formatNum(position?.margin?.avg_cost ?? report.marginAvgCost, {
        digits: 2,
      }),
    ),
    kv(
      "是否融資",
      (position?.uses_margin ?? report.usesMargin) ? "是" : report.isHolding ? "否" : null,
    ),
    kv(
      "融資維持率（單檔估算）",
      position?.maintenance_rate_pct != null
        ? `${position.maintenance_rate_pct.toFixed(1)}%${
            position.margin_pressure_label
              ? `（${position.margin_pressure_label}）`
              : ""
          }`
        : null,
    ),
    kv(
      "距追繳",
      position?.distance_to_call_pp != null
        ? `${position.distance_to_call_pp > 0 ? "+" : ""}${position.distance_to_call_pp.toFixed(1)}pp`
        : null,
    ),
    kv(
      "估算追繳價",
      formatNum(position?.margin_call_price, { digits: 2 }),
    ),
    kv("收盤價（元）", formatNum(close, { digits: 2 })),
    kv("未實現損益", formatPct(position?.unrealized_pnl_pct, true)),
    kv("現價 vs 均價（元）", formatNum(costDiff, { signed: true, digits: 2 })),
    kv("MA20（月線）", formatNum(facts?.ma20, { digits: 2 })),
    kv("收盤偏離 MA20", formatPct(facts?.close_vs_ma20_pct, true)),
    kv("RSI14（14日）", rsiCell(facts)),
    kv("ATR14（14日）", atrCell(facts)),
    kv("ADX14（14日）", adxCell(facts)),
    kv(
      "近20日低（停損參考）",
      formatNum(facts?.low_20d, { digits: 2 }),
    ),
    kv(
      "近20日高（停利/壓力參考）",
      formatNum(facts?.high_20d, { digits: 2 }),
    ),
  ];
}

function FlowTable({
  flow,
}: {
  flow: NonNullable<ReportSummaryJson["market"]["institutional_flow"]>;
}) {
  const rows = flow.slice(-MAX_FLOW_DAYS);
  if (rows.length === 0) {
    return null;
  }
  return (
    <SectionCard title={`近 ${rows.length} 日法人買賣超（張）`}>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-700">
              <th className="px-3 py-2 font-medium">日期</th>
              <th className="px-3 py-2 font-medium">外資</th>
              <th className="px-3 py-2 font-medium">投信</th>
              <th className="px-3 py-2 font-medium">自營</th>
              <th className="px-3 py-2 font-medium">主力</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((day) => (
              <tr
                key={day.date}
                className="border-b border-zinc-100 dark:border-zinc-800"
              >
                <td className="px-3 py-2 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                  {day.date}
                </td>
                <td className="px-3 py-2">
                  {formatNum(day.foreign, { signed: true }) ?? "—"}
                </td>
                <td className="px-3 py-2">
                  {formatNum(day.trust, { signed: true }) ?? "—"}
                </td>
                <td className="px-3 py-2">
                  {formatNum(day.dealer, { signed: true }) ?? "—"}
                </td>
                <td className="px-3 py-2">
                  {formatNum(day.major, { signed: true }) ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function formatWinRate(value?: number | null) {
  if (value == null) {
    return "—";
  }
  return `${Math.round(value * 100)}%`;
}

function formatExcess(value?: number | null) {
  if (value == null) {
    return "—";
  }
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(1)}%`;
}

function BaseRateDetails({ table }: { table: BaseRateTable }) {
  return (
    <details className="rounded-xl border border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-zinc-900 marker:text-zinc-400 dark:text-zinc-100">
        {table.title || "歷史命中率"}
        <span className="ml-2 text-xs font-normal text-zinc-500">
          （點擊展開）
        </span>
      </summary>
      <div className="space-y-3 px-4 pb-4">
        {table.note ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{table.note}</p>
        ) : null}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-700">
                <th className="px-3 py-2 font-medium">維度</th>
                <th className="px-3 py-2 font-medium">當前狀態</th>
                <th className="px-3 py-2 font-medium">3日勝率</th>
                <th className="px-3 py-2 font-medium">3日超額</th>
                <th className="px-3 py-2 font-medium">5日勝率</th>
                <th className="px-3 py-2 font-medium">5日超額</th>
                <th className="px-3 py-2 font-medium">樣本(信心)</th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr
                  key={`${row.key}-${row.state}`}
                  className="border-b border-zinc-100 dark:border-zinc-800"
                >
                  <td className="px-3 py-2 whitespace-nowrap">{row.dimension}</td>
                  <td className="px-3 py-2">{row.state}</td>
                  <td className="px-3 py-2">{formatWinRate(row.h3.p_up)}</td>
                  <td className="px-3 py-2">{formatExcess(row.h3.excess)}</td>
                  <td className="px-3 py-2">{formatWinRate(row.h5.p_up)}</td>
                  <td className="px-3 py-2">{formatExcess(row.h5.excess)}</td>
                  <td className="px-3 py-2">
                    n={row.sample_n}（{row.confidence}）
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {table.edge != null && table.tilt ? (
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            <strong>綜合歷史傾向：</strong>
            扣除全市場同期基準後，樣本充足桶平均 forward 超額{" "}
            {formatExcess(table.edge)} → {table.tilt}
            {table.tilt_note ? `（${table.tilt_note}）` : ""}
          </p>
        ) : null}
      </div>
    </details>
  );
}

type ReportDataTablesPanelProps = {
  report: ReportRecord;
  facts?: ChipFacts;
  history?: HistoryDay[];
  summary?: ReportSummaryJson;
};

export function ReportDataTablesPanel({
  report,
  facts,
  history,
  summary,
}: ReportDataTablesPanelProps) {
  const bar = todayHistory(history, facts?.trade_date ?? report.tradeDate);
  const close =
    facts?.close ?? summary?.market.key_metrics.close ?? bar?.close ?? null;
  const lookback = facts?.lookback_days ?? 5;
  const periodLabel = facts?.lookback_start
    ? `${lookback} 日（${facts.lookback_start}～${facts.trade_date ?? report.tradeDate ?? ""}）`
    : `${lookback} 日`;
  const flow = summary?.market.institutional_flow ?? [];
  const baseRate = summary?.market.base_rate;
  const hasPosition = Boolean(report.isHolding || summary?.position);

  return (
    <div className="flex flex-col gap-6">
      <div className="text-sm text-zinc-600 dark:text-zinc-400">
        <p>
          籌碼數據
          {facts?.stock_name || report.stockName
            ? `（${facts?.stock_name ?? report.stockName} ${facts?.stock_id ?? report.stockId}）`
            : ""}
        </p>
        <p>
          資料日期：{facts?.trade_date ?? report.tradeDate ?? "—"}　來源：facts /
          CSV（系統自動產生）
        </p>
      </div>

      <SectionCard title="當日價量">
        <KeyValueTable rows={buildPriceRows(facts, bar)} />
      </SectionCard>

      <SectionCard title="當日籌碼面">
        <KeyValueTable rows={buildChipRows(facts)} />
      </SectionCard>

      <SectionCard title="大盤脈絡（加權指數 TAIEX）">
        <KeyValueTable rows={buildMarketRows(facts)} />
      </SectionCard>

      <SectionCard title={`區間趨勢摘要（近 ${periodLabel}）`}>
        <KeyValueTable rows={buildTrendRows(facts)} />
      </SectionCard>

      {flow.length > 0 ? <FlowTable flow={flow} /> : null}

      {hasPosition ? (
        <SectionCard
          title={`部位摘要（${facts?.stock_name ?? report.stockName ?? ""} ${facts?.stock_id ?? report.stockId}）`}
        >
          <KeyValueTable
            rows={buildPositionRows(report, facts, summary?.position, close)}
          />
        </SectionCard>
      ) : null}

      {baseRate && baseRate.rows.length > 0 ? (
        <BaseRateDetails table={baseRate} />
      ) : (
        <details className="rounded-xl border border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-zinc-900 marker:text-zinc-400 dark:text-zinc-100">
            歷史命中率（同型態個股 forward 表現）
            <span className="ml-2 text-xs font-normal text-zinc-500">
              （點擊展開）
            </span>
          </summary>
          <p className="px-4 pb-4 text-sm text-zinc-600 dark:text-zinc-400">
            此報告尚無校準命中率。有離線校準檔並重新產報後，才會寫入這張表。
          </p>
        </details>
      )}
    </div>
  );
}
