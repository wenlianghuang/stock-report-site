import { describe, expect, it } from "vitest";
import { weekdayCalendar } from "./paper-calendar";
import { matchPrint, matchQuote } from "./paper-live";
import type { LiveQuote, MinuteBar } from "./paper-quote";
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

function bar(patch: Partial<MinuteBar> = {}): MinuteBar {
  return {
    at: "2026-10-28T03:20:00.000Z",
    open: 3_500,
    high: 3_530,
    low: 3_490,
    last: 3_515,
    ...patch,
  };
}

describe("matchPrint", () => {
  it("fills a limit sell at the limit when the high touches and the last has fallen back", () => {
    const matched = matchPrint(order(), bar(), calendar);
    expect(matched.status).toBe("filled");
    if (matched.status !== "filled") return;
    expect(matched.fillPriceCents).toBe(3_520);
  });

  it("fills a limit sell at the last price while it is still at or above the limit", () => {
    const matched = matchPrint(order(), bar({ last: 3_525, high: 3_530 }), calendar);
    expect(matched).toMatchObject({ status: "filled", fillPriceCents: 3_525 });
  });

  it("leaves a limit sell working when the high never reaches the limit", () => {
    expect(matchPrint(order(), bar({ high: 3_510, last: 3_500 }), calendar)).toEqual({
      status: "waiting",
    });
  });

  it("fills a limit buy when the low touches, using the limit if the last has bounced", () => {
    const matched = matchPrint(
      order({
        side: "buy",
        reservedCashCents: 4_000_000,
        reservedShares: 0,
      }),
      bar({ low: 3_500, last: 3_530, high: 3_540 }),
      calendar,
    );
    expect(matched).toMatchObject({ status: "filled", fillPriceCents: 3_520 });
  });

  it("fills a market order at the minute's last price", () => {
    const matched = matchPrint(
      order({
        side: "buy",
        orderType: "market",
        limitPriceCents: null,
        shares: 1,
        reservedCashCents: 500_000,
        reservedShares: 0,
      }),
      bar({ last: 3_515 }),
      calendar,
    );
    expect(matched).toMatchObject({ status: "filled", fillPriceCents: 3_515, shares: 1 });
  });

  it("skips a bar with a price outside its own range", () => {
    expect(matchPrint(order(), bar({ last: 3_600 }), calendar)).toEqual({ status: "unusable" });
  });
});

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
