import { describe, expect, it } from "vitest";
import {
  parseTwseHolidayCsv,
  settlementDate,
  twseCalendar,
  weekdayCalendar,
} from "./paper-calendar";
import {
  cancelWorkingOrder,
  closeAuctionReady,
  intradayQuoteReady,
  commissionCents,
  formatTwdFromCents,
  matchAtClose,
  matchSession,
  orderSessionDate,
  paperRuleText,
  parseTwdToCents,
  priceBand,
  sellTaxCents,
  submitPaperOrder,
  type PaperInstrument,
  type SubmitPaperOrderInput,
} from "./paper-trade";

const TSMC: PaperInstrument = {
  stockId: "2330",
  market: "twse",
  commonStock: true,
};

const CLOSE_2385 = 238_500;

const SAMPLE_CSV = `"中華民國115年有價證券集中交易市場開（休）市日期表"
"日期","名稱","說明","備註(* : 市場無交易，僅辦理結算交割作業。o : 交易日。)"
"1月1日 (四)","中華民國開國紀念日","依規定放假1日。",""
"1月2日 (五)","國曆新年開始交易日","國曆新年開始交易。","o"
"2月11日 (三)","農曆春節前最後交易日","農曆春節前最後交易。","o"
"2月12日 (四)","市場無交易，僅辦理結算交割作業","","*"
"2月13日 (五)","市場無交易，僅辦理結算交割作業","","*"
"2月15日 (日)","農曆除夕及春節","依規定放假。",""
"2月16日 (一)","農曆除夕及春節","依規定放假。",""
"2月23日 (一)","農曆春節後開始交易日","農曆春節後開始交易。","o"
"5月1日 (五)","勞動節","依規定放假1日。",""
`;

function taipei(isoLocal: string): Date {
  return new Date(`${isoLocal}+08:00`);
}

function orderInput(overrides: Partial<SubmitPaperOrderInput> = {}): SubmitPaperOrderInput {
  return {
    instrument: TSMC,
    side: "buy",
    orderType: "limit",
    limitPriceCents: CLOSE_2385,
    shares: 1000,
    previousCloseCents: CLOSE_2385,
    submittedAt: taipei("2026-03-02T10:00:00"),
    calendar: weekdayCalendar(),
    availableCashCents: 10_000_000_00,
    settledShares: 0,
    ...overrides,
  };
}

describe("parseTwseHolidayCsv", () => {
  const calendar = twseCalendar([parseTwseHolidayCsv(SAMPLE_CSV, 1990)]);

  it("reads the ROC year and the same remark rules as the Python calendar", () => {
    const schedule = parseTwseHolidayCsv(SAMPLE_CSV, 1990);
    expect(schedule.year).toBe(2026);
    expect(schedule.remarks.get("2026-02-12")).toBe("*");
    expect(calendar.isTradingDay("2026-01-01")).toBe(false);
    expect(calendar.isTradingDay("2026-01-02")).toBe(true);
    expect(calendar.isTradingDay("2026-02-12")).toBe(false);
    expect(calendar.isTradingDay("2026-02-14")).toBe(false);
    expect(calendar.isTradingDay("2026-02-23")).toBe(true);
    expect(calendar.isTradingDay("2026-03-02")).toBe(true);
  });

  it("counts a Saturday marked o as a trading day", () => {
    const calendarWithMakeup = twseCalendar([
      {
        year: 2026,
        remarks: new Map([["2026-03-07", "o"]]),
      },
    ]);
    expect(calendarWithMakeup.isTradingDay("2026-03-07")).toBe(true);
  });
});

