import { describe, expect, it } from "vitest";
import {
  admitProposedSql,
  catalogSql,
  formatPaperAnswer,
  linkPaperQuestion,
  type PaperLink,
} from "./paper-link";

const NAMES: Record<string, string> = {
  台積電: "2330",
  聯發科: "2454",
};

function resolveStockId(text: string): string | null {
  for (const [name, stockId] of Object.entries(NAMES)) {
    if (text.includes(name)) return stockId;
  }
  return null;
}

describe("paper ledger linking", () => {
  it("links a spoken buy price to the fill column", async () => {
    const linked = await linkPaperQuestion(
      "我要調出在2026-10-30 台積電是用多少的價格買進的",
      resolveStockId,
    );
    expect(linked).toEqual({
      ok: true,
      link: {
        stockId: "2330",
        sessionDate: "2026-10-30",
        side: "buy",
        metric: "fill_price",
        when: "session",
      },
    });
    expect(catalogSql("fill_price")).toContain("fill_price_cents");
    expect(catalogSql("fill_price")).toContain("user_id = $1");
    expect(catalogSql("fill_price")).not.toContain("台積電");
  });

  it("does not treat the date as a stock id", async () => {
    const linked = await linkPaperQuestion("2026-10-30 2330 賣出成交價", resolveStockId);
    expect(linked.ok).toBe(true);
    if (!linked.ok) return;
    expect(linked.link.stockId).toBe("2330");
    expect(linked.link.sessionDate).toBe("2026-10-30");
    expect(linked.link.side).toBe("sell");
  });

  it("links a limit price separately from the fill", async () => {
    const linked = await linkPaperQuestion("2026-10-30 聯發科買進限價", resolveStockId);
    expect(linked.ok).toBe(true);
    if (!linked.ok) return;
    expect(linked.link).toMatchObject({
      stockId: "2454",
      metric: "limit_price",
      side: "buy",
    });
    expect(catalogSql("limit_price")).toContain("paper_orders");
  });

  it("links the current average without a session date", async () => {
    const linked = await linkPaperQuestion("台積電現在的均價", resolveStockId);
    expect(linked.ok).toBe(true);
    if (!linked.ok) return;
    expect(linked.link).toEqual({
      stockId: "2330",
      sessionDate: null,
      side: null,
      metric: "avg_cost",
      when: null,
    });
  });

  it("refuses an average pinned to one date", async () => {
    const linked = await linkPaperQuestion("2026-10-30 台積電均價", resolveStockId);
    expect(linked).toEqual({
      ok: false,
      reason: "均價是目前已交割部位，沒有某一個交易日。要查那天的價格，請問成交價",
    });
  });

  it("refuses chip questions", async () => {
    const linked = await linkPaperQuestion("2026-10-30 台積電外資買超幾張", resolveStockId);
    expect(linked.ok).toBe(false);
    if (linked.ok) return;
    expect(linked.reason).toBe("這本模擬帳沒有籌碼欄位");
  });

  it("refuses when the name and the code disagree", async () => {
    const linked = await linkPaperQuestion("2026-10-30 台積電 2454 買進成交價", resolveStockId);
    expect(linked.ok).toBe(false);
  });

  it("refuses a price when buy and sell are both present", async () => {
    const linked = await linkPaperQuestion("2026-10-30 台積電買進還是賣出的價格", resolveStockId);
    expect(linked.ok).toBe(false);
  });

  it("links the latest buy without a written date", async () => {
    const linked = await linkPaperQuestion(
      "幫我看最新的台積電買的多少股？價錢是多少？",
      resolveStockId,
    );
    expect(linked).toEqual({
      ok: true,
      link: {
        stockId: "2330",
        sessionDate: null,
        side: "buy",
        metric: "fill_price",
        when: "latest",
      },
    });
    expect(catalogSql("fill_price", "latest")).toContain("max(session_date)");
    expect(catalogSql("fill_price", "latest")).not.toContain("session_date = $3");
  });

  it("links a month of buys across every stock", async () => {
    const linked = await linkPaperQuestion("2026年10月有買任何的股票嗎?", resolveStockId);
    expect(linked).toEqual({
      ok: true,
      link: {
        stockId: null,
        sessionDate: null,
        side: "buy",
        metric: "month_fills",
        when: null,
        fromDate: "2026-10-01",
        toDate: "2026-10-31",
      },
    });
    const sql = catalogSql("month_fills");
    expect(sql).toContain("paper_fills");
    expect(sql).toContain("session_date >= $3");
    expect(sql).toContain("session_date <= $4");
    expect(sql).not.toContain("stock_id =");
    expect(sql).not.toContain("2026");
  });

  it("does not treat the year as a stock id", async () => {
    const linked = await linkPaperQuestion("2026 年 10 月有買任何的股票嗎", resolveStockId);
    expect(linked.ok).toBe(true);
    if (!linked.ok) return;
    expect(linked.link.stockId).toBeNull();
  });

  it("links one named stock across that month", async () => {
    const linked = await linkPaperQuestion("2026年10月有買台積電嗎", resolveStockId);
    expect(linked.ok).toBe(true);
    if (!linked.ok) return;
    expect(linked.link).toMatchObject({
      stockId: "2330",
      side: "buy",
      metric: "month_fills",
      fromDate: "2026-10-01",
      toDate: "2026-10-31",
    });
    expect(catalogSql("month_fills", null, true)).toContain("stock_id = $5");
  });

  it("links sells in a short month through the last day", async () => {
    const linked = await linkPaperQuestion("2026年2月有賣任何股票嗎", resolveStockId);
    expect(linked.ok).toBe(true);
    if (!linked.ok) return;
    expect(linked.link).toMatchObject({
      stockId: null,
      side: "sell",
      fromDate: "2026-02-01",
      toDate: "2026-02-28",
    });
  });

  it("refuses a month question that also names one stock and every stock", async () => {
    const linked = await linkPaperQuestion("2026年10月有買任何台積電嗎", resolveStockId);
    expect(linked).toEqual({
      ok: false,
      reason: "要查全部股票，就不要再寫股票名稱或代號",
    });
  });

  it("refuses a month that does not exist", async () => {
    const linked = await linkPaperQuestion("2026年13月有買任何的股票嗎", resolveStockId);
    expect(linked).toEqual({ ok: false, reason: "日期不對" });
  });

  it("refuses two months", async () => {
    const linked = await linkPaperQuestion("2026年10月和2026年11月有買股票嗎", resolveStockId);
    expect(linked).toEqual({ ok: false, reason: "問句裡有兩個日期" });
  });

  it("still requires a session date when the month question asks for a fill price", async () => {
    const linked = await linkPaperQuestion("2026年10月台積電買進成交價", resolveStockId);
    expect(linked).toEqual({
      ok: false,
      reason: "要有交易日，例如 2026-10-30。要查最近一筆，可以說最新",
    });
  });

  it("accepts only the catalog statement for that metric", () => {
    expect(admitProposedSql(catalogSql("fill_price"), "fill_price")).toBe(true);
    expect(admitProposedSql(`${catalogSql("fill_price")};`, "fill_price")).toBe(true);
    expect(
      admitProposedSql("select fill_price_cents from paper_fills where stock_id = '2330'", "fill_price"),
    ).toBe(false);
    expect(admitProposedSql("delete from paper_fills", "fill_price")).toBe(false);
    expect(admitProposedSql(catalogSql("avg_cost"), "fill_price")).toBe(false);
    expect(admitProposedSql(catalogSql("month_fills"), "month_fills")).toBe(true);
    expect(admitProposedSql(catalogSql("month_fills", null, true), "month_fills", null, true)).toBe(true);
    expect(admitProposedSql(catalogSql("month_fills"), "month_fills", null, true)).toBe(false);
    expect(admitProposedSql(catalogSql("month_fills"), "fill_price")).toBe(false);
  });
});

