import { describe, expect, it } from "vitest";
import { priceToCents, yahooSymbol } from "./paper-market";

describe("paper market prices", () => {
  it("maps listed and OTC symbols", () => {
    expect(yahooSymbol("2330", "twse")).toBe("2330.TW");
    expect(yahooSymbol("6488", "tpex")).toBe("6488.TWO");
  });

  it("rounds a daily close to cents", () => {
    expect(priceToCents(2385)).toBe(238_500);
    expect(priceToCents(10.55)).toBe(1_055);
    expect(priceToCents(0)).toBeNull();
  });
});
