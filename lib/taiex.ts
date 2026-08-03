/** Taiwan Weighted Index (TAIEX / ^TWII) daily OHLC via Yahoo — no FinMind quota. */

export type TaiexBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  changePct: number | null;
};

export type TaiexSnapshot = {
  asOf: string | null;
  close: number | null;
  changePct: number | null;
  bars: TaiexBar[];
  source: "yahoo";
  symbol: "^TWII";
};

const YAHOO_CHART_URL =
  "https://query1.finance.yahoo.com/v8/finance/chart/%5ETWII";
const USER_AGENT = "Mozilla/5.0 (compatible; stock-report-site/taiex)";
const DEFAULT_RANGE = "3mo";

type YahooQuote = {
  open?: Array<number | null>;
  high?: Array<number | null>;
  low?: Array<number | null>;
  close?: Array<number | null>;
  volume?: Array<number | null>;
};

type YahooChartResult = {
  timestamp?: number[];
  indicators?: { quote?: YahooQuote[] };
};

function formatTaipeiDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(timestamp * 1000));
}

function buildBars(result: YahooChartResult): TaiexBar[] {
  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0];
  if (!quote) return [];

  const opens = quote.open ?? [];
  const highs = quote.high ?? [];
  const lows = quote.low ?? [];
  const closes = quote.close ?? [];
  const volumes = quote.volume ?? [];
  const bars: TaiexBar[] = [];

  for (let i = 0; i < timestamps.length; i += 1) {
    const timestamp = timestamps[i];
    const open = opens[i];
    const high = highs[i];
    const low = lows[i];
    const close = closes[i];
    if (
      typeof timestamp !== "number" ||
      typeof open !== "number" ||
      typeof high !== "number" ||
      typeof low !== "number" ||
      typeof close !== "number" ||
      ![open, high, low, close].every(Number.isFinite)
    ) {
      continue;
    }

    const prevClose = bars.at(-1)?.close ?? null;
    let changePct: number | null = null;
    if (prevClose != null && prevClose !== 0) {
      changePct = ((close - prevClose) / prevClose) * 100;
    }

    const volume = volumes[i];
    bars.push({
      date: formatTaipeiDate(timestamp),
      open,
      high,
      low,
      close,
      volume:
        typeof volume === "number" && Number.isFinite(volume) && volume > 0
          ? volume
          : null,
      changePct,
    });
  }

  return bars;
}

export async function fetchTaiexDaily(
  options?: { range?: string },
): Promise<TaiexSnapshot> {
  const url = new URL(YAHOO_CHART_URL);
  url.searchParams.set("interval", "1d");
  url.searchParams.set("range", options?.range ?? DEFAULT_RANGE);
  url.searchParams.set("includePrePost", "false");

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance 回應 ${response.status}（^TWII）`);
  }

  const payload = (await response.json()) as {
    chart?: { result?: YahooChartResult[]; error?: { description?: string } };
  };
  const result = payload.chart?.result?.[0];
  if (!result) {
    const description = payload.chart?.error?.description;
    throw new Error(description ?? "無法解析加權指數日 K");
  }

  const bars = buildBars(result);
  const last = bars.at(-1) ?? null;

  return {
    asOf: last?.date ?? null,
    close: last?.close ?? null,
    changePct: last?.changePct ?? null,
    bars,
    source: "yahoo",
    symbol: "^TWII",
  };
}

/** Soft in-process cache so login / API bursts do not hammer Yahoo. */
let memoryCache: { expiresAt: number; snapshot: TaiexSnapshot } | null = null;
const MEMORY_TTL_MS = 30 * 60 * 1000;

export async function getTaiexDailyCached(): Promise<TaiexSnapshot> {
  const now = Date.now();
  if (memoryCache && memoryCache.expiresAt > now) {
    return memoryCache.snapshot;
  }
  const snapshot = await fetchTaiexDaily();
  memoryCache = { expiresAt: now + MEMORY_TTL_MS, snapshot };
  return snapshot;
}