describe("session and settlement", () => {
  const holidays = twseCalendar([
    parseTwseHolidayCsv(SAMPLE_CSV, 2026),
    {
      year: 2026,
      remarks: new Map([
        ["2026-02-17", ""],
        ["2026-02-18", ""],
        ["2026-02-19", ""],
        ["2026-02-20", ""],
      ]),
    },
  ]);

  it("uses the same trading day before 13:30 and the next one from 13:30", () => {
    const calendar = weekdayCalendar();
    expect(orderSessionDate(taipei("2026-03-02T13:29:59"), calendar)).toBe("2026-03-02");
    expect(orderSessionDate(taipei("2026-03-02T13:30:00"), calendar)).toBe("2026-03-03");
    expect(orderSessionDate(taipei("2026-03-06T13:30:00"), calendar)).toBe("2026-03-09");
    expect(orderSessionDate(taipei("2026-03-07T10:00:00"), calendar)).toBe("2026-03-09");
  });

  it("skips settlement-only days and holidays when placing the session and T+2", () => {
    expect(orderSessionDate(taipei("2026-02-11T13:29:00"), holidays)).toBe("2026-02-11");
    expect(orderSessionDate(taipei("2026-02-11T13:30:00"), holidays)).toBe("2026-02-23");
    expect(orderSessionDate(taipei("2026-02-12T10:00:00"), holidays)).toBe("2026-02-23");
    expect(settlementDate("2026-02-11", holidays)).toBe("2026-02-24");
  });

  it("does not match before 13:30 on the session date", () => {
    expect(closeAuctionReady(taipei("2026-03-02T13:29:59"), "2026-03-02")).toBe(false);
    expect(closeAuctionReady(taipei("2026-03-02T13:30:00"), "2026-03-02")).toBe(true);
    expect(closeAuctionReady(taipei("2026-03-03T09:00:00"), "2026-03-02")).toBe(true);
  });

  it("uses a live quote only from 09:00 until 13:30 on that session date", () => {
    expect(intradayQuoteReady(taipei("2026-03-02T08:59:59"), "2026-03-02")).toBe(false);
    expect(intradayQuoteReady(taipei("2026-03-02T09:00:00"), "2026-03-02")).toBe(true);
    expect(intradayQuoteReady(taipei("2026-03-02T13:29:59"), "2026-03-02")).toBe(true);
    expect(intradayQuoteReady(taipei("2026-03-02T13:30:00"), "2026-03-02")).toBe(false);
    expect(intradayQuoteReady(taipei("2026-03-03T10:00:00"), "2026-03-02")).toBe(false);
  });
});

describe("price band, commission, and tax", () => {
  it("rounds the 10% band down for limit up and up for limit down", () => {
    expect(priceBand(parseTwdToCents("2385")!).limitUpCents).toBe(parseTwdToCents("2620"));
    expect(priceBand(parseTwdToCents("2385")!).limitDownCents).toBe(parseTwdToCents("2150"));
    expect(priceBand(parseTwdToCents("9.99")!).limitUpCents).toBe(parseTwdToCents("10.95"));
    expect(priceBand(parseTwdToCents("9.99")!).limitDownCents).toBe(parseTwdToCents("9.00"));
    expect(priceBand(parseTwdToCents("47.5")!).limitUpCents).toBe(parseTwdToCents("52.2"));
    expect(priceBand(parseTwdToCents("47.5")!).limitDownCents).toBe(parseTwdToCents("42.75"));
  });

  it("rounds commission half up to the yuan and applies the 20 yuan minimum", () => {
    expect(formatTwdFromCents(commissionCents(parseTwdToCents("2385000")!))).toBe("2039.00");
    expect(formatTwdFromCents(commissionCents(parseTwdToCents("10000")!))).toBe("20.00");
  });

  it("drops the fractional yuan of the sell tax", () => {
    expect(formatTwdFromCents(sellTaxCents(parseTwdToCents("2385000")!))).toBe("7155.00");
    expect(formatTwdFromCents(sellTaxCents(parseTwdToCents("10150")!))).toBe("30.00");
  });
});

