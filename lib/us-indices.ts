export type UsIndexIntradayPoint = {
  timestamp: number;
  time: string;
  price: number;
  volume: number | null;
};

export type UsIndexSnapshot = {
  symbol: string;
  name: string;
  price: number | null;
  previousClose: number | null;
  changeAmount: number | null;
  changePct: number | null;
  marketTime: string | null;
  sessionOpen: boolean;
  points: UsIndexIntradayPoint[];
};

const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/";
const USER_AGENT = "Mozilla/5.0 (compatible; stock-report-site/us-indices)";

export const US_INDEX_CONFIG = [
  { symbol: "^DJI", name: "道瓊工業指數" },
  { symbol: "^IXIC", name: "那斯達克綜合" },
  { symbol: "^SOX", name: "費城半導體" },
] as const;

type YahooChartMeta = {
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  regularMarketTime?: number;
};

type YahooChartResult = {
  meta?: YahooChartMeta;
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      close?: Array<number | null>;
      volume?: Array<number | null>;
    }>;
  };
};

function formatEtTime(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(timestamp * 1000));
}

function isUsRegularSessionOpen(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const weekday = get("weekday");
  if (weekday === "Sat" || weekday === "Sun") {
    return false;
  }

  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const totalMinutes = hour * 60 + minute;
  return totalMinutes >= 9 * 60 + 30 && totalMinutes < 16 * 60;
}

function buildIntradayPoints(result: YahooChartResult): UsIndexIntradayPoint[] {
  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0];
  const closes = quote?.close ?? [];
  const volumes = quote?.volume ?? [];
  const points: UsIndexIntradayPoint[] = [];

  for (let index = 0; index < timestamps.length; index += 1) {
    const timestamp = timestamps[index];
    const close = closes[index];
    const volume = volumes[index];
    if (
      typeof timestamp !== "number" ||
      typeof close !== "number" ||
      !Number.isFinite(close)
    ) {
      continue;
    }
    points.push({
      timestamp,
      time: formatEtTime(timestamp),
      price: close,
      volume:
        typeof volume === "number" && Number.isFinite(volume) ? volume : null,
    });
  }

  return points;
}

async function fetchIndexSnapshot(
  symbol: string,
  name: string,
): Promise<UsIndexSnapshot> {
  const encoded = encodeURIComponent(symbol);
  const url = new URL(`${YAHOO_CHART_URL}${encoded}`);
  url.searchParams.set("interval", "5m");
  url.searchParams.set("range", "1d");
  url.searchParams.set("includePrePost", "false");

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance 回應 ${response.status}（${symbol}）`);
  }

  const payload = (await response.json()) as {
    chart?: { result?: YahooChartResult[] };
  };
  const result = payload.chart?.result?.[0];
  const meta = result?.meta;
  if (!meta) {
    return {
      symbol,
      name,
      price: null,
      previousClose: null,
      changeAmount: null,
      changePct: null,
      marketTime: null,
      sessionOpen: isUsRegularSessionOpen(),
      points: [],
    };
  }

  const points = buildIntradayPoints(result);
  const lastPoint = points.at(-1);
  const price =
    typeof meta.regularMarketPrice === "number"
      ? meta.regularMarketPrice
      : lastPoint?.price ?? null;
  const previousClose =
    typeof meta.chartPreviousClose === "number"
      ? meta.chartPreviousClose
      : typeof meta.previousClose === "number"
        ? meta.previousClose
        : null;

  let changeAmount: number | null = null;
  let changePct: number | null = null;
  if (price !== null && previousClose !== null) {
    changeAmount = price - previousClose;
    if (previousClose !== 0) {
      changePct = (changeAmount / previousClose) * 100;
    }
  }

  let marketTime: string | null = null;
  if (typeof meta.regularMarketTime === "number") {
    marketTime = new Date(meta.regularMarketTime * 1000).toISOString();
  } else if (lastPoint) {
    marketTime = new Date(lastPoint.timestamp * 1000).toISOString();
  }

  return {
    symbol,
    name,
    price,
    previousClose,
    changeAmount,
    changePct,
    marketTime,
    sessionOpen: isUsRegularSessionOpen(),
    points,
  };
}

export async function fetchUsIndices(): Promise<UsIndexSnapshot[]> {
  return Promise.all(
    US_INDEX_CONFIG.map(({ symbol, name }) => fetchIndexSnapshot(symbol, name)),
  );
}
