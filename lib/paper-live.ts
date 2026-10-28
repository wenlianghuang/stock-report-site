/**
 * 一張掛單對一次報價。不讀資料庫，不抓網路。
 * 碰到就全部成交；沒碰到或價格無效就繼續掛著，不到期。
 * matchPrint 只留作舊的分鐘 K 規則，盤中路徑不再呼叫。
 */

import type { TradingCalendar } from "@/lib/paper-calendar";
import type { LiveQuote, MinuteBar } from "@/lib/paper-quote";
import {
  commissionCents,
  fillAtPrice,
  type CloseMatch,
  type WorkingPaperOrder,
} from "@/lib/paper-trade";

export type PrintMatch =
  | Extract<CloseMatch, { status: "filled" }>
  | { status: "waiting" }
  | { status: "unusable" };

export function matchPrint(
  order: WorkingPaperOrder,
  bar: MinuteBar,
  calendar: TradingCalendar,
): PrintMatch {
  if (!usableBar(bar)) return { status: "unusable" };
  if (!Number.isInteger(order.shares) || order.shares < 1) {
    throw new Error("股數必須是正整數");
  }

  if (order.orderType === "market") {
    return fillAtPrice(order, bar.last, calendar);
  }

  const limit = order.limitPriceCents;
  if (!Number.isInteger(limit) || limit === null || limit <= 0) {
    throw new Error("限價不正確");
  }

  if (order.side === "buy") {
    if (bar.low > limit) return { status: "waiting" };
    const fillPrice = bar.last <= limit ? bar.last : limit;
    return fillAtPrice(order, fillPrice, calendar);
  }

  if (bar.high < limit) return { status: "waiting" };
  const fillPrice = bar.last >= limit ? bar.last : limit;
  return fillAtPrice(order, fillPrice, calendar);
}

export type QuoteMatch =
  | Extract<CloseMatch, { status: "filled" }>
  | { status: "waiting" };

/**
 * 市價買單用賣價，市價賣單用買價。
 * 限價先看最新價，最新價沒碰到再看對向報價。成交價用碰到的那個價格。
 */
export function matchQuote(
  order: WorkingPaperOrder,
  quote: LiveQuote,
  calendar: TradingCalendar,
): QuoteMatch {
  if (!Number.isInteger(order.shares) || order.shares < 1) {
    throw new Error("股數必須是正整數");
  }

  const price =
    order.orderType === "market" ? marketPrice(order, quote) : limitPrice(order, quote);
  if (price === null) return { status: "waiting" };
  if (!buyFitsReserve(order, price)) return { status: "waiting" };
  return fillAtPrice(order, price, calendar);
}

function marketPrice(order: WorkingPaperOrder, quote: LiveQuote): number | null {
  const price = order.side === "buy" ? quote.ask : quote.bid;
  return positiveCents(price) ? price : null;
}

function limitPrice(order: WorkingPaperOrder, quote: LiveQuote): number | null {
  const limit = order.limitPriceCents;
  if (!Number.isInteger(limit) || limit === null || limit <= 0) {
    throw new Error("限價不正確");
  }
  if (order.side === "buy") {
    if (positiveCents(quote.last) && quote.last <= limit) return quote.last;
    if (positiveCents(quote.ask) && quote.ask <= limit) return quote.ask;
    return null;
  }
  if (positiveCents(quote.last) && quote.last >= limit) return quote.last;
  if (positiveCents(quote.bid) && quote.bid >= limit) return quote.bid;
  return null;
}

function buyFitsReserve(order: WorkingPaperOrder, price: number): boolean {
  if (order.side !== "buy") return true;
  const notional = price * order.shares;
  if (!Number.isSafeInteger(notional)) return false;
  return order.reservedCashCents >= notional + commissionCents(notional);
}

function usableBar(bar: MinuteBar): boolean {
  if (![bar.open, bar.high, bar.low, bar.last].every(positiveCents)) return false;
  if (bar.high < bar.low) return false;
  return bar.last >= bar.low && bar.last <= bar.high;
}

function positiveCents(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value > 0;
}
