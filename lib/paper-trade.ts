/**
 * 模擬交易規則（純函式）。
 * 收盤價一次全部成交或到期；凍結與退款只算出金額，不寫帳戶、不寫真實持股。
 * 買單凍結「委託價或漲停價的成交金額 + 手續費」，成交後退回差額。
 */

import {
  isIsoDate,
  nextTradingDay,
  settlementDate,
  type TradingCalendar,
} from "@/lib/paper-calendar";

/** 13:30 起算下一個交易日。台北無日光節約，固定 UTC+8。 */
export const SESSION_CUTOFF_MINUTES = 13 * 60 + 30;
/** 09:00 起才用盤中報價撮合。 */
export const SESSION_OPEN_MINUTES = 9 * 60;
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

/** 0.1425% × 六折 = 0.0855%。手續費四捨五入到元，最低 20 元。 */
const FEE_NUMERATOR = 855;
const FEE_DENOMINATOR = 100_000_000;
export const MIN_COMMISSION_CENTS = 2_000;

/** 賣出證交稅 0.3%，不滿 1 元捨去。 */
const TAX_NUMERATOR = 3;
const TAX_DENOMINATOR = 100_000;

export type PaperSide = "buy" | "sell";
export type PaperOrderType = "market" | "limit";
export type PaperMarket = "twse" | "tpex";

export type PaperInstrument = {
  stockId: string;
  market: PaperMarket;
  /** 第一版只收普通股。ETF、權證、特別股傳 false。 */
  commonStock: boolean;
};

export type PaperRejectReason =
  | "invalid_stock"
  | "not_common_stock"
  | "invalid_lots"
  | "invalid_balance"
  | "missing_previous_close"
  | "invalid_limit_price"
  | "limit_price_off_tick"
  | "limit_price_out_of_band"
  | "insufficient_cash"
  | "insufficient_settled_shares"
  | "order_not_working";

export type PaperWaitReason = "session_open" | "missing_close" | "invalid_close";

export const PAPER_RULE_TEXT = {
  invalid_stock: "不是上市或上櫃股號",
  not_common_stock: "只接受普通股",
  invalid_lots: "股數必須是正整數",
  invalid_balance: "現金或股數不正確",
  missing_previous_close: "沒有前一日收盤價",
  invalid_limit_price: "限價不正確",
  limit_price_off_tick: "限價不符合升降單位",
  limit_price_out_of_band: "限價超出漲跌停",
  insufficient_cash: "可用現金不足",
  insufficient_settled_shares: "已交割股數不足",
  order_not_working: "只有掛著的單可以取消",
  session_open: "尚未收盤，不成交",
  missing_close: "還沒有收盤價",
  invalid_close: "收盤價不正確",
  limit_not_reached: "收盤價未碰到限價",
} as const;

export function paperRuleText(
  reason: PaperRejectReason | PaperWaitReason | "limit_not_reached",
): string {
  return PAPER_RULE_TEXT[reason];
}

export type PriceBand = {
  limitUpCents: number;
  limitDownCents: number;
};

export type AcceptedPaperOrder = {
  status: "working";
  sessionDate: string;
  side: PaperSide;
  orderType: PaperOrderType;
  limitPriceCents: number | null;
  lots: number;
  shares: number;
  reservedCashCents: number;
  reservedShares: number;
  limitUpCents: number;
  limitDownCents: number;
};

export type RejectedPaperOrder = {
  status: "rejected";
  reason: PaperRejectReason;
};

export type SubmitPaperOrderInput = {
  instrument: PaperInstrument | null;
  side: PaperSide;
  orderType: PaperOrderType;
  limitPriceCents: number | null;
  /** 至少 1 股。不滿 1000 股就是零股。 */
  shares: number;
  previousCloseCents: number | null;
  submittedAt: Date;
  calendar: TradingCalendar;
  /** 尚未被其他委託凍結的現金。 */
  availableCashCents: number;
  /** 尚未被其他委託凍結、且已完成交割的股數。 */
  settledShares: number;
};

export type CancelPaperOrderResult =
  | {
      status: "cancelled";
      releasedCashCents: number;
      releasedShares: number;
    }
  | RejectedPaperOrder;

export type CloseMatch =
  | {
      status: "filled";
      fillPriceCents: number;
      shares: number;
      notionalCents: number;
      feeCents: number;
      taxCents: number;
      settlementDate: string;
      refundCashCents: number;
      settlementCashCents: number;
      settlementProceedsCents: number;
      releasedShares: number;
    }
  | {
      status: "expired";
      reason: "limit_not_reached";
      releasedCashCents: number;
      releasedShares: number;
    }
  | {
      status: "waiting";
      reason: PaperWaitReason;
    };

