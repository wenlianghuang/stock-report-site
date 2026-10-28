import { describe, expect, it } from "vitest";
import { previousTradingDay, weekdayCalendar } from "./paper-calendar";
import { OPENING_CASH_CENTS } from "./paper-ledger";
import {
  bookAvailableCash,
  bookAvailableShares,
  cancelOnBook,
  emptyPaperBook,
  placeOnBook,
  positionAvgCostCents,
  runPaperClose,
  runPaperTick,
  type PaperBook,
  type PlaceOrderInput,
} from "./paper-session";
import type { LiveQuote } from "./paper-quote";
import type { PaperInstrument } from "./paper-trade";

const TSMC: PaperInstrument = { stockId: "2330", market: "twse", commonStock: true };
const PREVIOUS_CLOSE = 10_000;
const calendar = weekdayCalendar();

function at(local: string): Date {
  return new Date(`${local}+08:00`);
}

function ids() {
  let n = 0;
  return () => `id-${n += 1}`;
}

function place(
  book: PaperBook,
  overrides: Partial<PlaceOrderInput> & Pick<PlaceOrderInput, "orderId">,
): ReturnType<typeof placeOnBook> {
  return placeOnBook(book, {
    instrument: TSMC,
    side: "buy",
    orderType: "market",
    limitPriceCents: null,
    shares: 1000,
    previousCloseCents: PREVIOUS_CLOSE,
    submittedAt: at("2026-03-02T10:00:00"),
    calendar,
    ...overrides,
  });
}