describe("paper ledger answers", () => {
  const buy: PaperLink = {
    stockId: "2330",
    sessionDate: "2026-10-30",
    side: "buy",
    metric: "fill_price",
    when: "session",
  };

  it("states one fill price in yuan", () => {
    expect(
      formatPaperAnswer({
        link: buy,
        stockName: "台積電",
        rows: [
          {
            kind: "fill_price",
            fillPriceCents: 100_000,
            shares: 1000,
            sessionDate: "2026-10-30",
          },
        ],
      }),
    ).toBe("2026-10-30 台積電（2330）買進成交價 1,000.00 元，1000 股。");
  });

  it("lists two fills without averaging", () => {
    const answer = formatPaperAnswer({
      link: buy,
      stockName: "台積電",
      rows: [
        { kind: "fill_price", fillPriceCents: 100_000, shares: 1000, sessionDate: "2026-10-30" },
        { kind: "fill_price", fillPriceCents: 100_500, shares: 500, sessionDate: "2026-10-30" },
      ],
    });
    expect(answer).toContain("2 筆買進成交，沒有平均");
    expect(answer).toContain("1,000.00 元、1000 股");
    expect(answer).toContain("1,005.00 元、500 股");
    expect(answer).not.toContain("1,002.50");
  });

  it("says when that day has no buy", () => {
    expect(formatPaperAnswer({ link: buy, stockName: "台積電", rows: [] })).toBe(
      "2026-10-30 沒有台積電（2330）的買進成交。",
    );
  });

  it("describes a market order as having no limit", () => {
    const answer = formatPaperAnswer({
      link: { ...buy, metric: "limit_price" },
      stockName: "台積電",
      rows: [
        {
          kind: "limit_price",
          limitPriceCents: null,
          shares: 1,
          sessionDate: "2026-10-30",
          orderType: "market",
        },
      ],
    });
    expect(answer).toBe("2026-10-30 台積電（2330）買進委託是市價、1 股。");
  });

  it("lists every buy in the month without averaging", () => {
    const answer = formatPaperAnswer({
      link: {
        stockId: null,
        sessionDate: null,
        side: "buy",
        metric: "month_fills",
        when: null,
        fromDate: "2026-10-01",
        toDate: "2026-10-31",
      },
      stockName: null,
      stockNames: { "2330": "台積電", "2454": "聯發科" },
      rows: [
        {
          kind: "fill_price",
          fillPriceCents: 100_000,
          shares: 1000,
          sessionDate: "2026-10-08",
          stockId: "2330",
        },
        {
          kind: "fill_price",
          fillPriceCents: 90_000,
          shares: 500,
          sessionDate: "2026-10-15",
          stockId: "2454",
        },
      ],
    });
    expect(answer).toBe(
      "2026年10月有 2 筆買進成交：2026-10-08 台積電（2330） 1,000.00 元、1000 股；2026-10-15 聯發科（2454） 900.00 元、500 股。",
    );
    expect(answer).not.toContain("950.00");
  });

  it("says when that month has no buy", () => {
    expect(
      formatPaperAnswer({
        link: {
          stockId: null,
          sessionDate: null,
          side: "buy",
          metric: "month_fills",
          when: null,
          fromDate: "2026-10-01",
          toDate: "2026-10-31",
        },
        stockName: null,
        rows: [],
      }),
    ).toBe("2026年10月沒有買進成交。");
  });
});
