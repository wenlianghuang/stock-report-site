"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CandlestickLayer } from "@/components/CandlestickLayer";
import { CHART_COLORS, candleColor } from "@/lib/chart-colors";
import {
  buildChartPoints,
  formatChartDate,
  formatPrice,
  formatVolume,
  type ChartPoint,
} from "@/lib/chart-utils";
import type { HistoryDay } from "@/lib/types";

type StockPriceChartProps = {
  history: HistoryDay[];
  avgCost?: number;
};

function PriceTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload: ChartPoint }[];
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload;
  if (!point) {
    return null;
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-md dark:border-zinc-700 dark:bg-zinc-900">
      <p className="mb-1 font-medium text-zinc-900 dark:text-zinc-100">日期：{label}</p>
      <p>開：{formatPrice(point.open)}</p>
      <p>高：{formatPrice(point.high)}</p>
      <p>低：{formatPrice(point.low)}</p>
      <p>收：{formatPrice(point.close)}</p>
      {point.ma5 != null ? <p>MA5：{formatPrice(point.ma5)}</p> : null}
      {point.ma10 != null ? <p>MA10：{formatPrice(point.ma10)}</p> : null}
      {point.ma20 != null ? <p>MA20：{formatPrice(point.ma20)}</p> : null}
      {point.volume != null ? <p>成交量：{formatVolume(point.volume)}</p> : null}
    </div>
  );
}

function VolumeTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload: ChartPoint }[];
  label?: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload;
  if (!point || point.volume == null) {
    return null;
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-md dark:border-zinc-700 dark:bg-zinc-900">
      <p className="mb-1 font-medium text-zinc-900 dark:text-zinc-100">日期：{label}</p>
      <p>成交量：{formatVolume(point.volume)}</p>
    </div>
  );
}

export function StockPriceChart({ history, avgCost }: StockPriceChartProps) {
  const data = buildChartPoints(history);

  if (data.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">尚無價格歷史資料。</p>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            syncId="stock-chart"
            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={CHART_COLORS.grid}
              vertical={false}
            />
            <XAxis dataKey="date" hide />
            <YAxis
              yAxisId="price"
              domain={["auto", "auto"]}
              tickFormatter={formatPrice}
              width={56}
              tick={{ fontSize: 12 }}
            />
            <Tooltip content={<PriceTooltip />} />
            <CandlestickLayer data={data} />
            <Legend />
            <Line
              yAxisId="price"
              dataKey="high"
              stroke="transparent"
              dot={false}
              legendType="none"
              activeDot={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="price"
              dataKey="low"
              stroke="transparent"
              dot={false}
              legendType="none"
              activeDot={false}
              isAnimationActive={false}
            />
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="ma5"
              name="MA5"
              stroke={CHART_COLORS.ma5}
              strokeWidth={1.5}
              dot={false}
              connectNulls
              legendType="line"
            />
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="ma10"
              name="MA10"
              stroke={CHART_COLORS.ma10}
              strokeWidth={1.5}
              dot={false}
              connectNulls
              legendType="line"
            />
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="ma20"
              name="MA20"
              stroke={CHART_COLORS.ma20}
              strokeWidth={1.5}
              dot={false}
              connectNulls
              legendType="line"
            />
            {avgCost ? (
              <ReferenceLine
                yAxisId="price"
                y={avgCost}
                stroke={CHART_COLORS.avgCost}
                strokeDasharray="6 4"
                label={{
                  value: "均價",
                  position: "insideTopRight",
                  fill: CHART_COLORS.avgCost,
                }}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="h-[110px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            syncId="stock-chart"
            margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={CHART_COLORS.grid}
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatChartDate}
              minTickGap={24}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              tickFormatter={formatVolume}
              width={56}
              tick={{ fontSize: 11 }}
            />
            <Tooltip content={<VolumeTooltip />} />
            <Bar dataKey="volume" name="成交量" barSize={6}>
              {data.map((point) => (
                <Cell
                  key={point.date}
                  fill={candleColor(point.isUp)}
                  fillOpacity={0.85}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
