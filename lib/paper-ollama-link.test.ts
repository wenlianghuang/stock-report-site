import { describe, expect, it } from "vitest";
import { linkUnparsedQuestion, paperLinkPrompt } from "./paper-ollama-link";

describe("ollama catalog link", () => {
  it("uses the model JSON and ignores any SQL it adds", async () => {
    const linked = await linkUnparsedQuestion(
      "這個月有沒有買任何股票？",
      () => null,
      "2026-11-09",
      async () =>
        '{"metric":"month_fills","side":"buy","stockName":null,"year":2026,"month":11,"sql":"delete from paper_fills"}',
    );
    expect(linked).toEqual({
      ok: true,
      link: {
        stockId: null,
        sessionDate: null,
        side: "buy",
        metric: "month_fills",
        when: null,
        fromDate: "2026-11-01",
        toDate: "2026-11-30",
      },
    });
  });

  it("keeps the rule refusal when the model returns nothing usable", async () => {
    const linked = await linkUnparsedQuestion("這個月有沒有買任何股票？", () => null, "2026-11-09", async () => "不知道");
    expect(linked).toBeNull();
  });

  it("tells the model which month today is", () => {
    const prompt = paperLinkPrompt("這個月有沒有買任何股票？", "2026-11-09");
    expect(prompt).toContain("今天是 2026-11-09");
    expect(prompt).toContain('"month":11');
    expect(prompt).not.toContain("delete");
  });
});
