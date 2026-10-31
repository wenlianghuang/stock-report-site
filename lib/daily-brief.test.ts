import { describe, expect, it } from "vitest";
import { parseDailyBrief } from "./daily-brief";

describe("parseDailyBrief", () => {
  it("keeps the open brief unless the address asks for the close report", () => {
    expect(parseDailyBrief(null)).toBe("open");
    expect(parseDailyBrief("open")).toBe("open");
    expect(parseDailyBrief("close")).toBe("close");
  });
});
