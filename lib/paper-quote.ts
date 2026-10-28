/**
 * 證交所當下報價，以及舊的一分鐘 K。
 * 盤中撮合只用當下報價，不用最高價、最低價。
 */

import { taipeiParts, SESSION_CUTOFF_MINUTES, SESSION_OPEN_MINUTES } from "@/lib/paper-trade";

export type MinuteBar = {
  /** 這一分鐘的開始，UTC ISO。 */
  at: string;
  open: number;
  high: number;
  low: number;
  last: number;
};

export function isCompletedSessionBar(barAt: string, sessionDate: string, now: Date): boolean {
  const start = Date.parse(barAt);
  if (!Number.isFinite(start)) return false;
  if (start + 60_000 > now.getTime()) return false;
  const parts = taipeiParts(new Date(start));
  if (parts.isoDate !== sessionDate) return false;
  return parts.minutes >= SESSION_OPEN_MINUTES && parts.minutes < SESSION_CUTOFF_MINUTES;
}

/** 這一分鐘的結束晚於下單時間，才用來撮合。下單前已經走完的 K 不算。 */
export function barFollowsOrder(barAt: string, submittedAt: string): boolean {
  const start = Date.parse(barAt);
  const submitted = Date.parse(submittedAt);
  if (!Number.isFinite(start) || !Number.isFinite(submitted)) return false;
  return start + 60_000 > submitted;
}

export function minuteBarsFromChart(input: {
  sessionDate: string;
  now: Date;
  timestamps: Array<number | null | undefined>;
  open: Array<number | null | undefined>;
  high: Array<number | null | undefined>;
  low: Array<number | null | undefined>;
  close: Array<number | null | undefined>;
}): MinuteBar[] {
  const bars: MinuteBar[] = [];
  for (let index = 0; index < input.timestamps.length; index += 1) {
    const timestamp = input.timestamps[index];
    if (typeof timestamp !== "number") continue;
    const at = new Date(timestamp * 1000).toISOString();
    if (!isCompletedSessionBar(at, input.sessionDate, input.now)) continue;
    const open = toCents(input.open[index]);
    const high = toCents(input.high[index]);
    const low = toCents(input.low[index]);
    const last = toCents(input.close[index]);
    if (open === null || high === null || low === null || last === null) continue;
    bars.push({ at, open, high, low, last });
  }
  bars.sort((a, b) => a.at.localeCompare(b.at));
  return bars;
}

function toCents(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  const cents = Math.round(value * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0) return null;
  return cents;
}

/** 證交所一次報價。價格是分；沒有的欄位是 null。 */
export type LiveQuote = {
  /** 抓到這次報價的時間，UTC ISO。早於下單的快照不用。 */
  at: string;
  /** 交易所報價時間。畫面上顯示。 */
  quoteAt: string | null;
  /** 最新成交價。 */
  last: number | null;
  /** 最新成交時間。早於下單的成交不用來判斷限價。 */
  lastAt: string | null;
  /** 買價，最佳一檔。 */
  bid: number | null;
  /** 賣價，最佳一檔。 */
  ask: number | null;
};

type MisRow = {
  c?: unknown;
  z?: unknown;
  a?: unknown;
  b?: unknown;
  t?: unknown;
  d?: unknown;
  tlong?: unknown;
  trade?: { t?: unknown; z?: unknown } | null;
};

/** 快照必須晚於下單。最新價只有成交時間也晚於下單才保留。 */
export function quoteAfterOrder(quote: LiveQuote, submittedAt: string): LiveQuote | null {
  if (!isAfter(quote.at, submittedAt)) return null;
  const lastOk =
    quote.last !== null && quote.lastAt !== null && isAfter(quote.lastAt, submittedAt);
  return {
    ...quote,
    last: lastOk ? quote.last : null,
    lastAt: lastOk ? quote.lastAt : null,
  };
}

/** 證交所 msgArray。最高價、最低價刻意不讀。 */
export function liveQuotesFromMis(payload: unknown, observedAt: Date): Map<string, LiveQuote> {
  const rows = misRows(payload);
  const quotes = new Map<string, LiveQuote>();
  const at = observedAt.toISOString();
  for (const row of rows) {
    const stockId = text(row.c);
    if (!stockId || !/^\d{4,6}$/.test(stockId)) continue;
    const quoteAt = fromTlong(row.tlong) ?? taipeiStamp(text(row.d), text(row.t));
    const printed = listedPriceToCents(row.z);
    const tradePrice = listedPriceToCents(row.trade?.z);
    const tradeAt = taipeiStamp(text(row.d), text(row.trade?.t));
    const last = printed ?? tradePrice;
    const lastAt = printed !== null ? quoteAt : tradePrice !== null ? tradeAt : null;
    quotes.set(stockId, {
      at,
      quoteAt,
      last,
      lastAt,
      bid: firstLevel(row.b),
      ask: firstLevel(row.a),
    });
  }
  return quotes;
}

export function listedPriceToCents(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const match = /^(\d+)(?:\.(\d+))?$/.exec(String(value).trim());
  if (!match) return null;
  const yuan = Number(match[1]);
  if (!Number.isSafeInteger(yuan)) return null;
  const padded = `${match[2] ?? ""}000`.slice(0, 3);
  const hundredths = Number(padded.slice(0, 2));
  const cents = yuan * 100 + hundredths + (Number(padded[2]) >= 5 ? 1 : 0);
  if (!Number.isSafeInteger(cents) || cents <= 0) return null;
  return cents;
}

function misRows(payload: unknown): MisRow[] {
  if (!payload || typeof payload !== "object") return [];
  const rows = (payload as { msgArray?: unknown }).msgArray;
  if (!Array.isArray(rows)) return [];
  return rows.filter((row): row is MisRow => Boolean(row) && typeof row === "object");
}

function firstLevel(value: unknown): number | null {
  if (typeof value !== "string") return null;
  return listedPriceToCents(value.split("_")[0] ?? "");
}

function fromTlong(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const ms = Number(value);
  if (!Number.isSafeInteger(ms) || ms < 1_000_000_000_000) return null;
  return new Date(ms).toISOString();
}

function taipeiStamp(date: string | null, time: string | null): string | null {
  if (!date || !time || !/^\d{8}$/.test(date) || !/^\d{2}:\d{2}:\d{2}$/.test(time)) return null;
  const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time}+08:00`;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isAfter(left: string, right: string): boolean {
  const a = Date.parse(left);
  const b = Date.parse(right);
  return Number.isFinite(a) && Number.isFinite(b) && a > b;
}