export type WorkingPaperOrder = {
  side: PaperSide;
  orderType: PaperOrderType;
  limitPriceCents: number | null;
  shares: number;
  reservedCashCents: number;
  reservedShares: number;
  sessionDate: string;
};

/** "10.50"、"2385" → 分。超過兩位小數或無法表示成整數分時回傳 null。 */
export function parseTwdToCents(value: string): number | null {
  const text = value.trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) return null;
  const yuan = Number(match[1]);
  const fraction = (match[2] ?? "").padEnd(2, "0");
  const cents = yuan * 100 + Number(fraction);
  if (!Number.isSafeInteger(cents)) return null;
  return cents;
}

export function formatTwdFromCents(cents: number): string {
  if (!Number.isSafeInteger(cents)) {
    throw new Error("金額必須是整數分");
  }
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const yuan = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  return `${sign}${yuan}.${fraction}`;
}

/** 以價格所在級距的升降單位（分）。10、50、100、500、1000 元落在較大的那一檔。 */
export function priceTickCents(priceCents: number): number {
  if (priceCents < 1_000) return 1;
  if (priceCents < 5_000) return 5;
  if (priceCents < 10_000) return 10;
  if (priceCents < 50_000) return 50;
  if (priceCents < 100_000) return 100;
  return 500;
}

export function isOnTick(priceCents: number): boolean {
  if (!Number.isInteger(priceCents) || priceCents <= 0) return false;
  return priceCents % priceTickCents(priceCents) === 0;
}

export function priceBand(previousCloseCents: number): PriceBand {
  if (!Number.isInteger(previousCloseCents) || previousCloseCents <= 0) {
    throw new Error("前一日收盤價必須是正整數分");
  }
  const limitUpCents = alignDownToTick(Math.floor((previousCloseCents * 11) / 10));
  const limitDownCents = alignUpToTick(Math.ceil((previousCloseCents * 9) / 10));
  return { limitUpCents, limitDownCents };
}

export function commissionCents(notionalCents: number): number {
  if (!Number.isInteger(notionalCents) || notionalCents < 0) {
    throw new Error("成交金額不正確");
  }
  if (notionalCents === 0) return MIN_COMMISSION_CENTS;
  const numerator = notionalCents * FEE_NUMERATOR;
  if (!Number.isSafeInteger(numerator)) throw new Error("成交金額過大");
  const yuan = divRoundHalfUp(numerator, FEE_DENOMINATOR);
  return Math.max(yuan * 100, MIN_COMMISSION_CENTS);
}

export function sellTaxCents(notionalCents: number): number {
  if (!Number.isInteger(notionalCents) || notionalCents < 0) {
    throw new Error("成交金額不正確");
  }
  const numerator = notionalCents * TAX_NUMERATOR;
  if (!Number.isSafeInteger(numerator)) throw new Error("成交金額過大");
  return Math.floor(numerator / TAX_DENOMINATOR) * 100;
}

export function taipeiParts(instant: Date): { isoDate: string; minutes: number } {
  const shifted = new Date(instant.getTime() + TAIPEI_OFFSET_MS);
  const isoDate = shifted.toISOString().slice(0, 10);
  const minutes = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
  return { isoDate, minutes };
}

/** 13:30 前且當天開市 → 當天；否則下一個交易日。 */
export function orderSessionDate(submittedAt: Date, calendar: TradingCalendar): string {
  const { isoDate, minutes } = taipeiParts(submittedAt);
  if (!isIsoDate(isoDate)) throw new Error(`無效日期 ${isoDate}`);
  if (calendar.isTradingDay(isoDate) && minutes < SESSION_CUTOFF_MINUTES) {
    return isoDate;
  }
  return nextTradingDay(isoDate, calendar);
}

/** 交易日 13:30 起（含）視為該日已收盤。 */
export function closeAuctionReady(now: Date, sessionDate: string): boolean {
  if (!isIsoDate(sessionDate)) return false;
  const { isoDate, minutes } = taipeiParts(now);
  if (isoDate > sessionDate) return true;
  if (isoDate < sessionDate) return false;
  return minutes >= SESSION_CUTOFF_MINUTES;
}

/** 舊的分鐘線窗口：交易日 09:00 起，收盤後仍可回補。盤中報價改看 intradayQuoteReady。 */
export function liveMatchingReady(now: Date, sessionDate: string): boolean {
  if (!isIsoDate(sessionDate)) return false;
  const { isoDate, minutes } = taipeiParts(now);
  if (isoDate > sessionDate) return true;
  if (isoDate < sessionDate) return false;
  return minutes >= SESSION_OPEN_MINUTES;
}

