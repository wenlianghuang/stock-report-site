import type { HistoryDay } from "./types";

export const RSI_PERIOD = 14;
export const RSI_OVERBOUGHT = 70;
export const RSI_OVERSOLD = 30;
export const ATR_PERIOD = 14;
export const ATR_VOLATILITY_HIGH_PCT = 3.5;
export const ATR_VOLATILITY_LOW_PCT = 1.5;
export const ADX_PERIOD = 14;
export const ADX_STRONG_THRESHOLD = 25;
export const ADX_WEAK_THRESHOLD = 20;

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
  atr14: number | null;
  atrPct: number | null;
  adx14: number | null;
  isUp: boolean;
};

export type TechnicalIndicator = "none" | "rsi" | "atr" | "adx";

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

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
  return round(100 - 100 / (1 + rs), 2);
}

function trueRanges(
  highs: number[],
  lows: number[],
  closes: number[],
): number[] {
  if (!highs.length || !lows.length || !closes.length) {
    return [];
  }
  const length = Math.min(highs.length, lows.length, closes.length);
  const trs: number[] = [];
  for (let index = 0; index < length; index += 1) {
    if (index === 0) {
      trs.push(highs[index] - lows[index]);
      continue;
    }
    trs.push(
      Math.max(
        highs[index] - lows[index],
        Math.abs(highs[index] - closes[index - 1]),
        Math.abs(lows[index] - closes[index - 1]),
      ),
    );
  }
  return trs;
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

/** Wilder ATR + ATR% series aligned with backend chip_signals._atr_wilder. */
export function computeAtrSeries(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = ATR_PERIOD,
): { atr14: (number | null)[]; atrPct: (number | null)[] } {
  const atr14: (number | null)[] = closes.map(() => null);
  const atrPct: (number | null)[] = closes.map(() => null);
  const trs = trueRanges(highs, lows, closes);
  if (trs.length < period) {
    return { atr14, atrPct };
  }

  let atr = trs.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  let closeIndex = period - 1;
  atr14[closeIndex] = round(atr, 4);
  if (closes[closeIndex] > 0) {
    atrPct[closeIndex] = round((atr / closes[closeIndex]) * 100, 2);
  }

  for (let index = period; index < trs.length; index += 1) {
    atr = (atr * (period - 1) + trs[index]) / period;
    closeIndex = index;
    atr14[closeIndex] = round(atr, 4);
    if (closes[closeIndex] > 0) {
      atrPct[closeIndex] = round((atr / closes[closeIndex]) * 100, 2);
    }
  }

  return { atr14, atrPct };
}

/** Wilder ADX series aligned with backend chip_signals._adx_wilder. */
export function computeAdxSeries(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = ADX_PERIOD,
): (number | null)[] {
  const result: (number | null)[] = closes.map(() => null);
  const length = Math.min(highs.length, lows.length, closes.length);
  if (length < period * 2) {
    return result;
  }

  const plusDm: number[] = [0];
  const minusDm: number[] = [0];
  const tr: number[] = [0];

  for (let index = 1; index < length; index += 1) {
    const up = highs[index] - highs[index - 1];
    const down = lows[index - 1] - lows[index];
    plusDm.push(up > down && up > 0 ? up : 0);
    minusDm.push(down > up && down > 0 ? down : 0);
    tr.push(
      Math.max(
        highs[index] - lows[index],
        Math.abs(highs[index] - closes[index - 1]),
        Math.abs(lows[index] - closes[index - 1]),
      ),
    );
  }

  let atr = tr.slice(1, period + 1).reduce((sum, value) => sum + value, 0);
  let smoothPlus = plusDm.slice(1, period + 1).reduce((sum, value) => sum + value, 0);
  let smoothMinus = minusDm.slice(1, period + 1).reduce((sum, value) => sum + value, 0);

  const dxValues: number[] = [];
  let lastAdx: number | null = null;

  for (let index = period; index < length; index += 1) {
    if (index > period) {
      atr = atr - atr / period + tr[index];
      smoothPlus = smoothPlus - smoothPlus / period + plusDm[index];
      smoothMinus = smoothMinus - smoothMinus / period + minusDm[index];
    }

    let dx: number;
    if (atr === 0) {
      dx = 0;
    } else {
      const plusDi = (100 * smoothPlus) / atr;
      const minusDi = (100 * smoothMinus) / atr;
      const denom = plusDi + minusDi;
      dx = denom > 0 ? (100 * Math.abs(plusDi - minusDi)) / denom : 0;
    }
    dxValues.push(dx);

    if (dxValues.length >= period) {
      if (lastAdx == null) {
        lastAdx =
          dxValues.slice(0, period).reduce((sum, value) => sum + value, 0) /
          period;
      } else {
        lastAdx = (lastAdx * (period - 1) + dx) / period;
      }
      result[index] = round(lastAdx, 2);
    }
  }

  return result;
}

export function rsiZone(
  value: number | null,
): "overbought" | "oversold" | "neutral" | "unknown" {
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

export function volatilityRegime(
  atrPct: number | null,
): "high" | "low" | "normal" | "unknown" {
  if (atrPct == null) {
    return "unknown";
  }
  if (atrPct >= ATR_VOLATILITY_HIGH_PCT) {
    return "high";
  }
  if (atrPct <= ATR_VOLATILITY_LOW_PCT) {
    return "low";
  }
  return "normal";
}

export function trendStrength(
  adx: number | null,
): "strong" | "weak" | "neutral" | "unknown" {
  if (adx == null) {
    return "unknown";
  }
  if (adx >= ADX_STRONG_THRESHOLD) {
    return "strong";
  }
  if (adx <= ADX_WEAK_THRESHOLD) {
    return "weak";
  }
  return "neutral";
}

export function indicatorHasData(
  data: ChartPoint[],
  indicator: Exclude<TechnicalIndicator, "none">,
): boolean {
  if (indicator === "rsi") {
    return data.some((point) => point.rsi14 != null);
  }
  if (indicator === "atr") {
    return data.some((point) => point.atrPct != null);
  }
  return data.some((point) => point.adx14 != null);
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
  const highs: number[] = [];
  const lows: number[] = [];
  let prevClose: number | null = null;

  for (const day of history) {
    const ohlc = normalizeOhlc(day, prevClose);
    prevClose = ohlc.close;
    highs.push(ohlc.high);
    lows.push(ohlc.low);
  }

  const rsiSeries = computeRsiSeries(closes);
  const { atr14: atrSeries, atrPct: atrPctSeries } = computeAtrSeries(
    highs,
    lows,
    closes,
  );
  const adxSeries = computeAdxSeries(highs, lows, closes);
  prevClose = null;

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
      atr14: atrSeries[index],
      atrPct: atrPctSeries[index],
      adx14: adxSeries[index],
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

export function formatAtrPct(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function formatAdx(value: number): string {
  return value.toFixed(1);
}
