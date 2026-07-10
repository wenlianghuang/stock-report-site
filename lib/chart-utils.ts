import type { HistoryDay } from "./types";

export const RSI_PERIOD = 14;
export const RSI_OVERBOUGHT = 70;
export const RSI_OVERSOLD = 30;

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
  rsi14: number | null;
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

function rsiFromAverages(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) {
    return avgGain > 0 ? 100 : 50;
  }
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 100) / 100;
}

/** Wilder RSI series aligned with backend chip_signals._rsi_wilder. */
export function computeRsiSeries(
  closes: number[],
  period: number = RSI_PERIOD,
): (number | null)[] {
  const result: (number | null)[] = closes.map(() => null);
  if (closes.length < period + 1) {
    return result;
  }

  let avgGain = 0;
  let avgLoss = 0;
  for (let index = 1; index <= period; index += 1) {
    const delta = closes[index] - closes[index - 1];
    if (delta > 0) {
      avgGain += delta;
    } else {
      avgLoss -= delta;
    }
  }
  avgGain /= period;
  avgLoss /= period;
  result[period] = rsiFromAverages(avgGain, avgLoss);

  for (let index = period + 1; index < closes.length; index += 1) {
    const delta = closes[index] - closes[index - 1];
    const gain = Math.max(delta, 0);
    const loss = Math.max(-delta, 0);
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[index] = rsiFromAverages(avgGain, avgLoss);
  }

  return result;
}

export function rsiZone(value: number | null): "overbought" | "oversold" | "neutral" | "unknown" {
  if (value == null) {
    return "unknown";
  }
  if (value >= RSI_OVERBOUGHT) {
    return "overbought";
  }
  if (value <= RSI_OVERSOLD) {
    return "oversold";
  }
  return "neutral";
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
  const rsiSeries = computeRsiSeries(closes);
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
      rsi14: rsiSeries[index],
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

export function formatRsi(value: number): string {
  return value.toFixed(1);
}