describe("submitPaperOrder", () => {
  it("rejects anything that is not a listed or OTC common stock", () => {
    expect(submitPaperOrder(orderInput({ instrument: null })).status).toBe("rejected");
    expect(
      submitPaperOrder(
        orderInput({
          instrument: { stockId: "0050", market: "twse", commonStock: false },
        }),
      ),
    ).toMatchObject({ status: "rejected", reason: "not_common_stock" });
    expect(
      submitPaperOrder(
        orderInput({
          instrument: { stockId: "TSMC", market: "twse", commonStock: true },
        }),
      ),
    ).toMatchObject({ status: "rejected", reason: "invalid_stock" });
  });

  it("rejects a limit outside the band or off the tick", () => {
    expect(
      submitPaperOrder(orderInput({ limitPriceCents: parseTwdToCents("2625") })),
    ).toMatchObject({ status: "rejected", reason: "limit_price_out_of_band" });
    expect(
      submitPaperOrder(orderInput({ limitPriceCents: parseTwdToCents("2385.5") })),
    ).toMatchObject({ status: "rejected", reason: "limit_price_off_tick" });
  });

  it("freezes a buy at the limit, including commission", () => {
    const accepted = submitPaperOrder(orderInput());
    expect(accepted).toMatchObject({
      status: "working",
      sessionDate: "2026-03-02",
      shares: 1000,
      reservedShares: 0,
    });
    if (accepted.status !== "working") return;
    const notional = CLOSE_2385 * 1000;
    expect(accepted.reservedCashCents).toBe(notional + commissionCents(notional));
  });

  it("accepts one share and still charges the 20 yuan minimum fee", () => {
    const accepted = submitPaperOrder(orderInput({ shares: 1 }));
    expect(accepted).toMatchObject({ status: "working", lots: 0, shares: 1 });
    if (accepted.status !== "working") return;
    expect(accepted.reservedCashCents).toBe(CLOSE_2385 + commissionCents(CLOSE_2385));
    expect(formatTwdFromCents(commissionCents(CLOSE_2385))).toBe("20.00");
  });

  it("freezes a market buy at the limit-up price", () => {
    const accepted = submitPaperOrder(orderInput({ orderType: "market", limitPriceCents: null }));
    if (accepted.status !== "working") throw new Error(accepted.reason);
    const limitUp = priceBand(CLOSE_2385).limitUpCents;
    const notional = limitUp * 1000;
    expect(accepted.reservedCashCents).toBe(notional + commissionCents(notional));
    expect(accepted.limitPriceCents).toBeNull();
  });

  it("rejects a buy that cannot cover the freeze and does not open a position", () => {
    const rejected = submitPaperOrder(orderInput({ availableCashCents: 1_000 }));
    expect(rejected).toMatchObject({ status: "rejected", reason: "insufficient_cash" });
  });

  it("rejects a sell larger than settled shares", () => {
    const rejected = submitPaperOrder(
      orderInput({
        side: "sell",
        orderType: "market",
        limitPriceCents: null,
        settledShares: 0,
      }),
    );
    expect(rejected).toMatchObject({
      status: "rejected",
      reason: "insufficient_settled_shares",
    });
    expect(paperRuleText("insufficient_settled_shares")).toBe("已交割股數不足");
  });

  it("freezes only settled shares on a sell", () => {
    const accepted = submitPaperOrder(
      orderInput({
        side: "sell",
        orderType: "limit",
        settledShares: 1000,
      }),
    );
    expect(accepted).toMatchObject({
      status: "working",
      reservedCashCents: 0,
      reservedShares: 1000,
    });
  });
});

