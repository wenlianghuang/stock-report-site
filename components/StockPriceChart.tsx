"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CandlestickLayer } from "@/components/CandlestickLayer";
import {
  RSI_ZONE_LABEL,
  TREND_STRENGTH_LABEL,
  VOLATILITY_REGIME_LABEL,
} from "@/lib/chart-labels";
import { CHART_COLORS, candleColor } from "@/lib/chart-colors";
import {
  ADX_STRONG_THRESHOLD,
  ADX_WEAK_THRESHOLD,
  ATR_VOLATILITY_HIGH_PCT,
  ATR_VOLATILITY_LOW_PCT,
  buildChartPoints,
  formatAdx,
  formatAtrPct,
  formatChartDate,
  formatPrice,
  formatRsi,
  formatVolume,
  indicatorHasData,
  rsiZone,
  trendStrength,
  volatilityRegime,
  type ChartPoint,
  type TechnicalIndicator,
} from "@/lib/chart-utils";
import type { HistoryDay } from "@/lib/types";

type StockPriceChartProps = {
  history: HistoryDay[];
  avgCost?: number;
};

const INDICATOR_OPTIONS: Array<{
  id: TechnicalIndicator;
  label: string;
}> = [
  { id: "none", label: "不顯示" },
  { id: "rsi", label: "RSI" },
  { id: "atr", label: "ATR" },
  { id: "adx", label: "ADX" },
];

function indicatorTabClass(active: boolean): string {
  return active
    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700";
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

function RsiTooltip({
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
  if (!point || point.rsi14 == null) {
    return null;
  }

  const zone = rsiZone(point.rsi14);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-md dark:border-zinc-700 dark:bg-zinc-900">
      <p className="mb-1 font-medium text-zinc-900 dark:text-zinc-100">日期：{label}</p>
      <p>RSI14：{formatRsi(point.rsi14)}</p>
      {zone !== "unknown" ? (
        <p className="text-zinc-500">{RSI_ZONE_LABEL[zone]}</p>
      ) : null}
    </div>
  );
}

function AtrTooltip({
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
  if (!point || point.atrPct == null) {
    return null;
  }

  const regime = volatilityRegime(point.atrPct);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-md dark:border-zinc-700 dark:bg-zinc-900">
      <p className="mb-1 font-medium text-zinc-900 dark:text-zinc-100">日期：{label}</p>
      {point.atr14 != null ? <p>ATR14：{formatPrice(point.atr14)}</p> : null}
      <p>ATR14%：{formatAtrPct(point.atrPct)}</p>
      {regime !== "unknown" ? (
        <p className="text-zinc-500">{VOLATILITY_REGIME_LABEL[regime]}</p>
      ) : null}
    </div>
  );
}

function AdxTooltip({
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
  if (!point || point.adx14 == null) {
    return null;
  }

  const strength = trendStrength(point.adx14);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-md dark:border-zinc-700 dark:bg-zinc-900">
      <p className="mb-1 font-medium text-zinc-900 dark:text-zinc-100">日期：{label}</p>
      <p>ADX14：{formatAdx(point.adx14)}</p>
      {strength !== "unknown" ? (
        <p className="text-zinc-500">{TREND_STRENGTH_LABEL[strength]}</p>
      ) : null}
    </div>
  );
}

function IndicatorChart({
  indicator,
  data,
}: {
  indicator: Exclude<TechnicalIndicator, "none">;
  data: ChartPoint[];
}) {
  if (indicator === "rsi") {
    return (
      <LineChart
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
          domain={[0, 100]}
          ticks={[30, 50, 70]}
          width={56}
          tick={{ fontSize: 11 }}
        />
        <Tooltip content={<RsiTooltip />} />
        <ReferenceLine
          y={70}
          stroke={CHART_COLORS.rsiOverbought}
          strokeDasharray="4 4"
          strokeOpacity={0.6}
        />
        <ReferenceLine
          y={30}
          stroke={CHART_COLORS.rsiOversold}
          strokeDasharray="4 4"
          strokeOpacity={0.6}
        />
        <Line
          type="monotone"
          dataKey="rsi14"
          name="RSI14"
          stroke={CHART_COLORS.rsi}
          strokeWidth={1.5}
          dot={false}
          connectNulls
        />
      </LineChart>
    );
  }

  if (indicator === "atr") {
    return (
      <LineChart
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
          domain={["auto", "auto"]}
          tickFormatter={(value: number) => `${value.toFixed(1)}%`}
          width={56}
          tick={{ fontSize: 11 }}
        />
        <Tooltip content={<AtrTooltip />} />
        <ReferenceLine
          y={ATR_VOLATILITY_HIGH_PCT}
          stroke={CHART_COLORS.atrHigh}
          strokeDasharray="4 4"
          strokeOpacity={0.6}
        />
        <ReferenceLine
          y={ATR_VOLATILITY_LOW_PCT}
          stroke={CHART_COLORS.atrLow}
          strokeDasharray="4 4"
          strokeOpacity={0.6}
        />
        <Line
          type="monotone"
          dataKey="atrPct"
          name="ATR14%"
          stroke={CHART_COLORS.atr}
          strokeWidth={1.5}
          dot={false}
          connectNulls
        />
      </LineChart>
    );
  }

  return (
    <LineChart
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
        domain={[0, 100]}
        ticks={[20, 25, 50]}
        width={56}
        tick={{ fontSize: 11 }}
      />
      <Tooltip content={<AdxTooltip />} />
      <ReferenceLine
        y={ADX_STRONG_THRESHOLD}
        stroke={CHART_COLORS.adxStrong}
        strokeDasharray="4 4"
        strokeOpacity={0.6}
      />
      <ReferenceLine
        y={ADX_WEAK_THRESHOLD}
        stroke={CHART_COLORS.adxWeak}
        strokeDasharray="4 4"
        strokeOpacity={0.6}
      />
      <Line
        type="monotone"
        dataKey="adx14"
        name="ADX14"
        stroke={CHART_COLORS.adx}
        strokeWidth={1.5}
        dot={false}
        connectNulls
      />
    </LineChart>
  );
}

export function StockPriceChart({ history, avgCost }: StockPriceChartProps) {
  const data = buildChartPoints(history);
  const [indicator, setIndicator] = useState<TechnicalIndicator>("rsi");

  const selectableIndicators = useMemo(
    () =>
      INDICATOR_OPTIONS.filter((option) => {
        if (option.id === "none") {
          return true;
        }
        return indicatorHasData(data, option.id);
      }),
    [data],
  );

  const activeIndicator =
    indicator !== "none" && indicatorHasData(data, indicator)
      ? indicator
      : null;

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
            <XAxis dataKey="date" hide />
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

      {selectableIndicators.some((option) => option.id !== "none") ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            技術指標
          </span>
          <div className="flex flex-wrap gap-1.5">
            {selectableIndicators.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setIndicator(option.id)}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition ${indicatorTabClass(
                  indicator === option.id,
                )}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {activeIndicator ? (
        <div className="h-[110px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <IndicatorChart indicator={activeIndicator} data={data} />
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  );
}
