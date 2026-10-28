/**
 * 下單、取消、盤中撮合、收盤撮合、交割。
 * 下單只凍結。09:00–13:30 用證交所當下報價全部成交；13:30 後沒碰到的單改看收盤價。
 * 成交後股票先記成待交割，交割日才改現金與已交割部位。
 * 不讀寫真實持股。
 */

import { intradayQuoteReady, taipeiParts, type CloseMatch } from "@/lib/paper-trade";
import { matchQuote } from "@/lib/paper-live";
import { quoteAfterOrder, type LiveQuote } from "@/lib/paper-quote";
import {
  availableCashCents,
  availableSettledShares,
  postCashMovement,
  settlementMovement,
  type PaperBooks,
} from "@/lib/paper-ledger";
import {
  cancelWorkingOrder,
  matchSession,
  submitPaperOrder,
  type PaperInstrument,
  type PaperMarket,
  type PaperOrderType,
  type PaperSide,
} from "@/lib/paper-trade";
import type { TradingCalendar } from "@/lib/paper-calendar";

export type PaperOrderStatus = "working" | "filled" | "expired" | "cancelled" | "rejected";

export type SessionOrder = {
  id: string;
  stockId: string;
  market: PaperMarket;
  side: PaperSide;
  orderType: PaperOrderType;
  limitPriceCents: number | null;
  lots: number;
  shares: number;
  sessionDate: string;
  status: PaperOrderStatus;
  reservedCashCents: number;
  reservedShares: number;
  limitUpCents: number;
  limitDownCents: number;
  rejectReason: string | null;
  expireReason: string | null;
  submittedAt: string;
};

export type SessionFill = {
  id: string;
  orderId: string;
  stockId: string;
  side: PaperSide;
  fillPriceCents: number;
  shares: number;
  notionalCents: number;
  feeCents: number;
  taxCents: number;
  sessionDate: string;
};

export type SessionSettlement = {
  id: string;
  orderId: string;
  fillId: string;
  stockId: string;
  side: PaperSide;
  settleOn: string;
  status: "pending" | "settled";
  shares: number;
  /** 買進為負（含手續費）；賣出為淨收入。 */
  cashCents: number;
  realizedPnlCents: number | null;
};

export type SessionPosition = {
  stockId: string;
  settledShares: number;
  costBasisCents: number;
};

export type PaperBook = {
  cashCents: number;
  orders: SessionOrder[];
  fills: SessionFill[];
  settlements: SessionSettlement[];
  positions: SessionPosition[];
};

export type PlaceOrderInput = {
  instrument: PaperInstrument;
  side: PaperSide;
  orderType: PaperOrderType;
  limitPriceCents: number | null;
  shares: number;
  previousCloseCents: number | null;
  submittedAt: Date;
  calendar: TradingCalendar;
  orderId: string;
};

export type PlaceOrderResult =
  | { ok: true; book: PaperBook; order: SessionOrder }
  | { ok: false; book: PaperBook; reason: string };

export type CancelOrderResult =
  | { ok: true; book: PaperBook; releasedCashCents: number; releasedShares: number }
  | { ok: false; book: PaperBook; reason: "order_not_working" | "order_not_found" };

export type PaperCloseOp =
  | { op: "expire"; orderId: string; reason: string }
  | {
      op: "fill";
      orderId: string;
      fillId: string;
      settlementId: string;
      fillPriceCents: number;
      shares: number;
      notionalCents: number;
      feeCents: number;
      taxCents: number;
      settleOn: string;
      cashCents: number;
    }
  | {
      op: "settle";
      settlementId: string;
      settledShares: number;
      avgCostCents: number | null;
      costBasisCents: number | null;
      realizedPnlCents: number | null;
    };

export type CloseRun = {
  book: PaperBook;
  ops: PaperCloseOp[];
};

export function emptyPaperBook(cashCents: number): PaperBook {
  return {
    cashCents,
    orders: [],
    fills: [],
    settlements: [],
    positions: [],
  };
}

