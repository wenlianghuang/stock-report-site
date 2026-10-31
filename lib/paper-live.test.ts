import { describe, expect, it } from "vitest";
import { weekdayCalendar } from "./paper-calendar";
import { matchQuote } from "./paper-live";
import type { LiveQuote } from "./paper-quote";
import type { WorkingPaperOrder } from "./paper-trade";

const calendar = weekdayCalendar();

function order(patch: Partial<WorkingPaperOrder> = {}): WorkingPaperOrder {
  return {
    side: "sell",
    orderType: "limit",
    limitPriceCents: 3_520,
    shares: 1000,
    reservedCashCents: 0,
    reservedShares: 1000,
    sessionDate: "2026-10-28",
    ...patch,
  };
}

function quote(patch: Partial<LiveQuote> = {}): LiveQuote {
  return {
    at: "2026-10-28T05:16:00.000Z",
    quoteAt: "2026-10-28T05:16:00.000Z",
    last: 3_545,
    lastAt: "2026-10-28T05:16:00.000Z",
    bid: 3_545,
    ask: 3_550,
    ...patch,
  };
}

describe("matchQuote", () => {
  it("buys at the ask and sells at the bid for market orders", () => {
    const buy = matchQuote(
      order({
        side: "buy",
        orderType: "market",
        limitPriceCents: null,
        reservedCashCents: 4_000_000,
        reservedShares: 0,
      }),
      quote(),
      calendar,
    );
    expect(buy).toMatchObject({ status: "filled", fillPriceCents: 3_550 });

    const sell = matchQuote(order({ orderType: "market", limitPriceCents: null }), quote(), calendar);
    expect(sell).toMatchObject({ status: "filled", fillPriceCents: 3_545 });
  });

  it("fills a limit buy at the last price, then at the ask when the last is above the limit", () => {
    const atLast = matchQuote(
      order({ side: "buy", limitPriceCents: 3_545, reservedCashCents: 4_000_000, reservedShares: 0 }),
      quote({ last: 3_540, ask: 3_550 }),
      calendar,
    );
    expect(atLast).toMatchObject({ status: "filled", fillPriceCents: 3_540 });

    const atAsk = matchQuote(
      order({ side: "buy", limitPriceCents: 3_550, reservedCashCents: 4_000_000, reservedShares: 0 }),
      quote({ last: 3_560, ask: 3_550 }),
      calendar,
    );
    expect(atAsk).toMatchObject({ status: "filled", fillPriceCents: 3_550 });
  });

  it("fills a limit sell at the bid when the last price is still below the limit", () => {
    const matched = matchQuote(order({ limitPriceCents: 3_545 }), quote({ last: 3_540, bid: 3_545 }), calendar);
    expect(matched).toMatchObject({ status: "filled", fillPriceCents: 3_545 });
  });

  it("leaves the order working when neither the last nor the opposite quote reaches the limit", () => {
    expect(
      matchQuote(
        order({ side: "buy", limitPriceCents: 3_530, reservedCashCents: 4_000_000, reservedShares: 0 }),
        quote({ last: 3_545, ask: 3_550 }),
        calendar,
      ),
    ).toEqual({ status: "waiting" });
  });

  it("waits when the market side of the book is missing", () => {
    expect(
      matchQuote(
        order({
          side: "buy",
          orderType: "market",
          limitPriceCents: null,
          reservedCashCents: 4_000_000,
          reservedShares: 0,
        }),
        quote({ ask: null }),
        calendar,
      ),
    ).toEqual({ status: "waiting" });
  });
});
