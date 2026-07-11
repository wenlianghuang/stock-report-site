"use client";

import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { UsIndexIntradayPoint } from "@/lib/us-indices";

type UsIndexIntradayChartProps = {
  symbol: string;
  points: UsIndexIntradayPoint[];
  previousClose: number | null;
  isUp: boolean;
};

function formatPrice(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: UsIndexIntradayPoint }>;
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
      <p className="font-medium text-zinc-900 dark:text-zinc-100">{point.time} ET</p>
      <p className="mt-1 text-zinc-600 dark:text-zinc-300">{formatPrice(point.price)}</p>
    </div>
  );
}

export function UsIndexIntradayChart({
  symbol,
  points,
  previousClose,
  isUp,
}: UsIndexIntradayChartProps) {
  if (points.length < 2) {
    return (
      <div className="flex h-36 items-center justify-center rounded-xl bg-zinc-50 text-sm text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
        暫無盤中走勢
      </div>
    );
  }

  const stroke = isUp ? "#059669" : "#dc2626";
  const gradientId = `us-index-fill-${symbol.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <div className="h-36 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={points}
          margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.28} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            axisLine={false}
            tickLine={false}
            minTickGap={28}
            tick={{ fontSize: 10, fill: "#94a3b8" }}
            interval="preserveStartEnd"
          />
          <YAxis domain={["auto", "auto"]} hide />
          {previousClose !== null ? (
            <ReferenceLine
              y={previousClose}
              stroke="#94a3b8"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          ) : null}
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="price"
            stroke={stroke}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 3, fill: stroke, stroke: "#fff", strokeWidth: 1 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
