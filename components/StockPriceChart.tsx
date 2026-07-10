"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildChartPoints,
  formatChartDate,
  formatPrice,
  formatVolume,
} from "@/lib/chart-utils";
import type { HistoryDay } from "@/lib/types";

type StockPriceChartProps = {
  history: HistoryDay[];
  avgCost?: number;
};

export function StockPriceChart({ history, avgCost }: StockPriceChartProps) {
  const data = buildChartPoints(history);

  if (data.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">尚無價格歷史資料。</p>
    );
  }

  return (
    <div className="h-[420px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
          <XAxis
            dataKey="date"
            tickFormatter={formatChartDate}
            minTickGap={24}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            yAxisId="price"
            domain={["auto", "auto"]}
            tickFormatter={formatPrice}
            width={56}
            tick={{ fontSize: 12 }}
          />
          <YAxis yAxisId="volume" orientation="right" hide />
          <Tooltip
            labelFormatter={(label) => `日期：${label}`}
            formatter={(value, name) => {
              if (typeof value !== "number") {
                return ["—", String(name)];
              }
              if (name === "volume") {
                return [formatVolume(value), "成交量"];
              }
              return [formatPrice(value), String(name)];
            }}
          />
          <Legend />
          <Bar
            yAxisId="volume"
            dataKey="volume"
            name="成交量"
            fill="#94a3b8"
            opacity={0.35}
            barSize={6}
          />
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="close"
            name="收盤"
            stroke="#18181b"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="ma5"
            name="MA5"
            stroke="#ef4444"
            strokeWidth={1.5}
            dot={false}
            connectNulls
          />
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="ma10"
            name="MA10"
            stroke="#f59e0b"
            strokeWidth={1.5}
            dot={false}
            connectNulls
          />
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="ma20"
            name="MA20"
            stroke="#3b82f6"
            strokeWidth={1.5}
            dot={false}
            connectNulls
          />
          {avgCost ? (
            <ReferenceLine
              yAxisId="price"
              y={avgCost}
              stroke="#10b981"
              strokeDasharray="6 4"
              label={{ value: "均價", position: "insideTopRight", fill: "#10b981" }}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