export function positionAvgCostCents(position: SessionPosition): number | null {
  if (position.settledShares <= 0) return null;
  return roundDiv(position.costBasisCents, position.settledShares);
}

export function bookAvailableCash(book: PaperBook): number {
  return availableCashCents({
    cashCents: book.cashCents,
    workingBuyReservedCents: sum(
      book.orders.filter((order) => order.status === "working" && order.side === "buy"),
      (order) => order.reservedCashCents,
    ),
    pendingBuyCashCents: sum(
      book.settlements.filter((row) => row.status === "pending" && row.side === "buy"),
      (row) => -row.cashCents,
    ),
  });
}

export function bookAvailableShares(book: PaperBook, stockId: string): number {
  return availableSettledShares({
    settledShares: positionOf(book, stockId).settledShares,
    workingSellReservedShares: sum(
      book.orders.filter(
        (order) => order.status === "working" && order.side === "sell" && order.stockId === stockId,
      ),
      (order) => order.reservedShares,
    ),
    pendingSellShares: sum(
      book.settlements.filter(
        (row) => row.status === "pending" && row.side === "sell" && row.stockId === stockId,
      ),
      (row) => row.shares,
    ),
  });
}

export function placeOnBook(book: PaperBook, input: PlaceOrderInput): PlaceOrderResult {
  if (book.orders.some((order) => order.id === input.orderId)) {
    throw new Error("委託編號重複");
  }

  const decided = submitPaperOrder({
    instrument: input.instrument,
    side: input.side,
    orderType: input.orderType,
    limitPriceCents: input.limitPriceCents,
    shares: input.shares,
    previousCloseCents: input.previousCloseCents,
    submittedAt: input.submittedAt,
    calendar: input.calendar,
    availableCashCents: bookAvailableCash(book),
    settledShares: bookAvailableShares(book, input.instrument?.stockId ?? ""),
  });

  if (decided.status === "rejected") {
    return { ok: false, book, reason: decided.reason };
  }
  if (!input.instrument) {
    return { ok: false, book, reason: "invalid_stock" };
  }

  const order: SessionOrder = {
    id: input.orderId,
    stockId: input.instrument.stockId,
    market: input.instrument.market,
    side: decided.side,
    orderType: decided.orderType,
    limitPriceCents: decided.limitPriceCents,
    lots: decided.lots,
    shares: decided.shares,
    sessionDate: decided.sessionDate,
    status: "working",
    reservedCashCents: decided.reservedCashCents,
    reservedShares: decided.reservedShares,
    limitUpCents: decided.limitUpCents,
    limitDownCents: decided.limitDownCents,
    rejectReason: null,
    expireReason: null,
    submittedAt: input.submittedAt.toISOString(),
  };

  return {
    ok: true,
    book: { ...book, orders: [...book.orders, order] },
    order,
  };
}

export function cancelOnBook(book: PaperBook, orderId: string): CancelOrderResult {
  const order = book.orders.find((row) => row.id === orderId);
  if (!order) return { ok: false, book, reason: "order_not_found" };
  const cancelled = cancelWorkingOrder(order);
  if (cancelled.status === "rejected") {
    return { ok: false, book, reason: "order_not_working" };
  }

  return {
    ok: true,
    releasedCashCents: cancelled.releasedCashCents,
    releasedShares: cancelled.releasedShares,
    book: {
      ...book,
      orders: book.orders.map((row) =>
        row.id === orderId ? { ...row, status: "cancelled" } : row,
      ),
    },
  };
}

/**
 * 盤中先用這次報價撮合，再跑收盤撮合與交割。
 * 報價暫時沒有、或早於下單時，單子繼續掛著，不會被收盤邏輯提前到期。
 */