/** 只有該交易日 09:00–13:30 用當下報價。離開這段就沒有報價可回放。 */
export function intradayQuoteReady(now: Date, sessionDate: string): boolean {
  if (!isIsoDate(sessionDate)) return false;
  const { isoDate, minutes } = taipeiParts(now);
  if (isoDate !== sessionDate) return false;
  return minutes >= SESSION_OPEN_MINUTES && minutes < SESSION_CUTOFF_MINUTES;
}

export type SessionPhase = "preopen" | "open" | "closed" | "off";

export function sessionPhase(now: Date, calendar: TradingCalendar): SessionPhase {
  const { isoDate, minutes } = taipeiParts(now);
  if (!calendar.isTradingDay(isoDate)) return "off";
  if (minutes < SESSION_OPEN_MINUTES) return "preopen";
  if (minutes < SESSION_CUTOFF_MINUTES) return "open";
  return "closed";
}

export function sessionPhaseLabel(phase: SessionPhase): string {
  if (phase === "preopen") return "預掛";
  if (phase === "open") return "盤中";
  if (phase === "closed") return "已收盤";
  return "休市";
}

export function submitPaperOrder(
  input: SubmitPaperOrderInput,
): AcceptedPaperOrder | RejectedPaperOrder {
  const instrument = input.instrument;
  if (
    !instrument ||
    !/^\d{4,6}$/.test(instrument.stockId) ||
    (instrument.market !== "twse" && instrument.market !== "tpex")
  ) {
    return { status: "rejected", reason: "invalid_stock" };
  }
  if (!instrument.commonStock) {
    return { status: "rejected", reason: "not_common_stock" };
  }
  if (!Number.isInteger(input.shares) || input.shares < 1) {
    return { status: "rejected", reason: "invalid_lots" };
  }
  if (
    !Number.isSafeInteger(input.availableCashCents) ||
    input.availableCashCents < 0 ||
    !Number.isSafeInteger(input.settledShares) ||
    input.settledShares < 0
  ) {
    return { status: "rejected", reason: "invalid_balance" };
  }
  const previousCloseCents = input.previousCloseCents;
  if (previousCloseCents === null || !Number.isInteger(previousCloseCents) || previousCloseCents <= 0) {
    return { status: "rejected", reason: "missing_previous_close" };
  }

  const band = priceBand(previousCloseCents);
  let reservePriceCents: number;
  if (input.orderType === "limit") {
    const limit = input.limitPriceCents;
    if (!Number.isInteger(limit) || limit === null || limit <= 0) {
      return { status: "rejected", reason: "invalid_limit_price" };
    }
    if (!isOnTick(limit)) {
      return { status: "rejected", reason: "limit_price_off_tick" };
    }
    if (limit < band.limitDownCents || limit > band.limitUpCents) {
      return { status: "rejected", reason: "limit_price_out_of_band" };
    }
    reservePriceCents = limit;
  } else {
    reservePriceCents = band.limitUpCents;
  }

  const shares = input.shares;
  const lots = Math.floor(shares / 1000);

  const sessionDate = orderSessionDate(input.submittedAt, input.calendar);
  if (input.side === "buy") {
    const notional = reservePriceCents * shares;
    if (!Number.isSafeInteger(notional) || notional > Math.floor(Number.MAX_SAFE_INTEGER / FEE_NUMERATOR)) {
      return { status: "rejected", reason: "invalid_lots" };
    }
    const reservedCashCents = notional + commissionCents(notional);
    if (input.availableCashCents < reservedCashCents) {
      return { status: "rejected", reason: "insufficient_cash" };
    }
    return {
      status: "working",
      sessionDate,
      side: "buy",
      orderType: input.orderType,
      limitPriceCents: input.orderType === "limit" ? reservePriceCents : null,
      lots,
      shares,
      reservedCashCents,
      reservedShares: 0,
      limitUpCents: band.limitUpCents,
      limitDownCents: band.limitDownCents,
    };
  }

  if (input.settledShares < shares) {
    return { status: "rejected", reason: "insufficient_settled_shares" };
  }
  return {
    status: "working",
    sessionDate,
    side: "sell",
    orderType: input.orderType,
    limitPriceCents: input.orderType === "limit" ? input.limitPriceCents : null,
    lots,
    shares,
    reservedCashCents: 0,
    reservedShares: shares,
    limitUpCents: band.limitUpCents,
    limitDownCents: band.limitDownCents,
  };
}

