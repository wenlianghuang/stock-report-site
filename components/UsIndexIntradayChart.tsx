"use client";

import {
  Area,
  Bar,
  BarChart,
  ComposedChart,
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

function formatVolume(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K`;
  }
  return value.toLocaleString("en-US");
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
      {point.volume !== null ? (
        <p className="mt-0.5 text-zinc-500">成交量 {formatVolume(point.volume)}</p>
      ) : null}
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
      <div className="flex h-[360px] items-center justify-center rounded-xl bg-zinc-50 text-sm text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
        暫無盤中走勢
      </div>
    );
  }

  const stroke = isUp ? "#059669" : "#dc2626";
  const gradientId = `us-index-fill-${symbol.replace(/[^a-zA-Z0-9]/g, "")}`;
  const lastIndex = points.length - 1;
  const hasVolume = points.some((point) => point.volume !== null && point.volume > 0);
  const syncId = `us-index-${symbol.replace(/[^a-zA-Z0-9]/g, "")}`;

  return (
    <div className="w-full">
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={points}
            syncId={syncId}
            margin={{ top: 12, right: 4, left: 4, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" hide />
            <YAxis domain={["auto", "auto"]} hide />
            {previousClose !== null ? (
              <ReferenceLine
                y={previousClose}
                stroke="#ef4444"
                strokeDasharray="4 4"
                strokeWidth={1}
                strokeOpacity={0.85}
              />
            ) : null}
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="price"
              stroke={stroke}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={(props) => {
                const { cx, cy, index } = props as {
                  cx?: number;
                  cy?: number;
                  index?: number;
                };
                if (index !== lastIndex || cx == null || cy == null) {
                  return <g key={`dot-${index ?? "x"}`} />;
                }
                return (
                  <circle
                    key={`dot-${index}`}
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill={stroke}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                );
              }}
              activeDot={{ r: 4, fill: stroke, stroke: "#fff", strokeWidth:2 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {hasVolume ? (
        <div className="h-[52px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={points}
              syncId={syncId}
              margin={{ top: 0, right: 4, left: 4, bottom: 0 }}
            >
              <XAxis dataKey="time" hide />
              <YAxis hide domain={[0, "auto"]} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(148,163,184,0.12)" }} />
              <Bar
                dataKey="volume"
                fill="#cbd5e1"
                fillOpacity={0.75}
                barSize={4}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      <div className="h-[28px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={points}
            margin={{ top: 0, right: 4, left: 4, bottom: 0 }}
          >
            <XAxis
              dataKey="time"
              axisLine={false}
              tickLine={false}
              minTickGap={48}
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              interval="preserveStartEnd"
            />
            <YAxis hide />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