export function runPaperTick(
  book: PaperBook,
  input: {
    now: Date;
    calendar: TradingCalendar;
    createId: () => string;
    closeOf: (stockId: string, sessionDate: string) => number | null;
    quotesOf: (stockId: string) => LiveQuote | null;
  },
): CloseRun {
  const ops: PaperCloseOp[] = [];
  let next = book;
  const working = workingOrders(next);

  for (const order of working) {
    if (!intradayQuoteReady(input.now, order.sessionDate)) continue;
    const quote = input.quotesOf(order.stockId);
    if (!quote) continue;
    const eligible = quoteAfterOrder(quote, order.submittedAt);
    if (!eligible) continue;
    const matched = matchQuote(order, eligible, input.calendar);
    if (matched.status !== "filled") continue;
    const applied = applyFill(next, order, matched, input.createId(), input.createId());
    next = applied.book;
    ops.push(applied.op);
  }

  const closed = runPaperClose(next, input);
  return { book: closed.book, ops: [...ops, ...closed.ops] };
}

/**
 * 先撮合已收盤的掛單，再交割到期的成交。
 * closeOf 沒有那一天的收盤價時，單子繼續掛著。
 */
export function runPaperClose(
  book: PaperBook,
  input: {
    now: Date;
    calendar: TradingCalendar;
    createId: () => string;
    closeOf: (stockId: string, sessionDate: string) => number | null;
  },
): CloseRun {
  const ops: PaperCloseOp[] = [];
  let next = book;
  const today = taipeiParts(input.now).isoDate;

  const working = workingOrders(next);

  for (const order of working) {
    const matched = matchSession(
      order,
      input.closeOf(order.stockId, order.sessionDate),
      input.now,
      input.calendar,
    );
    if (matched.status === "waiting") continue;

    if (matched.status === "expired") {
      next = {
        ...next,
        orders: next.orders.map((row) =>
          row.id === order.id
            ? { ...row, status: "expired", expireReason: matched.reason }
            : row,
        ),
      };
      ops.push({ op: "expire", orderId: order.id, reason: matched.reason });
      continue;
    }

    const applied = applyFill(next, order, matched, input.createId(), input.createId());
    next = applied.book;
    ops.push(applied.op);
  }

  const due = next.settlements
    .filter((row) => row.status === "pending" && row.settleOn <= today)
    .slice()
    .sort((a, b) => {
      const byDate = a.settleOn.localeCompare(b.settleOn);
      if (byDate !== 0) return byDate;
      if (a.side !== b.side) return a.side === "buy" ? -1 : 1;
      return a.id.localeCompare(b.id);
    });

  for (const settlement of due) {
    const applied = applySettlement(next, settlement);
    next = applied.book;
    ops.push(applied.op);
  }

  return { book: next, ops };
}

function workingOrders(book: PaperBook): SessionOrder[] {
  return book.orders
    .filter((order) => order.status === "working")
    .slice()
    .sort((a, b) => a.sessionDate.localeCompare(b.sessionDate) || a.id.localeCompare(b.id));
}

function applyFill(
  book: PaperBook,
  order: SessionOrder,
  matched: Extract<CloseMatch, { status: "filled" }>,
  fillId: string,
  settlementId: string,
): { book: PaperBook; op: PaperCloseOp } {
  const cashCents = order.side === "buy" ? -matched.settlementCashCents : matched.settlementProceedsCents;
  if (cashCents === 0) throw new Error("結算金額不正確");

  const fill: SessionFill = {
    id: fillId,
    orderId: order.id,
    stockId: order.stockId,
    side: order.side,
    fillPriceCents: matched.fillPriceCents,
    shares: matched.shares,
    notionalCents: matched.notionalCents,
    feeCents: matched.feeCents,
    taxCents: matched.taxCents,
    sessionDate: order.sessionDate,
  };
  const settlement: SessionSettlement = {
    id: settlementId,
    orderId: order.id,
    fillId,
    stockId: order.stockId,
    side: order.side,
    settleOn: matched.settlementDate,
    status: "pending",
    shares: matched.shares,
    cashCents,
    realizedPnlCents: null,
  };
  return {
    book: {
      ...book,
      orders: book.orders.map((row) => (row.id === order.id ? { ...row, status: "filled" } : row)),
      fills: [...book.fills, fill],
      settlements: [...book.settlements, settlement],
    },
    op: {
      op: "fill",
      orderId: order.id,
      fillId,
      settlementId,
      fillPriceCents: fill.fillPriceCents,
      shares: fill.shares,
      notionalCents: fill.notionalCents,
      feeCents: fill.feeCents,
      taxCents: fill.taxCents,
      settleOn: settlement.settleOn,
      cashCents,
    },
  };
}

