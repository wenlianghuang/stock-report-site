/**
 * 一張掛單對一次報價。不讀資料庫，不抓網路。
 * 碰到就全部成交；沒碰到或價格無效就繼續掛著，不到期。
 */

import type { TradingCalendar } from "@/lib/paper-calendar";
import type { LiveQuote } from "@/lib/paper-quote";
import {
  commissionCents,
  fillAtPrice,
  type CloseMatch,
  type WorkingPaperOrder,
} from "@/lib/paper-trade";

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

function positiveCents(value: number | null): value is number {
  return value !== null && Number.isInteger(value) && value > 0;
}