describe("cancel and match", () => {
  it("releases a working order and refuses any other status", () => {
    const accepted = submitPaperOrder(orderInput());
    if (accepted.status !== "working") throw new Error(accepted.reason);
    expect(cancelWorkingOrder(accepted)).toEqual({
      status: "cancelled",
      releasedCashCents: accepted.reservedCashCents,
      releasedShares: 0,
    });
    expect(
      cancelWorkingOrder({
        status: "filled",
        reservedCashCents: accepted.reservedCashCents,
        reservedShares: 0,
      }),
    ).toMatchObject({ status: "rejected", reason: "order_not_working" });
  });

  it("expires a limit buy the close did not touch and returns all frozen cash", () => {
    const accepted = submitPaperOrder(
      orderInput({ limitPriceCents: parseTwdToCents("2300") }),
    );
    if (accepted.status !== "working") throw new Error(accepted.reason);
    const matched = matchAtClose(accepted, CLOSE_2385, weekdayCalendar());
    expect(matched).toEqual({
      status: "expired",
      reason: "limit_not_reached",
      releasedCashCents: accepted.reservedCashCents,
      releasedShares: 0,
    });
    expect(paperRuleText("limit_not_reached")).toBe("收盤價未碰到限價");
  });

  it("fills a limit buy at the close when the close is at or below the limit", () => {
    const accepted = submitPaperOrder(orderInput());
    if (accepted.status !== "working") throw new Error(accepted.reason);
    const matched = matchAtClose(accepted, CLOSE_2385, weekdayCalendar());
    if (matched.status !== "filled") throw new Error(matched.reason);
    expect(matched.fillPriceCents).toBe(CLOSE_2385);
    expect(matched.refundCashCents).toBe(0);
    expect(matched.settlementCashCents).toBe(accepted.reservedCashCents);
  });

  it("fills a market buy at the close and refunds the unused freeze", () => {
    const calendar = weekdayCalendar();
    const accepted = submitPaperOrder(
      orderInput({ orderType: "market", limitPriceCents: null }),
    );
    if (accepted.status !== "working") throw new Error(accepted.reason);
    const matched = matchAtClose(accepted, CLOSE_2385, calendar);
    if (matched.status !== "filled") throw new Error(matched.reason);
    const notional = CLOSE_2385 * 1000;
    expect(matched.fillPriceCents).toBe(CLOSE_2385);
    expect(matched.feeCents).toBe(commissionCents(notional));
    expect(matched.taxCents).toBe(0);
    expect(matched.settlementCashCents).toBe(notional + matched.feeCents);
    expect(matched.refundCashCents + matched.settlementCashCents).toBe(
      accepted.reservedCashCents,
    );
    expect(matched.refundCashCents).toBeGreaterThan(0);
    expect(matched.settlementDate).toBe("2026-03-04");
  });

  it("fills a limit sell at the close and holds the shares until settlement", () => {
    const accepted = submitPaperOrder(
      orderInput({
        side: "sell",
        limitPriceCents: parseTwdToCents("2300"),
        settledShares: 1000,
      }),
    );
    if (accepted.status !== "working") throw new Error(accepted.reason);
    const matched = matchAtClose(accepted, CLOSE_2385, weekdayCalendar());
    if (matched.status !== "filled") throw new Error(matched.reason);
    const notional = CLOSE_2385 * 1000;
    expect(matched.taxCents).toBe(sellTaxCents(notional));
    expect(matched.settlementProceedsCents).toBe(notional - matched.feeCents - matched.taxCents);
    expect(matched.releasedShares).toBe(0);
    expect(matched.refundCashCents).toBe(0);
  });

  it("expires a limit sell the close did not reach", () => {
    const accepted = submitPaperOrder(
      orderInput({
        side: "sell",
        limitPriceCents: parseTwdToCents("2500"),
        settledShares: 1000,
      }),
    );
    if (accepted.status !== "working") throw new Error(accepted.reason);
    expect(matchAtClose(accepted, CLOSE_2385, weekdayCalendar())).toMatchObject({
      status: "expired",
      reason: "limit_not_reached",
      releasedShares: 1000,
    });
  });

  it("waits when the close is missing or the session is still open", () => {
    const accepted = submitPaperOrder(
      orderInput({ orderType: "market", limitPriceCents: null }),
    );
    if (accepted.status !== "working") throw new Error(accepted.reason);
    expect(matchAtClose(accepted, null, weekdayCalendar())).toMatchObject({
      status: "waiting",
      reason: "missing_close",
    });
    expect(
      matchSession(accepted, CLOSE_2385, taipei("2026-03-02T13:29:00"), weekdayCalendar()),
    ).toMatchObject({ status: "waiting", reason: "session_open" });
    const filled = matchSession(
      accepted,
      CLOSE_2385,
      taipei("2026-03-02T13:30:00"),
      weekdayCalendar(),
    );
    expect(filled.status).toBe("filled");
  });
});