export function cancelWorkingOrder(order: {
  status: "working" | "filled" | "expired" | "cancelled" | "rejected";
  reservedCashCents: number;
  reservedShares: number;
}): CancelPaperOrderResult {
  if (order.status !== "working") {
    return { status: "rejected", reason: "order_not_working" };
  }
  return {
    status: "cancelled",
    releasedCashCents: order.reservedCashCents,
    releasedShares: order.reservedShares,
  };
}

export function matchAtClose(
  order: WorkingPaperOrder,
  closePriceCents: number | null,
  calendar: TradingCalendar,
): CloseMatch {
  if (closePriceCents === null) {
    return { status: "waiting", reason: "missing_close" };
  }
  if (!Number.isInteger(closePriceCents) || closePriceCents <= 0) {
    return { status: "waiting", reason: "invalid_close" };
  }
  if (!Number.isInteger(order.shares) || order.shares < 1) {
    throw new Error("股數必須是正整數");
  }

  const touched = limitTouched(order, closePriceCents);
  if (!touched) {
    return {
      status: "expired",
      reason: "limit_not_reached",
      releasedCashCents: order.reservedCashCents,
      releasedShares: order.reservedShares,
    };
  }

  return fillAtPrice(order, closePriceCents, calendar);
}

/** 用一個已經決定的成交價計算手續費、稅和交割金額。 */
export function fillAtPrice(
  order: WorkingPaperOrder,
  fillPriceCents: number,
  calendar: TradingCalendar,
): Extract<CloseMatch, { status: "filled" }> {
  if (!Number.isInteger(fillPriceCents) || fillPriceCents <= 0) {
    throw new Error("成交價不正確");
  }
  if (!Number.isInteger(order.shares) || order.shares < 1) {
    throw new Error("股數必須是正整數");
  }
  const notionalCents = fillPriceCents * order.shares;
  if (!Number.isSafeInteger(notionalCents)) throw new Error("成交金額過大");
  const feeCents = commissionCents(notionalCents);
  const taxCents = order.side === "sell" ? sellTaxCents(notionalCents) : 0;
  const settleOn = settlementDate(order.sessionDate, calendar);

  if (order.side === "buy") {
    const settlementCashCents = notionalCents + feeCents;
    if (order.reservedCashCents < settlementCashCents) {
      throw new Error("凍結現金不足以支付成交");
    }
    return {
      status: "filled",
      fillPriceCents,
      shares: order.shares,
      notionalCents,
      feeCents,
      taxCents: 0,
      settlementDate: settleOn,
      refundCashCents: order.reservedCashCents - settlementCashCents,
      settlementCashCents,
      settlementProceedsCents: 0,
      releasedShares: 0,
    };
  }

  return {
    status: "filled",
    fillPriceCents,
    shares: order.shares,
    notionalCents,
    feeCents,
    taxCents,
    settlementDate: settleOn,
    refundCashCents: 0,
    settlementCashCents: 0,
    settlementProceedsCents: notionalCents - feeCents - taxCents,
    releasedShares: 0,
  };
}

/** 還沒到該交易日 13:30 不成交；到了才用收盤價撮合。 */
export function matchSession(
  order: WorkingPaperOrder,
  closePriceCents: number | null,
  now: Date,
  calendar: TradingCalendar,
): CloseMatch {
  if (!closeAuctionReady(now, order.sessionDate)) {
    return { status: "waiting", reason: "session_open" };
  }
  return matchAtClose(order, closePriceCents, calendar);
}

function limitTouched(order: WorkingPaperOrder, closePriceCents: number): boolean {
  if (order.orderType === "market") return true;
  if (!Number.isInteger(order.limitPriceCents) || order.limitPriceCents === null || order.limitPriceCents <= 0) {
    throw new Error("限價不正確");
  }
  if (order.side === "buy") return closePriceCents <= order.limitPriceCents;
  return closePriceCents >= order.limitPriceCents;
}

function alignDownToTick(priceCents: number): number {
  const tick = priceTickCents(priceCents);
  const aligned = Math.floor(priceCents / tick) * tick;
  const nextTick = priceTickCents(aligned);
  if (nextTick === tick) return aligned;
  return Math.floor(aligned / nextTick) * nextTick;
}

function alignUpToTick(priceCents: number): number {
  const tick = priceTickCents(priceCents);
  const aligned = Math.ceil(priceCents / tick) * tick;
  const nextTick = priceTickCents(aligned);
  if (nextTick === tick) return aligned;
  return Math.ceil(aligned / nextTick) * nextTick;
}

function divRoundHalfUp(numerator: number, denominator: number): number {
  return Math.floor((numerator + Math.floor(denominator / 2)) / denominator);
}