describe("paper session", () => {
  it("finds the previous trading day", () => {
    expect(previousTradingDay("2026-03-02", calendar)).toBe("2026-02-27");
  });

  it("rejects a buy that cannot be reserved and does not open a position", () => {
    const book = emptyPaperBook(OPENING_CASH_CENTS);
    const rejected = place(book, { orderId: "too-big", shares: 100_000 });
    expect(rejected.ok).toBe(false);
    if (rejected.ok) return;
    expect(rejected.reason).toBe("insufficient_cash");
    expect(rejected.book).toBe(book);
    expect(book.positions).toEqual([]);
    expect(book.cashCents).toBe(OPENING_CASH_CENTS);
  });

  it("cancels a working order and releases the freeze", () => {
    const book = emptyPaperBook(OPENING_CASH_CENTS);
    const placed = place(book, { orderId: "limit-1", orderType: "limit", limitPriceCents: PREVIOUS_CLOSE });
    if (!placed.ok) throw new Error(placed.reason);
    expect(bookAvailableCash(placed.book)).toBeLessThan(OPENING_CASH_CENTS);

    const cancelled = cancelOnBook(placed.book, "limit-1");
    if (!cancelled.ok) throw new Error(cancelled.reason);
    expect(cancelled.releasedCashCents).toBe(placed.order.reservedCashCents);
    expect(bookAvailableCash(cancelled.book)).toBe(OPENING_CASH_CENTS);
    expect(cancelled.book.cashCents).toBe(OPENING_CASH_CENTS);
  });

  it("keeps a filled buy unsettled, then applies shares and cash once", () => {
    let book = emptyPaperBook(OPENING_CASH_CENTS);
    const bought = place(book, { orderId: "buy-1" });
    if (!bought.ok) throw new Error(bought.reason);
    const missed = place(bought.book, {
      orderId: "buy-limit",
      orderType: "limit",
      limitPriceCents: 9_000,
    });
    if (!missed.ok) throw new Error(missed.reason);
    book = missed.book;

    const tooEarly = runPaperClose(book, {
      now: at("2026-03-02T10:30:00"),
      calendar,
      createId: ids(),
      closeOf: () => PREVIOUS_CLOSE,
    });
    expect(tooEarly.ops).toEqual([]);
    expect(tooEarly.book.positions).toEqual([]);

    const closed = runPaperClose(book, {
      now: at("2026-03-02T13:30:00"),
      calendar,
      createId: ids(),
      closeOf: () => PREVIOUS_CLOSE,
    });
    expect(closed.ops.map((op) => op.op)).toEqual(["fill", "expire"]);
    const filled = closed.ops[0];
    if (filled?.op !== "fill") throw new Error("missing fill");
    expect(bookAvailableCash(closed.book)).toBe(OPENING_CASH_CENTS + filled.cashCents);
    expect(closed.book.cashCents).toBe(OPENING_CASH_CENTS);
    expect(closed.book.positions).toEqual([]);
    expect(bookAvailableShares(closed.book, "2330")).toBe(0);

    const sellTooSoon = place(closed.book, {
      orderId: "sell-too-soon",
      side: "sell",
      submittedAt: at("2026-03-03T10:00:00"),
    });
    expect(sellTooSoon.ok).toBe(false);
    if (sellTooSoon.ok) return;
    expect(sellTooSoon.reason).toBe("insufficient_settled_shares");
    expect(closed.book.positions).toEqual([]);

    const again = runPaperClose(closed.book, {
      now: at("2026-03-02T14:00:00"),
      calendar,
      createId: ids(),
      closeOf: () => PREVIOUS_CLOSE,
    });
    expect(again.ops).toEqual([]);
    expect(again.book.cashCents).toBe(OPENING_CASH_CENTS);

    const settled = runPaperClose(closed.book, {
      now: at("2026-03-04T13:30:00"),
      calendar,
      createId: ids(),
      closeOf: () => PREVIOUS_CLOSE,
    });
    expect(settled.ops.map((op) => op.op)).toEqual(["settle"]);
    expect(settled.book.cashCents).toBeLessThan(OPENING_CASH_CENTS);
    expect(settled.book.positions).toEqual([
      expect.objectContaining({ stockId: "2330", settledShares: 1000 }),
    ]);
    const position = settled.book.positions[0];
    if (!position) throw new Error("missing position");
    expect(positionAvgCostCents(position)).toBeGreaterThan(PREVIOUS_CLOSE);

    const settledAgain = runPaperClose(settled.book, {
      now: at("2026-03-04T14:00:00"),
      calendar,
      createId: ids(),
      closeOf: () => PREVIOUS_CLOSE,
    });
    expect(settledAgain.ops).toEqual([]);
    expect(settledAgain.book.cashCents).toBe(settled.book.cashCents);
    expect(settledAgain.book.positions).toEqual(settled.book.positions);
  });

  it("realizes a sell once and clears the position", () => {
    let book = emptyPaperBook(OPENING_CASH_CENTS);
    const bought = place(book, { orderId: "buy-1" });
    if (!bought.ok) throw new Error(bought.reason);
    const filled = runPaperClose(bought.book, {
      now: at("2026-03-02T13:30:00"),
      calendar,
      createId: ids(),
      closeOf: () => PREVIOUS_CLOSE,
    });
    const held = runPaperClose(filled.book, {
      now: at("2026-03-04T13:30:00"),
      calendar,
      createId: ids(),
      closeOf: () => PREVIOUS_CLOSE,
    });
    book = held.book;
    const cashAfterBuy = book.cashCents;

    const sold = place(book, {
      orderId: "sell-1",
      side: "sell",
      submittedAt: at("2026-03-05T10:00:00"),
    });
    if (!sold.ok) throw new Error(sold.reason);
    expect(bookAvailableShares(sold.book, "2330")).toBe(0);

    const matched = runPaperClose(sold.book, {
      now: at("2026-03-05T13:30:00"),
      calendar,
      createId: ids(),
      closeOf: () => PREVIOUS_CLOSE,
    });
    expect(matched.book.cashCents).toBe(cashAfterBuy);
    expect(matched.book.positions).toEqual(book.positions);
    expect(bookAvailableShares(matched.book, "2330")).toBe(0);

    const realized = runPaperClose(matched.book, {
      now: at("2026-03-09T13:30:00"),
      calendar,
      createId: ids(),
      closeOf: () => PREVIOUS_CLOSE,
    });
    expect(realized.ops.map((op) => op.op)).toEqual(["settle"]);
    expect(realized.book.positions).toEqual([]);
    expect(realized.book.cashCents).not.toBe(cashAfterBuy);
    const settlement = realized.book.settlements.find((row) => row.orderId === "sell-1");
    expect(settlement?.status).toBe("settled");
    expect(settlement?.realizedPnlCents).not.toBeNull();

    const repeat = runPaperClose(realized.book, {
      now: at("2026-03-09T14:00:00"),
      calendar,
      createId: ids(),
      closeOf: () => PREVIOUS_CLOSE,
    });
    expect(repeat.ops).toEqual([]);
    expect(repeat.book.cashCents).toBe(realized.book.cashCents);
    expect(repeat.book.positions).toEqual([]);
  });

  it("fills a market buy at the ask and does not fill it again", () => {
    const book = emptyPaperBook(OPENING_CASH_CENTS);
    const placed = place(book, { orderId: "buy-live", shares: 1 });
    if (!placed.ok) throw new Error(placed.reason);
    const quote = liveQuote({
      at: at("2026-03-02T10:06:00").toISOString(),
      ask: PREVIOUS_CLOSE - 50,
      last: PREVIOUS_CLOSE,
    });

    const ticked = runPaperTick(placed.book, {
      now: at("2026-03-02T10:06:00"),
      calendar,
      createId: ids(),
      closeOf: () => PREVIOUS_CLOSE,
      quotesOf: () => quote,
    });
    expect(ticked.ops.map((op) => op.op)).toEqual(["fill"]);
    expect(ticked.ops[0]).toMatchObject({ op: "fill", fillPriceCents: PREVIOUS_CLOSE - 50 });
    expect(ticked.book.orders[0]?.status).toBe("filled");
    expect(ticked.book.positions).toEqual([]);
    expect(ticked.book.settlements[0]?.status).toBe("pending");
    expect(ticked.book.cashCents).toBe(OPENING_CASH_CENTS);

    const again = runPaperTick(ticked.book, {
      now: at("2026-03-02T10:07:00"),
      calendar,
      createId: ids(),
      closeOf: () => PREVIOUS_CLOSE,
      quotesOf: () => quote,
    });
    expect(again.ops).toEqual([]);
    expect(again.book.fills).toHaveLength(1);
  });

  it("ignores a quote taken before the order, then fills on a later ask", () => {
    const book = emptyPaperBook(OPENING_CASH_CENTS);
    const placed = place(book, {
      orderId: "buy-late",
      orderType: "limit",
      limitPriceCents: PREVIOUS_CLOSE,
      shares: 1,
      submittedAt: at("2026-03-02T11:18:00"),
    });
    if (!placed.ok) throw new Error(placed.reason);
    const early = liveQuote({
      at: at("2026-03-02T11:17:00").toISOString(),
      lastAt: at("2026-03-02T11:17:00").toISOString(),
      last: PREVIOUS_CLOSE - 50,
      ask: PREVIOUS_CLOSE - 50,
    });
    const untouched = runPaperTick(placed.book, {
      now: at("2026-03-02T11:30:00"),
      calendar,
      createId: ids(),
      closeOf: () => null,
      quotesOf: () => early,
    });
    expect(untouched.ops).toEqual([]);
    expect(untouched.book.orders[0]?.status).toBe("working");

    const later = liveQuote({
      at: at("2026-03-02T11:20:00").toISOString(),
      lastAt: at("2026-03-02T11:17:00").toISOString(),
      last: PREVIOUS_CLOSE - 50,
      ask: PREVIOUS_CLOSE,
    });
    const filled = runPaperTick(placed.book, {
      now: at("2026-03-02T11:30:00"),
      calendar,
      createId: ids(),
      closeOf: () => null,
      quotesOf: () => later,
    });
    expect(filled.ops.map((op) => op.op)).toEqual(["fill"]);
    expect(filled.ops[0]).toMatchObject({ op: "fill", fillPriceCents: PREVIOUS_CLOSE });
  });

  it("after 13:30 uses the closing price instead of the live quote", () => {
    const book = emptyPaperBook(OPENING_CASH_CENTS);
    const placed = place(book, { orderId: "buy-close", shares: 1 });
    if (!placed.ok) throw new Error(placed.reason);
    const quote = liveQuote({
      at: at("2026-03-02T13:29:00").toISOString(),
      ask: PREVIOUS_CLOSE - 100,
    });
    const ticked = runPaperTick(placed.book, {
      now: at("2026-03-02T13:31:00"),
      calendar,
      createId: ids(),
      closeOf: () => PREVIOUS_CLOSE,
      quotesOf: () => quote,
    });
    expect(ticked.ops[0]).toMatchObject({ op: "fill", fillPriceCents: PREVIOUS_CLOSE });
  });
});

function liveQuote(patch: Partial<LiveQuote> = {}): LiveQuote {
  return {
    at: at("2026-03-02T10:06:00").toISOString(),
    quoteAt: at("2026-03-02T10:05:50").toISOString(),
    last: PREVIOUS_CLOSE,
    lastAt: at("2026-03-02T10:05:50").toISOString(),
    bid: PREVIOUS_CLOSE - 50,
    ask: PREVIOUS_CLOSE,
    ...patch,
  };
}
