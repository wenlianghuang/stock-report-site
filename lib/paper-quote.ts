/**
 * 證交所當下報價。
 * 盤中撮合只用當下報價，不用最高價、最低價。
 */

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
  /** 買價，最佳一檔。撮合只用這一檔。 */
  bid: number | null;
  /** 賣價，最佳一檔。撮合只用這一檔。 */
  ask: number | null;
  /** 買價五檔，由最佳往下。張數沒有時是 null。 */
  bids: BookLevel[];
  /** 賣價五檔，由最佳往上。張數沒有時是 null。 */
  asks: BookLevel[];
};

/** 委託簿一檔。張數是證交所揭示的整數張。 */
export type BookLevel = {
  priceCents: number;
  lots: number | null;
};

type MisRow = {
  c?: unknown;
  z?: unknown;
  a?: unknown;
  b?: unknown;
  f?: unknown;
  g?: unknown;
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
    const quoteAt = taipeiStamp(text(row.d), text(row.t)) ?? fromTlong(row.tlong);
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
      bids: bookLevels(row.b, row.g),
      asks: bookLevels(row.a, row.f),
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

/** 價格與張數同一位置對齊。無效價格整檔略過，最多五檔。 */
function bookLevels(prices: unknown, sizes: unknown): BookLevel[] {
  if (typeof prices !== "string") return [];
  const priceParts = prices.split("_");
  const sizeParts = typeof sizes === "string" ? sizes.split("_") : [];
  const levels: BookLevel[] = [];
  for (let index = 0; index < priceParts.length && levels.length < 5; index += 1) {
    const priceCents = listedPriceToCents(priceParts[index]);
    if (priceCents === null) continue;
    levels.push({ priceCents, lots: boardLots(sizeParts[index]) });
  }
  return levels;
}

function boardLots(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const lots = Number(value);
  if (!Number.isSafeInteger(lots)) return null;
  return lots;
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
