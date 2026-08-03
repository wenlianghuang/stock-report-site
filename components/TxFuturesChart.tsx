"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CandlestickLayer } from "@/components/CandlestickLayer";
import { CHART_COLORS } from "@/lib/chart-colors";
import {
  buildChartPoints,
  formatChartDate,
  type ChartPoint,
} from "@/lib/chart-utils";
import type { TxFuturesSnapshot } from "@/lib/tx-futures";

type TxFuturesChartProps = {
  snapshot: TxFuturesSnapshot | null;
  error?: string | null;
};

function formatIndex(value: number): string {
  return Math.round(value).toLocaleString("zh-TW");
}

function formatVolumeLots(value: number): string {
  return `${value.toLocaleString("zh-TW")} 口`;
}

function PriceTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload: ChartPoint }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-md dark:border-zinc-700 dark:bg-zinc-900">
      <p className="mb-1 font-medium text-zinc-900 dark:text-zinc-100">
        {label}
      </p>
      <p>開：{formatIndex(point.open)}</p>
      <p>高：{formatIndex(point.high)}</p>
      <p>低：{formatIndex(point.low)}</p>
      <p>收：{formatIndex(point.close)}</p>
      {point.volume != null ? <p>量：{formatVolumeLots(point.volume)}</p> : null}
    </div>
  );
}

export function TxFuturesChart({ snapshot, error }: TxFuturesChartProps) {
  if (error) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        台指期資料暫時無法取得：{error}
      </p>
    );
  }

  if (!snapshot || snapshot.bars.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        尚無台指期日 K 資料。
      </p>
    );
  }

  const history = snapshot.bars.map((bar) => ({
    date: bar.date,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    change_pct: bar.changePct ?? undefined,
  }));
  const data = buildChartPoints(history);
  const last = snapshot.bars.at(-1)!;
  const changePct = snapshot.changePct;
  const up = changePct == null ? last.close >= last.open : changePct >= 0;
  const changeColor = up ? "text-red-600" : "text-emerald-600";

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
            台指期 · 日盤近月
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatIndex(last.close)}
            </span>
            {changePct != null ? (
              <span className={`text-sm font-medium tabular-nums ${changeColor}`}>
                {up ? "+" : ""}
                {changePct.toFixed(2)}%
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            截至 {snapshot.asOf?.replaceAll("-", "/")}
            {snapshot.contract ? ` · 契約 ${snapshot.contract}` : null}
            {" · "}期交所
          </p>
        </div>
      </div>

      <div className="w-full">
        <ResponsiveContainer
          width="100%"
          height={260}
          minWidth={0}
          initialDimension={{ width: 640, height: 260 }}
        >
          <ComposedChart
            data={data}
            syncId="tx-futures"
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={CHART_COLORS.grid}
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatChartDate}
              minTickGap={28}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              yAxisId="price"
              domain={["auto", "auto"]}
              tickFormatter={formatIndex}
              width={52}
              tick={{ fontSize: 11 }}
            />
            <Tooltip content={<PriceTooltip />} />
            <CandlestickLayer data={data} />
            {/* Invisible series so Y-axis domain includes high/low */}
            <Line
              yAxisId="price"
              dataKey="high"
              stroke="transparent"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="price"
              dataKey="low"
              stroke="transparent"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="w-full">
        <ResponsiveContainer
          width="100%"
          height={72}
          minWidth={0}
          initialDimension={{ width: 640, height: 72 }}
        >
          <BarChart
            data={data}
            syncId="tx-futures"
            margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
          >
            <XAxis dataKey="date" hide />
            <YAxis hide />
            <Bar dataKey="volume" name="成交量" isAnimationActive={false}>
              {data.map((point) => (
                <Cell
                  key={point.date}
                  fill={point.isUp ? CHART_COLORS.up : CHART_COLORS.down}
                  fillOpacity={0.55}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
