/**
 * 模擬交易用的日收盤、證交所盤中報價，以及開休市表。
 * 盤中撮合只用證交所當下報價。日 K 留給 13:30 之後的收盤。
 */

import { parseTwseHolidayCsv, twseCalendar, type TradingCalendar } from "@/lib/paper-calendar";
import { liveQuotesFromMis, type LiveQuote } from "@/lib/paper-quote";
import { taipeiParts, type PaperMarket } from "@/lib/paper-trade";

const YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart/";
const HOLIDAY_CSV = "https://www.twse.com.tw/holidaySchedule/holidaySchedule";
const MIS_QUOTE = "https://mis.twse.com.tw/stock/api/getStockInfo.jsp";
const USER_AGENT = "Mozilla/5.0 (compatible; stock-report-site/paper)";

const closeCache = new Map<string, { expiresAt: number; closes: Map<string, number> }>();
const quoteCache = new Map<string, { expiresAt: number; quote: LiveQuote }>();
const calendarCache = new Map<number, { expiresAt: number; csv: string }>();
const CACHE_TTL_MS = 30 * 60 * 1000;
const QUOTE_TTL_MS = 8 * 1000;

export function yahooSymbol(stockId: string, market: PaperMarket): string {
  return market === "twse" ? `${stockId}.TW` : `${stockId}.TWO`;
}

/** Yahoo 的小數收盤價轉成整數分。 */
export function priceToCents(price: number): number | null {
  if (!Number.isFinite(price) || price <= 0) return null;
  const cents = Math.round(price * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0) return null;
  return cents;
}

export async function fetchDailyCloses(
  stockId: string,
  market: PaperMarket,
): Promise<Map<string, number>> {
  const symbol = yahooSymbol(stockId, market);
  const cached = closeCache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) return cached.closes;

  const url = new URL(`${YAHOO_CHART}${encodeURIComponent(symbol)}`);
  url.searchParams.set("interval", "1d");
  url.searchParams.set("range", "3mo");
  url.searchParams.set("includePrePost", "false");

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Yahoo Finance 回應 ${response.status}（${symbol}）`);
  }

  const payload = (await response.json()) as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: { quote?: Array<{ close?: Array<number | null> }> };
      }>;
      error?: { description?: string };
    };
  };
  const result = payload.chart?.result?.[0];
  if (!result) {
    throw new Error(payload.chart?.error?.description ?? `無法解析 ${symbol} 日 K`);
  }

  const closes = new Map<string, number>();
  const timestamps = result.timestamp ?? [];
  const quotes = result.indicators?.quote?.[0]?.close ?? [];
  for (let index = 0; index < timestamps.length; index += 1) {
    const timestamp = timestamps[index];
    const close = quotes[index];
    if (typeof timestamp !== "number" || typeof close !== "number") continue;
    const cents = priceToCents(close);
    if (cents === null) continue;
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(timestamp * 1000));
    closes.set(date, cents);
  }

  closeCache.set(symbol, { expiresAt: Date.now() + CACHE_TTL_MS, closes });
  return closes;
}

export type LiveQuoteRequest = {
  stockId: string;
  market: PaperMarket;
};

/**
 * 證交所公開行情，一次可以問多檔，上市與上櫃都走同一個位址。
 * refresh 為 true 時略過快取，讓剛送出的單看到下單之後的報價。
 * 抓不到就略過該檔。
 */
export async function fetchLiveQuotes(
  instruments: readonly LiveQuoteRequest[],
  now = new Date(),
  options?: { refresh?: boolean },
): Promise<Map<string, LiveQuote>> {
  const wanted = new Map<string, LiveQuoteRequest>();
  for (const item of instruments) {
    if (!/^\d{4,6}$/.test(item.stockId)) continue;
    wanted.set(cacheKey(item), item);
  }

  const quotes = new Map<string, LiveQuote>();
  const missing: LiveQuoteRequest[] = [];
  for (const item of wanted.values()) {
    const cached = quoteCache.get(cacheKey(item));
    if (!options?.refresh && cached && cached.expiresAt > Date.now()) {
      quotes.set(item.stockId, cached.quote);
      continue;
    }
    missing.push(item);
  }
  if (missing.length === 0) return quotes;

  const groups: LiveQuoteRequest[][] = [];
  for (let index = 0; index < missing.length; index += 30) {
    groups.push(missing.slice(index, index + 30));
  }
  await Promise.all(groups.map(async (group) => {
    let parsed = new Map<string, LiveQuote>();
    try {
      parsed = await requestMisQuotes(group, now);
    } catch {
      parsed = new Map();
    }
    for (const item of group) {
      const quote = parsed.get(item.stockId);
      if (!quote) continue;
      quoteCache.set(cacheKey(item), { expiresAt: Date.now() + QUOTE_TTL_MS, quote });
      quotes.set(item.stockId, quote);
    }
  }));
  return quotes;
}

async function requestMisQuotes(
  instruments: readonly LiveQuoteRequest[],
  now: Date,
): Promise<Map<string, LiveQuote>> {
  const url = new URL(MIS_QUOTE);
  url.searchParams.set(
    "ex_ch",
    instruments.map((item) => `${item.market === "twse" ? "tse" : "otc"}_${item.stockId}.tw`).join("|"),
  );
  url.searchParams.set("json", "1");
  url.searchParams.set("delay", "0");
  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: "https://mis.twse.com.tw/stock/fibest.jsp",
    },
    cache: "no-store",
  });
  if (!response.ok) return new Map();
  const payload = (await response.json()) as { rtcode?: string };
  if (payload.rtcode && payload.rtcode !== "0000") return new Map();
  return liveQuotesFromMis(payload, now);
}

function cacheKey(item: LiveQuoteRequest): string {
  return `${item.market}:${item.stockId}`;
}

export async function loadTradingCalendar(now: Date): Promise<TradingCalendar> {
  const year = Number(taipeiParts(now).isoDate.slice(0, 4));
  const schedules = await Promise.all(
    [year - 1, year, year + 1].map(async (item) => parseTwseHolidayCsv(await fetchHolidayCsv(item), item)),
  );
  return twseCalendar(schedules);
}

async function fetchHolidayCsv(year: number): Promise<string> {
  const cached = calendarCache.get(year);
  if (cached && cached.expiresAt > Date.now()) return cached.csv;

  const url = new URL(HOLIDAY_CSV);
  url.searchParams.set("response", "csv");
  url.searchParams.set("date", String(year));
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`證交所開休市表回應 ${response.status}（${year}）`);
  }
  const csv = await response.text();
  calendarCache.set(year, { expiresAt: Date.now() + CACHE_TTL_MS, csv });
  return csv;
}
