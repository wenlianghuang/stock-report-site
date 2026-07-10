"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FactsBadges } from "@/components/FactsBadges";
import { CHART_COLORS } from "@/lib/chart-colors";
import { formatChartDate } from "@/lib/chart-utils";
import type {
  ChipFacts,
  MarketSummary,
  PositionSummary,
  ReportSummaryJson,
  SummaryTone,
} from "@/lib/types";

const TONE_CLASS: Record<SummaryTone, string> = {
  bullish:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300",
  bearish:
    "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300",
  neutral:
    "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
  info: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300",
};

const CATEGORY_LABEL: Record<string, string> = {
  technical: "技術面",
  chip: "籌碼面",
  market: "大盤",
};

const NEWS_CATEGORY_CLASS: Record<string, string> = {
  利多: TONE_CLASS.bullish,
  利空: TONE_CLASS.bearish,
  中性: TONE_CLASS.neutral,
};

function toneBadge(label: string, tone: SummaryTone) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE_CLASS[tone]}`}
    >
      {label}
    </span>
  );
}

function formatLots(value?: number) {
  if (value == null) {
    return "—";
  }
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toLocaleString("zh-TW")} 張`;
}

function formatPct(value?: number) {
  if (value == null) {
    return "—";
  }
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
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

function SignalMatrixTable({ market }: { market: MarketSummary }) {
  const categories = ["technical", "chip", "market"] as const;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-700">
            <th className="px-3 py-2 font-medium">面向</th>
            <th className="px-3 py-2 font-medium">指標</th>
            <th className="px-3 py-2 font-medium">判定</th>
          </tr>
        </thead>
        <tbody>
          {categories.flatMap((category) => {
            const rows = market.signal_matrix.filter(
              (row) => row.category === category,
            );
            if (rows.length === 0) {
              return [];
            }
            return rows.map((row, index) => (
              <tr
                key={`${category}-${row.label}`}
                className="border-b border-zinc-100 dark:border-zinc-800"
              >
                <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                  {index === 0 ? CATEGORY_LABEL[category] : ""}
                </td>
                <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-200">
                  {row.label}
                </td>
                <td className="px-3 py-2">{toneBadge(row.value, row.tone)}</td>
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}

function KeyMetricsGrid({ market }: { market: MarketSummary }) {
  const metrics = market.key_metrics;
  const items = [
    { label: "收盤", value: metrics.close?.toFixed(2) },
    { label: "當日漲跌", value: formatPct(metrics.today_change_pct) },
    { label: "區間漲跌", value: formatPct(metrics.period_return_pct) },
    { label: "外資", value: formatLots(metrics.foreign_net_lots) },
    { label: "投信", value: formatLots(metrics.trust_net_lots) },
    { label: "自營", value: formatLots(metrics.dealer_net_lots) },
    { label: "主力", value: formatLots(metrics.major_net_lots) },
    { label: "成交量", value: metrics.volume_today_lots?.toLocaleString("zh-TW") },
  ].filter((item) => item.value && item.value !== "—");

  if (items.length === 0) {
    return null;
  }

  return (
    <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-zinc-500">{item.label}</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-100">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function InstitutionalFlowChart({
  flow,
}: {
  flow: MarketSummary["institutional_flow"];
}) {
  if (flow.length === 0) {
    return null;
  }

  const data = flow.map((day) => ({
    ...day,
    label: formatChartDate(day.date),
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey="foreign" name="外資" fill={CHART_COLORS.ma5} />
          <Bar dataKey="trust" name="投信" fill={CHART_COLORS.ma10} />
          <Bar dataKey="dealer" name="自營" fill={CHART_COLORS.ma20} />
          <Bar dataKey="major" name="主力" fill={CHART_COLORS.avgCost} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function NewsTable({ news }: { news: MarketSummary["news"] }) {
  if (news.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">本日無可用新聞摘要。</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-700">
            <th className="px-3 py-2 font-medium">日期</th>
            <th className="px-3 py-2 font-medium">標題</th>
            <th className="px-3 py-2 font-medium">分類</th>
            <th className="px-3 py-2 font-medium">摘要</th>
          </tr>
        </thead>
        <tbody>
          {news.map((item) => (
            <tr
              key={`${item.date}-${item.title}`}
              className="border-b border-zinc-100 align-top dark:border-zinc-800"
            >
              <td className="px-3 py-2 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                {item.date}
              </td>
              <td className="px-3 py-2 font-medium text-zinc-900 dark:text-zinc-100">
                {item.title}
              </td>
              <td className="px-3 py-2">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                    NEWS_CATEGORY_CLASS[item.category] ?? TONE_CLASS.neutral
                  }`}
                >
                  {item.category || "中性"}
                </span>
              </td>
              <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300">
                {item.summary}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function ScenarioCards({
  scenarios,
}: {
  scenarios: MarketSummary["narrative"]["scenarios"];
}) {
  if (scenarios.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {scenarios.map((scenario, index) => (
        <div
          key={`${scenario.title ?? "scenario"}-${index}`}
          className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950"
        >
          {scenario.title ? (
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {scenario.title}
            </p>
          ) : null}
          <p className="text-sm text-zinc-800 dark:text-zinc-200">
            {scenario.content}
          </p>
        </div>
      ))}
    </div>
  );
}

function PositionSummarySection({ position }: { position: PositionSummary }) {
  return (
    <div className="flex flex-col gap-4 border-t border-zinc-200 pt-6 dark:border-zinc-800">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        部位摘要
      </h2>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {position.unrealized_pnl_pct != null ? (
          <div>
            <dt className="text-zinc-500">未實現損益</dt>
            <dd className="font-medium">{formatPct(position.unrealized_pnl_pct)}</dd>
          </div>
        ) : null}
        {position.pnl_bucket_label ? (
          <div>
            <dt className="text-zinc-500">損益分類</dt>
            <dd className="font-medium">{position.pnl_bucket_label}</dd>
          </div>
        ) : null}
        {position.position_bias_label ? (
          <div>
            <dt className="text-zinc-500">系統傾向</dt>
            <dd className="font-medium">{position.position_bias_label}</dd>
          </div>
        ) : null}
        {position.avg_cost != null ? (
          <div>
            <dt className="text-zinc-500">持股均價</dt>
            <dd className="font-medium">{position.avg_cost.toFixed(2)}</dd>
          </div>
        ) : null}
      </dl>

      {position.scenario_plan.length > 0 ? (
        <SectionCard title="操作情境權重">
          <div className="grid gap-3 md:grid-cols-3">
            {position.scenario_plan.map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950"
              >
                <p className="text-xs font-semibold text-zinc-500">
                  {item.rank} · {item.weight_pct}%
                </p>
                <p className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">
                  {item.label}
                </p>
                <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                  建議：{item.action}
                </p>
                <p className="mt-1 text-xs text-zinc-500">{item.trigger_hint}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {position.narrative.position_status ? (
        <SectionCard title="部位現況">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {position.narrative.position_status}
          </p>
        </SectionCard>
      ) : null}

      {position.narrative.cross_points.length > 0 ? (
        <SectionCard title="部位與市場交叉">
          <BulletList items={position.narrative.cross_points} />
        </SectionCard>
      ) : null}

      {position.narrative.scenarios.length > 0 ? (
        <SectionCard title="操作情境">
          <ScenarioCards scenarios={position.narrative.scenarios} />
        </SectionCard>
      ) : null}

      {position.narrative.risk_items.length > 0 ? (
        <SectionCard title="風險與紀律">
          <BulletList items={position.narrative.risk_items} />
        </SectionCard>
      ) : null}
    </div>
  );
}

type ReportSummaryPanelProps = {
  summary: ReportSummaryJson;
  facts?: ChipFacts;
};

export function ReportSummaryPanel({ summary, facts }: ReportSummaryPanelProps) {
  const market = summary.market;

  return (
    <div className="flex flex-col gap-6">
      {facts ? <FactsBadges facts={facts} /> : null}

      <SectionCard title="訊號總覽">
        <SignalMatrixTable market={market} />
      </SectionCard>

      <SectionCard title="關鍵數字">
        <KeyMetricsGrid market={market} />
      </SectionCard>

      {market.institutional_flow.length > 0 ? (
        <SectionCard title="近 N 日法人買賣超">
          <InstitutionalFlowChart flow={market.institutional_flow} />
        </SectionCard>
      ) : null}

      {market.narrative.today_chip ? (
        <SectionCard title="當日解讀（精簡）">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {market.narrative.today_chip}
          </p>
        </SectionCard>
      ) : null}

      {market.narrative.trend ? (
        <SectionCard title="趨勢解讀（精簡）">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {market.narrative.trend}
          </p>
        </SectionCard>
      ) : null}

      <SectionCard title="新聞與事件">
        <NewsTable news={market.news} />
      </SectionCard>

      {market.narrative.cross_points.length > 0 ? (
        <SectionCard title="籌碼與新聞交叉">
          <BulletList items={market.narrative.cross_points} />
        </SectionCard>
      ) : null}

      {market.narrative.scenarios.length > 0 ? (
        <SectionCard title="情境推演">
          <ScenarioCards scenarios={market.narrative.scenarios} />
        </SectionCard>
      ) : null}

      {market.narrative.watch_items.length > 0 ? (
        <SectionCard title="觀察重點">
          <BulletList items={market.narrative.watch_items} />
        </SectionCard>
      ) : null}

      {summary.position ? (
        <PositionSummarySection position={summary.position} />
      ) : null}
    </div>
  );
}
