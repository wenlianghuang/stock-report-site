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
      bids: [
        { priceCents: 3_545, lots: null },
        { priceCents: 3_540, lots: null },
        { priceCents: 3_535, lots: null },
      ],
      asks: [
        { priceCents: 3_550, lots: null },
        { priceCents: 3_555, lots: null },
        { priceCents: 3_560, lots: null },
      ],
    });
  });

  it("lists five prices with board lots and skips a blank level", () => {
    const quotes = liveQuotesFromMis(
      {
        msgArray: [
          {
            c: "2330",
            z: "2350.0000",
            a: "2355.0000_2360.0000_2365.0000_2370.0000_2375.0000_2380.0000_",
            b: "-_2345.0000_2340.0000_2335.0000_2330.0000_",
            f: "37_527_1011_863_906_12_",
            g: "-_667_x_995_882_",
            d: "20261113",
            t: "13:30:00",
          },
        ],
      },
      new Date("2026-11-13T13:30:01+08:00"),
    );

    expect(quotes.get("2330")).toMatchObject({
      bid: null,
      ask: 235_500,
      bids: [
        { priceCents: 234_500, lots: 667 },
        { priceCents: 234_000, lots: null },
        { priceCents: 233_500, lots: 995 },
        { priceCents: 233_000, lots: 882 },
      ],
      asks: [
        { priceCents: 235_500, lots: 37 },
        { priceCents: 236_000, lots: 527 },
        { priceCents: 236_500, lots: 1_011 },
        { priceCents: 237_000, lots: 863 },
        { priceCents: 237_500, lots: 906 },
      ],
    });
  });

  it("prefers the exchange clock when the numeric timestamp is an hour later", () => {
    const quotes = liveQuotesFromMis(
      {
        msgArray: [
          {
            c: "2330",
            z: "2350.0000",
            d: "20261113",
            t: "13:30:00",
            tlong: "1794551400000",
          },
        ],
      },
      new Date("2026-11-14T02:00:00+08:00"),
    );

    expect(quotes.get("2330")?.quoteAt).toBe(new Date("2026-11-13T13:30:00+08:00").toISOString());
  });

  it("drops a last trade that printed before the order and keeps the current book", () => {
    const quote = {
      at: new Date("2026-10-28T13:24:05+08:00").toISOString(),
      quoteAt: new Date("2026-10-28T13:24:01+08:00").toISOString(),
      last: 3_545,
      lastAt: new Date("2026-10-28T13:16:00+08:00").toISOString(),
      bid: 3_540,
      ask: 3_550,
      bids: [{ priceCents: 3_540, lots: 20 }],
      asks: [{ priceCents: 3_550, lots: 12 }],
    };
    const submitted = new Date("2026-10-28T13:20:00+08:00").toISOString();
    expect(quoteAfterOrder(quote, submitted)).toMatchObject({
      last: null,
      ask: 3_550,
      bid: 3_540,
      bids: quote.bids,
      asks: quote.asks,
    });
    expect(quoteAfterOrder({ ...quote, at: submitted }, submitted)).toBeNull();
  });
});
