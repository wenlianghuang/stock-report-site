import { describe, expect, it } from "vitest";
import {
  blendHoldingLegs,
  formatMarginQuantity,
  lotsToShares,
  sharesToLots,
} from "./holding-legs";

describe("lotsToShares / sharesToLots", () => {
  it("converts whole lots", () => {
    expect(lotsToShares(1)).toBe(1000);
    expect(lotsToShares(3.9)).toBe(3000);
    expect(sharesToLots(1000)).toBe(1);
    expect(sharesToLots(2000)).toBe(2);
  });

  it("rejects non-lot share counts", () => {
    expect(sharesToLots(500)).toBeNull();
    expect(sharesToLots(0)).toBeNull();
    expect(sharesToLots(-1000)).toBeNull();
  });
});

describe("formatMarginQuantity", () => {
  it("uses 張 when shares are a whole lot", () => {
    expect(formatMarginQuantity(2000)).toBe("2 張");
  });

  it("falls back to 股 when not a whole lot", () => {
    expect(formatMarginQuantity(500)).toBe("500 股");
  });
});

describe("blendHoldingLegs", () => {
  it("blends cash-only holdings", () => {
    expect(
      blendHoldingLegs({ cashShareCount: 1000, cashAvgCost: 10 }),
    ).toEqual({
      cashShareCount: 1000,
      cashAvgCost: 10,
      marginShareCount: undefined,
      marginAvgCost: undefined,
      shareCount: 1000,
      avgCost: 10,
      usesMargin: false,
    });
  });

  it("converts margin lots to shares", () => {
    const got = blendHoldingLegs({
      marginLotCount: 1,
      marginAvgCost: 20,
    });
    expect(got).toMatchObject({
      marginShareCount: 1000,
      marginAvgCost: 20,
      shareCount: 1000,
      avgCost: 20,
      usesMargin: true,
    });
  });

  it("weights cash and margin average cost", () => {
    const got = blendHoldingLegs({
      cashShareCount: 1000,
      cashAvgCost: 10,
      marginShareCount: 1000,
      marginAvgCost: 20,
    });
    expect(got).toMatchObject({
      shareCount: 2000,
      avgCost: 15,
      usesMargin: true,
    });
  });

  it("rejects margin shares that are not a multiple of 1000", () => {
    expect(
      blendHoldingLegs({
        marginShareCount: 500,
        marginAvgCost: 20,
      }),
    ).toBeNull();
  });

  it("rejects missing or non-positive cost", () => {
    expect(blendHoldingLegs({ cashShareCount: 1000 })).toBeNull();
    expect(
      blendHoldingLegs({ cashShareCount: 1000, cashAvgCost: 0 }),
    ).toBeNull();
    expect(blendHoldingLegs({})).toBeNull();
  });

  it("rejects negative quantities", () => {
    expect(
      blendHoldingLegs({ cashShareCount: -1, cashAvgCost: 10 }),
    ).toBeNull();
    expect(
      blendHoldingLegs({ marginLotCount: -1, marginAvgCost: 10 }),
    ).toBeNull();
  });
});
