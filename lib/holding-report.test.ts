import { describe, expect, it } from "vitest";
import {
  reportFieldsFromHolding,
  selectHoldingsForAnalysis,
} from "./holding-report";

describe("reportFieldsFromHolding", () => {
  it("keeps cash and margin legs", () => {
    expect(
      reportFieldsFromHolding({
        stockId: "2330",
        shareCount: 3000,
        avgCost: 900,
        cashShareCount: 1000,
        cashAvgCost: 800,
        marginShareCount: 2000,
        marginAvgCost: 950,
      }),
    ).toEqual({
      stockId: "2330",
      isHolding: true,
      shareCount: 3000,
      avgCost: 900,
      usesMargin: true,
      cashShareCount: 1000,
      cashAvgCost: 800,
      marginShareCount: 2000,
      marginAvgCost: 950,
    });
  });

  it("uses blended share count and cost when legs are absent", () => {
    expect(
      reportFieldsFromHolding({
        stockId: "2317",
        shareCount: 2000,
        avgCost: 100,
      }),
    ).toMatchObject({
      stockId: "2317",
      isHolding: true,
      shareCount: 2000,
      avgCost: 100,
      usesMargin: false,
    });
  });

  it("skips holdings without a positive cost or share count", () => {
    expect(
      reportFieldsFromHolding({
        stockId: "2330",
        shareCount: 0,
        avgCost: 100,
      }),
    ).toBeNull();
    expect(
      reportFieldsFromHolding({
        stockId: "2330",
        shareCount: 1000,
        avgCost: 0,
      }),
    ).toBeNull();
    expect(
      reportFieldsFromHolding({
        stockId: "23",
        shareCount: 1000,
        avgCost: 100,
      }),
    ).toBeNull();
  });
});

describe("selectHoldingsForAnalysis", () => {
  it("drops empty rows and caps the batch", () => {
    const holdings = [
      { stockId: "2330", shareCount: 1000, avgCost: 800 },
      { stockId: "2303", shareCount: 0, avgCost: 40 },
      { stockId: "2330", shareCount: 1000, avgCost: 800 },
      { stockId: "2317", shareCount: 2000, avgCost: 100 },
    ];
    const { selected, truncated } = selectHoldingsForAnalysis(holdings, 1);
    expect(selected.map((item) => item.stockId)).toEqual(["2330"]);
    expect(truncated).toBe(true);
  });
});