function applySettlement(
  book: PaperBook,
  settlement: SessionSettlement,
): { book: PaperBook; op: PaperCloseOp } {
  const current = positionOf(book, settlement.stockId);
  let settledShares: number;
  let costBasisCents: number;
  let realizedPnlCents: number | null = null;

  if (settlement.side === "buy") {
    const cost = -settlement.cashCents;
    if (cost <= 0) throw new Error("結算金額不正確");
    settledShares = current.settledShares + settlement.shares;
    costBasisCents = current.costBasisCents + cost;
  } else {
    if (current.settledShares < settlement.shares) throw new Error("已交割股數不足");
    const removed =
      settlement.shares === current.settledShares
        ? current.costBasisCents
        : Math.floor((current.costBasisCents * settlement.shares) / current.settledShares);
    settledShares = current.settledShares - settlement.shares;
    costBasisCents = current.costBasisCents - removed;
    realizedPnlCents = settlement.cashCents - removed;
  }

  if (!Number.isSafeInteger(settledShares) || !Number.isSafeInteger(costBasisCents)) {
    throw new Error("部位成本不正確");
  }
  if (settledShares > 0 && costBasisCents <= 0) throw new Error("部位成本不正確");

  const posted = postCashMovement(toLedger(book), settlementMovement(settlement.orderId, settlement.cashCents));
  if (!posted.posted) throw new Error("交割已入帳");

  const avgCostCents = settledShares === 0 ? null : roundDiv(costBasisCents, settledShares);
  if (settledShares > 0 && (avgCostCents === null || avgCostCents <= 0)) {
    throw new Error("部位成本不正確");
  }

  const positions =
    settledShares === 0
      ? book.positions.filter((row) => row.stockId !== settlement.stockId)
      : upsertPosition(book.positions, {
          stockId: settlement.stockId,
          settledShares,
          costBasisCents,
        });

  return {
    book: {
      ...book,
      cashCents: posted.books.cashCents,
      positions,
      settlements: book.settlements.map((row) =>
        row.id === settlement.id
          ? { ...row, status: "settled", realizedPnlCents }
          : row,
      ),
    },
    op: {
      op: "settle",
      settlementId: settlement.id,
      settledShares,
      avgCostCents,
      costBasisCents: settledShares === 0 ? null : costBasisCents,
      realizedPnlCents,
    },
  };
}

function toLedger(book: PaperBook): PaperBooks {
  return {
    cashCents: book.cashCents,
    movements: book.settlements
      .filter((row) => row.status === "settled")
      .map((row) => settlementMovement(row.orderId, row.cashCents)),
  };
}

function positionOf(book: PaperBook, stockId: string): SessionPosition {
  return (
    book.positions.find((row) => row.stockId === stockId) ?? {
      stockId,
      settledShares: 0,
      costBasisCents: 0,
    }
  );
}

function upsertPosition(positions: SessionPosition[], next: SessionPosition): SessionPosition[] {
  const index = positions.findIndex((row) => row.stockId === next.stockId);
  if (index < 0) return [...positions, next];
  return positions.map((row, i) => (i === index ? next : row));
}

function sum<T>(rows: T[], value: (row: T) => number): number {
  return rows.reduce((total, row) => total + value(row), 0);
}

function roundDiv(numerator: number, denominator: number): number {
  return Math.floor((numerator + Math.floor(denominator / 2)) / denominator);
}
