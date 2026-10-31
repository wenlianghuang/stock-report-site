import { describe, expect, it } from "vitest";
import { liveQuotesFromMis, quoteAfterOrder } from "./paper-quote";

describe("live quotes", () => {
  it("reads the latest trade, bid, and ask, and ignores the day's high and low", () => {
    const observed = new Date("2026-10-28T13:25:06+08:00");
    const quotes = liveQuotesFromMis(
      {
        rtcode: "0000",
        msgArray: [
          {
            c: "2409",
            z: "-",
            a: "35.5000_35.5500_35.6000_",
            b: "35.4500_35.4000_35.3500_",
            d: "20261028",
            t: "13:24:01",
            tlong: "1793165041000",
            h: "35.6500",
            l: "33.9000",
            trade: { t: "13:23:51", z: "35.4500" },
          },
        ],
      },
      observed,
    );

    expect(quotes.get("2409")).toEqual({
      at: observed.toISOString(),
      quoteAt: new Date(1_793_165_041_000).toISOString(),
      last: 3_545,
      lastAt: new Date("2026-10-28T13:23:51+08:00").toISOString(),
      bid: 3_545,
      ask: 3_550,
    });
  });

  it("drops a last trade that printed before the order and keeps the current book", () => {
    const quote = {
      at: new Date("2026-10-28T13:24:05+08:00").toISOString(),
      quoteAt: new Date("2026-10-28T13:24:01+08:00").toISOString(),
      last: 3_545,
      lastAt: new Date("2026-10-28T13:16:00+08:00").toISOString(),
      bid: 3_540,
      ask: 3_550,
    };
    const submitted = new Date("2026-10-28T13:20:00+08:00").toISOString();
    expect(quoteAfterOrder(quote, submitted)).toMatchObject({ last: null, ask: 3_550, bid: 3_540 });
    expect(quoteAfterOrder({ ...quote, at: submitted }, submitted)).toBeNull();
  });
});
