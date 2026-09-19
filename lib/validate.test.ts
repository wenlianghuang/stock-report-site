import { describe, expect, it } from "vitest";
import {
  isValidAvgCost,
  isValidPortfolioAmount,
  isValidPortfolioMode,
  isValidPortfolioProfile,
  isValidPortfolioThemes,
  isValidShareCount,
  isValidStockId,
  isValidTradeDate,
} from "./validate";

describe("isValidStockId", () => {
  it.each([
    ["2330", true],
    ["0050", true],
    ["123456", true],
    [" 2409 ", true],
    ["233", false],
    ["1234567", false],
    ["TSMC", false],
    ["", false],
  ])("%j → %s", (input, expected) => {
    expect(isValidStockId(input)).toBe(expected);
  });
});

describe("isValidTradeDate", () => {
  it.each([
    ["2026-09-18", true],
    ["2026/09/18", false],
    ["2026-9-18", false],
  ])("%j → %s", (input, expected) => {
    expect(isValidTradeDate(input)).toBe(expected);
  });
});

describe("isValidShareCount", () => {
  it.each([
    [1, true],
    [0, false],
    [1.5, false],
    [Number.NaN, false],
  ])("%s → %s", (input, expected) => {
    expect(isValidShareCount(input)).toBe(expected);
  });
});

describe("isValidAvgCost", () => {
  it.each([
    [12.5, true],
    [0, false],
    [Number.NaN, false],
  ])("%s → %s", (input, expected) => {
    expect(isValidAvgCost(input)).toBe(expected);
  });
});

describe("isValidPortfolioProfile", () => {
  it.each([
    ["conservative", true],
    ["theme_financials", true],
    ["theme_ai_chips", true],
    ["theme_", false],
    ["Theme_foo", false],
    ["random", false],
  ])("%j → %s", (input, expected) => {
    expect(isValidPortfolioProfile(input)).toBe(expected);
  });
});

describe("isValidPortfolioMode", () => {
  it.each([
    ["beginner", true],
    ["theme", true],
    ["custom", false],
  ])("%j → %s", (input, expected) => {
    expect(isValidPortfolioMode(input)).toBe(expected);
  });
});

describe("isValidPortfolioThemes", () => {
  it.each([
    [["financials"], true],
    [["a", "b", "c"], true],
    [[], false],
    [["a", "b", "c", "d"], false],
    [["Financials"], false],
  ])("%j → %s", (input, expected) => {
    expect(isValidPortfolioThemes(input)).toBe(expected);
  });
});

describe("isValidPortfolioAmount", () => {
  it.each([
    [50_000, true],
    [49_999, false],
    [50_000.5, false],
  ])("%s → %s", (input, expected) => {
    expect(isValidPortfolioAmount(input)).toBe(expected);
  });
});
