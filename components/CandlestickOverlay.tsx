"use client";

import type { ChartPoint } from "@/lib/chart-utils";
import { candleColor } from "@/lib/chart-colors";

type AxisLike = {
  scale?: ((value: number | string) => number) & { bandwidth?: () => number };
};

export type CandlestickOverlayProps = {
  xAxisMap?: Record<string, AxisLike>;
  yAxisMap?: Record<string, AxisLike>;
  offset?: { left?: number; top?: number };
  data?: ChartPoint[];
};

export function CandlestickOverlay({
  xAxisMap,
  yAxisMap,
  offset,
  data,
}: CandlestickOverlayProps) {
  if (!data?.length || !xAxisMap || !yAxisMap) {
    return null;
  }

  const xAxis = Object.values(xAxisMap)[0];
  const yAxis = Object.values(yAxisMap)[0];
  if (!xAxis?.scale || !yAxis?.scale) {
    return null;
  }

  const bandwidth = xAxis.scale.bandwidth?.() ?? 10;
  const candleWidth = Math.max(3, Math.min(14, bandwidth * 0.65));
  const left = offset?.left ?? 0;
  const top = offset?.top ?? 0;

  return (
    <g className="recharts-candlestick-layer">
      {data.map((point) => {
        const bandStart = xAxis.scale!(point.date);
        if (typeof bandStart !== "number" || Number.isNaN(bandStart)) {
          return null;
        }

        const xCenter = bandStart + bandwidth / 2 + left;
        const yHigh = yAxis.scale!(point.high) + top;
        const yLow = yAxis.scale!(point.low) + top;
        const yOpen = yAxis.scale!(point.open) + top;
        const yClose = yAxis.scale!(point.close) + top;
        const color = candleColor(point.isUp);
        const bodyTop = Math.min(yOpen, yClose);
        const bodyBottom = Math.max(yOpen, yClose);
        const bodyHeight = Math.max(1, bodyBottom - bodyTop);
        const x = xCenter - candleWidth / 2;

        return (
          <g key={point.date}>
            <line
              x1={xCenter}
              x2={xCenter}
              y1={yHigh}
              y2={yLow}
              stroke={color}
              strokeWidth={1}
            />
            <rect
              x={x}
              y={bodyTop}
              width={candleWidth}
              height={bodyHeight}
              fill={color}
              stroke={color}
            />
          </g>
        );
      })}
    </g>
  );
}
