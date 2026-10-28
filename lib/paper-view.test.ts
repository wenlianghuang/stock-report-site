import { describe, expect, it } from "vitest";
import {
  buildPaperSnapshot,
  formatPaperTwd,
  latestCloseOnOrBefore,
  type PaperSnapshotFill,
  type PaperSnapshotOrder,
  type PaperSnapshotPosition,
  type PaperSnapshotSettlement,
} from "./paper-view";

function order(patch: Partial<PaperSnapshotOrder> & Pick<PaperSnapshotOrder, "id" | "status">): PaperSnapshotOrder {
  return {
    stockId: "2330",
    stockName: "台積電",
    side: "buy",
    orderType: "limit",
    limitPriceCents: 60_000,
    lots: 1,
    shares: 1000,
    sessionDate: "2026-10-27",
    reservedCashCents: 6_010_000,
    reservedShares: 0,
    expireReason: null,
    rejectReason: null,
    submittedAt: "2026-10-27T01:00:00.000Z",
    ...patch,
  };
}

describe("paper view", () => {
  it("formats grouped TWD and keeps the sign", () => {
    expect(formatPaperTwd(100_000_000)).toBe("1,000,000.00");
    expect(formatPaperTwd(-123_456)).toBe("-1,234.56");
  });

  it("uses the newest close on or before today", () => {
    const closes = new Map<string, number>([
      ["2026-10-28", 99],
      ["2026-10-24", 100],
      ["2026-10-27", 110],
    ]);
    expect(latestCloseOnOrBefore(closes, "2026-10-27")).toEqual({
      date: "2026-10-27",
      cents: 110,
    });
  });

  it("shows available cash, unrealized pnl, and the expiry reason", () => {
    const workingBuy = order({
      id: "buy-working",
      status: "working",
      reservedCashCents: 10_000_000,
    });
    const expired = order({
      id: "buy-expired",
      status: "expired",
      side: "buy",
      expireReason: "limit_not_reached",
      reservedCashCents: 0,
      submittedAt: "2026-10-26T01:00:00.000Z",
      sessionDate: "2026-10-26",
    });
    const position: PaperSnapshotPosition = {
      stockId: "2330",
      stockName: "台積電",
      settledShares: 2000,
      costBasisCents: 120_000_000,
    };
    const pendingBuy: PaperSnapshotSettlement = {
      orderId: "other",
      stockId: "2303",
      side: "buy",
      settleOn: "2026-10-29",
      status: "pending",
      shares: 1000,
      cashCents: -5_000_000,
      realizedPnlCents: null,
    };
    const fill: PaperSnapshotFill = {
      id: "fill-1",
      orderId: "filled-sell",
      stockId: "2330",
      stockName: "台積電",
      side: "sell",
      fillPriceCents: 61_000,
      shares: 1000,
      feeCents: 2_000,
      taxCents: 18_300,
      sessionDate: "2026-10-27",
      createdAt: "2026-10-27T06:00:00.000Z",
    };
    const sellOrder = order({
      id: "filled-sell",
      status: "filled",
      side: "sell",
      orderType: "market",
      limitPriceCents: null,
      reservedCashCents: 0,
      reservedShares: 0,
    });
    const pendingSell: PaperSnapshotSettlement = {
      orderId: "filled-sell",
      stockId: "2330",
      side: "sell",
      settleOn: "2026-10-29",
      status: "pending",
      shares: 1000,
      cashCents: 6_079_700,
      realizedPnlCents: null,
    };

    const snapshot = buildPaperSnapshot({
      cashCents: 100_000_000,
      orders: [workingBuy, expired, sellOrder],
      fills: [fill],
      settlements: [pendingBuy, pendingSell],
      positions: [position],
      closes: new Map([
        ["2330", { date: "2026-10-27", cents: 61_000 }],
        ["2303", { date: "2026-10-27", cents: 5_100 }],
      ]),
      phase: "open",
      lastPrices: new Map([["2330", 61_500]]),
      quoteAts: new Map([["2330", "2026-10-28T05:16:00.000Z"]]),
    });

    expect(snapshot.cash.text).toBe("1,000,000.00");
    expect(snapshot.available.cents).toBe(85_000_000);
    expect(snapshot.reserved.cents).toBe(15_000_000);
    expect(snapshot.phaseLabel).toBe("盤中");
    expect(snapshot.working.map((row) => row.id)).toEqual(["buy-working"]);
    expect(snapshot.working[0]?.lastText).toBe("615.00");
    expect(snapshot.working[0]?.lastAtText).toBe("13:16");
    expect(snapshot.positions.find((row) => row.stockId === "2330")).toMatchObject({
      shares: 2000,
      availableShares: 1000,
      statusText: "已交割",
      pendingShares: 0,
      avgCostText: "600.00",
      closeText: "610.00",
      closeDate: "13:16",
      unrealized: { text: "20,000.00", cents: 2_000_000 },
    });
    expect(snapshot.positions.find((row) => row.stockId === "2303")).toMatchObject({
      shares: 1000,
      availableShares: 0,
      pendingShares: 1000,
      statusText: "待交割，交割日 2026-10-29",
      avgCostText: "50.00",
      unrealized: { text: "1,000.00", cents: 100_000 },
    });
    expect(snapshot.totals.unrealized?.text).toBe("21,000.00");
    expect(snapshot.records.map((row) => row.outcome)).toEqual(["filled", "expired"]);
    expect(snapshot.records[0]?.detail).toBe("待交割，交割日 2026-10-29");
    expect(snapshot.records[1]?.detail).toBe("收盤價未碰到限價");
  });

  it("leaves unrealized blank when the latest close is missing", () => {
    const snapshot = buildPaperSnapshot({
      cashCents: 100_000_000,
      orders: [],
      fills: [],
      settlements: [],
      positions: [
        {
          stockId: "2330",
          stockName: "台積電",
          settledShares: 1000,
          costBasisCents: 60_000_000,
        },
      ],
      closes: new Map([["2330", null]]),
    });
    expect(snapshot.positions[0]?.unrealized).toBeNull();
    expect(snapshot.totals.complete).toBe(false);
    expect(snapshot.totals.unrealized).toBeNull();
  });
});
