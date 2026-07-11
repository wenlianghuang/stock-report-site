export type UsIndexSnapshot = {
  symbol: string;
  name: string;
  price: number | null;
  changePct: number | null;
  marketTime: string | null;
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

async function fetchIndexSnapshot(
  symbol: string,
  name: string,
): Promise<UsIndexSnapshot> {
  const encoded = encodeURIComponent(symbol);
  const url = new URL(`${YAHOO_CHART_URL}${encoded}`);
  url.searchParams.set("interval", "1d");
  url.searchParams.set("range", "5d");

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    throw new Error(`Yahoo Finance 回應 ${response.status}（${symbol}）`);
  }

  const payload = (await response.json()) as {
    chart?: { result?: Array<{ meta?: YahooChartMeta }> };
  };
  const meta = payload.chart?.result?.[0]?.meta;
  if (!meta) {
    return {
      symbol,
      name,
      price: null,
      changePct: null,
      marketTime: null,
    };
  }

  const price =
    typeof meta.regularMarketPrice === "number" ? meta.regularMarketPrice : null;
  const previous =
    typeof meta.chartPreviousClose === "number"
      ? meta.chartPreviousClose
      : typeof meta.previousClose === "number"
        ? meta.previousClose
        : null;

  let changePct: number | null = null;
  if (price !== null && previous !== null && previous !== 0) {
    changePct = ((price - previous) / previous) * 100;
  }

  let marketTime: string | null = null;
  if (typeof meta.regularMarketTime === "number") {
    marketTime = new Date(meta.regularMarketTime * 1000).toISOString();
  }

  return { symbol, name, price, changePct, marketTime };
}

export async function fetchUsIndices(): Promise<UsIndexSnapshot[]> {
  return Promise.all(
    US_INDEX_CONFIG.map(({ symbol, name }) => fetchIndexSnapshot(symbol, name)),
  );
}
