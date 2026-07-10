"use client";

import { Layer, useXAxisScale, useYAxisScale } from "recharts";
import type { ChartPoint } from "@/lib/chart-utils";
import { candleColor } from "@/lib/chart-colors";

type CandlestickLayerProps = {
  data: ChartPoint[];
};

export function CandlestickLayer({ data }: CandlestickLayerProps) {
  const xScale = useXAxisScale();
  const yScale = useYAxisScale("price");

  if (!xScale || !yScale || data.length === 0) {
    return null;
  }

  const firstX = xScale(data[0].date, { position: "middle" });
  const secondX =
    data.length > 1 ? xScale(data[1].date, { position: "middle" }) : undefined;
  const step =
    firstX != null && secondX != null ? Math.abs(secondX - firstX) : 12;
  const candleWidth = Math.max(3, Math.min(14, step * 0.65));

  return (
    <Layer className="recharts-candlestick-layer">
      {data.map((point) => {
        const xCenter = xScale(point.date, { position: "middle" });
        if (xCenter == null) {
          return null;
        }

        const yHigh = yScale(point.high);
        const yLow = yScale(point.low);
        const yOpen = yScale(point.open);
        const yClose = yScale(point.close);
        if (
          yHigh == null ||
          yLow == null ||
          yOpen == null ||
          yClose == null
        ) {
          return null;
        }

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
    </Layer>
  );
}
