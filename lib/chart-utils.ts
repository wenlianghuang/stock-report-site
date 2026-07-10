import type { HistoryDay } from "./types";

export type ChartPoint = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  ma5: number | null;
  ma10: number | null;
  ma20: number | null;
  isUp: boolean;
};

function movingAverage(values: number[], index: number, period: number): number | null {
  if (index < period - 1) {
    return null;
  }
  const slice = values.slice(index - period + 1, index + 1);
  if (slice.length < period) {
    return null;
  }
  return slice.reduce((sum, value) => sum + value, 0) / period;
}

function normalizeOhlc(
  day: HistoryDay,
  prevClose: number | null,
): Pick<ChartPoint, "open" | "high" | "low" | "close" | "isUp"> {
  const close = day.close;
  const open = day.open ?? prevClose ?? close;
  const high = day.high ?? Math.max(open, close);
  const low = day.low ?? Math.min(open, close);
  return {
    open,
    high,
    low,
    close,
    isUp: close >= open,
  };
}

export function buildChartPoints(history: HistoryDay[]): ChartPoint[] {
  const closes = history.map((day) => day.close);
  let prevClose: number | null = null;

  return history.map((day, index) => {
    const ohlc = normalizeOhlc(day, prevClose);
    prevClose = ohlc.close;

    return {
      date: day.date,
      ...ohlc,
      volume: day.volume ?? null,
      ma5: movingAverage(closes, index, 5),
      ma10: movingAverage(closes, index, 10),
      ma20: movingAverage(closes, index, 20),
    };
  });
}

export function formatChartDate(value: string): string {
  const parts = value.split("-");
  if (parts.length === 3) {
    return `${parts[1]}/${parts[2]}`;
  }
  return value;
}

export function formatPrice(value: number): string {
  return value.toFixed(2);
}

export function formatVolume(value: number): string {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}萬`;
  }
  return value.toLocaleString("zh-TW");
}
