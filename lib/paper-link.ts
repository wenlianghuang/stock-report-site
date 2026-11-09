/**
 * 模擬帳的讀取連結。
 * 問句先對上股票、交易日、方向和指標，再套目錄裡的 SELECT。問句文字不進 SQL。
 */

import { formatTwdFromCents, type PaperSide } from "@/lib/paper-trade";

export type PaperMetric = "fill_price" | "limit_price" | "avg_cost";

/** session 用問句裡的交易日。latest 用該方向最近一個有紀錄的交易日。 */
export type PaperWhen = "session" | "latest";

export type PaperLink = {
  stockId: string;
  sessionDate: string | null;
  side: PaperSide | null;
  metric: PaperMetric;
  when: PaperWhen | null;
};

export type PaperLinkResult =
  | { ok: true; link: PaperLink }
  | { ok: false; reason: string };

export type StockIdResolver = (text: string) => string | null | Promise<string | null>;

const OUTSIDE_LEDGER = /外資|投信|自營|主力|融資|融券|借券|當沖|買超|賣超/;

const SQL_BY_METRIC: Record<PaperMetric, string> = {
  fill_price: `select fill_price_cents, shares, session_date
from paper_fills
where user_id = $1
  and stock_id = $2
  and session_date = $3
  and side = $4`,
  limit_price: `select limit_price_cents, shares, session_date, order_type
from paper_orders
where user_id = $1
  and stock_id = $2
  and session_date = $3
  and side = $4
  and status <> 'rejected'`,
  avg_cost: `select avg_cost_cents, settled_shares
from paper_positions
where user_id = $1
  and stock_id = $2`,
};

const LATEST_SQL: Partial<Record<PaperMetric, string>> = {
  fill_price: `select fill_price_cents, shares, session_date
from paper_fills
where user_id = $1
  and stock_id = $2
  and side = $3
  and session_date = (
    select max(session_date)
    from paper_fills
    where user_id = $1
      and stock_id = $2
      and side = $3
  )`,
  limit_price: `select limit_price_cents, shares, session_date, order_type
from paper_orders
where user_id = $1
  and stock_id = $2
  and side = $3
  and status <> 'rejected'
  and session_date = (
    select max(session_date)
    from paper_orders
    where user_id = $1
      and stock_id = $2
      and side = $3
      and status <> 'rejected'
  )`,
};

const FORBIDDEN_SQL =
  /\b(insert|update|delete|drop|alter|truncate|grant|revoke|copy|execute|call|union)\b/i;

export function catalogSql(metric: PaperMetric, when: PaperWhen | null = "session"): string {
  if (when === "latest") return LATEST_SQL[metric] ?? SQL_BY_METRIC[metric];
  return SQL_BY_METRIC[metric];
}

export function admitProposedSql(
  proposed: string,
  metric: PaperMetric,
  when: PaperWhen | null = "session",
): boolean {
  const normalized = normalizeSql(proposed);
  if (!normalized || normalized.includes(";")) return false;
  if (FORBIDDEN_SQL.test(proposed)) return false;
  return normalized === normalizeSql(catalogSql(metric, when));
}

export async function linkPaperQuestion(
  question: string,
  resolveStockId: StockIdResolver,
): Promise<PaperLinkResult> {
  const text = question.trim();
  if (!text) return { ok: false, reason: "要有問句" };
  if (OUTSIDE_LEDGER.test(text)) {
    return { ok: false, reason: "這本模擬帳沒有籌碼欄位" };
  }

  const metric = detectMetric(text);
  if (metric === "ambiguous") {
    return { ok: false, reason: "要說明是成交價、限價，還是目前的均價" };
  }
  if (!metric) {
    return { ok: false, reason: "要說明是成交價、限價，還是目前的均價" };
  }

  const dates = extractDates(text);
  if (dates.length > 1) return { ok: false, reason: "問句裡有兩個日期" };
  const sessionDate = dates[0] ?? null;
  if (metric === "avg_cost" && sessionDate) {
    return { ok: false, reason: "均價是目前已交割部位，沒有某一個交易日。要查那天的價格，請問成交價" };
  }

  const side = detectSide(text);
  if (side === "both") return { ok: false, reason: "要說明是買進還是賣出" };
  if (metric !== "avg_cost" && !side) return { ok: false, reason: "要說明是買進還是賣出" };
  const wantsLatest = metric !== "avg_cost" && /最新|最近/.test(text);
  if (wantsLatest && sessionDate) {
    return { ok: false, reason: "要查最新一筆，就不要再寫交易日" };
  }
  if (metric !== "avg_cost" && !sessionDate && !wantsLatest) {
    return { ok: false, reason: "要有交易日，例如 2026-10-30。要查最近一筆，可以說最新" };
  }

  const coded = extractStockCode(text);
  if (coded === "ambiguous") return { ok: false, reason: "問句裡有兩個股票代號" };
  const named = await resolveStockId(text);
  if (coded && named && coded !== named) {
    return { ok: false, reason: "股票名稱和代號對不上" };
  }
  const stockId = coded ?? named;
  if (!stockId) return { ok: false, reason: "要說明股票名稱或代號" };

  return {
    ok: true,
    link: {
      stockId,
      sessionDate: metric === "avg_cost" || wantsLatest ? null : sessionDate,
      side: metric === "avg_cost" ? null : side,
      metric,
      when: metric === "avg_cost" ? null : wantsLatest ? "latest" : "session",
    },
  };
}

export type PaperFillFact = {
  kind: "fill_price";
  fillPriceCents: number;
  shares: number;
  sessionDate: string;
};

export type PaperLimitFact = {
  kind: "limit_price";
  limitPriceCents: number | null;
  shares: number;
  sessionDate: string;
  orderType: "market" | "limit";
};

export type PaperAvgFact = {
  kind: "avg_cost";
  avgCostCents: number | null;
  settledShares: number;
};

export type PaperFact = PaperFillFact | PaperLimitFact | PaperAvgFact;

export function formatPaperAnswer(input: {
  link: PaperLink;
  stockName: string | null;
  rows: PaperFact[];
}): string {
  const stock = stockLabel(input.link.stockId, input.stockName);
  if (input.link.metric === "avg_cost") {
    const row = input.rows.find((item) => item.kind === "avg_cost");
    if (!row || row.kind !== "avg_cost" || row.settledShares < 1 || row.avgCostCents == null) {
      return `${stock}沒有已交割部位，所以沒有均價。`;
    }
    return `${stock}目前已交割均價 ${yuan(row.avgCostCents)} 元，${row.settledShares} 股。這不是某一天的成交價。`;
  }

  const side = input.link.side === "sell" ? "賣出" : "買進";
  if (input.link.metric === "fill_price") {
    const fills = input.rows.filter((item) => item.kind === "fill_price");
    if (fills.length === 0) {
      return input.link.when === "latest"
        ? `沒有${stock}的${side}成交。`
        : `${input.link.sessionDate} 沒有${stock}的${side}成交。`;
    }
    const day = input.link.sessionDate ?? fills[0].sessionDate;
    if (fills.length === 1) {
      const fill = fills[0];
      return `${fill.sessionDate} ${stock}${side}成交價 ${yuan(fill.fillPriceCents)} 元，${fill.shares} 股。`;
    }
    const parts = fills.map(
      (fill) => `${yuan(fill.fillPriceCents)} 元、${fill.shares} 股`,
    );
    return `${day} ${stock}有 ${fills.length} 筆${side}成交，沒有平均：${parts.join("；")}。`;
  }

  const limits = input.rows.filter((item) => item.kind === "limit_price");
  const day = input.link.sessionDate ?? limits[0]?.sessionDate ?? "";
  if (limits.length === 0) {
    return input.link.when === "latest"
      ? `沒有${stock}的${side}委託。`
      : `${input.link.sessionDate} 沒有${stock}的${side}委託。`;
  }
  const parts = limits.map((order) => {
    if (order.orderType === "market" || order.limitPriceCents == null) {
      return `市價、${order.shares} 股`;
    }
    return `限價 ${yuan(order.limitPriceCents)} 元、${order.shares} 股`;
  });
  if (limits.length === 1) return `${day} ${stock}${side}委託是${parts[0]}。`;
  return `${day} ${stock}有 ${limits.length} 筆${side}委託：${parts.join("；")}。`;
}

function detectMetric(text: string): PaperMetric | "ambiguous" | null {
  const avg = /均價|平均價|平均成本/.test(text);
  const limit = /限價/.test(text);
  const fill = /成交價|成交/.test(text);
  const spokenPrice = /價格|價錢|多少錢|多少元|多少股|幾股/.test(text);
  const named = [avg, limit, fill].filter(Boolean).length;
  if (named > 1) return "ambiguous";
  if (avg) return "avg_cost";
  if (limit) return "limit_price";
  if (fill || spokenPrice) return "fill_price";
  return null;
}

function detectSide(text: string): PaperSide | "both" | null {
  const buy = /買進|買入|買了|買到|買/.test(text);
  const sell = /賣出|賣了|賣到|賣/.test(text);
  if (buy && sell) return "both";
  if (buy) return "buy";
  if (sell) return "sell";
  return null;
}

function extractDates(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(/(\d{4})[-/](\d{2})[-/](\d{2})/g)) {
    const iso = `${match[1]}-${match[2]}-${match[3]}`;
    if (!found.includes(iso) && isIsoDate(iso)) found.push(iso);
  }
  return found;
}

function extractStockCode(text: string): string | "ambiguous" | null {
  const stripped = text.replace(/\d{4}[-/]\d{2}[-/]\d{2}/g, " ");
  const codes = [...stripped.matchAll(/(?<!\d)(\d{4,6})(?!\d)/g)].map((match) => match[1]);
  const unique = [...new Set(codes)];
  if (unique.length > 1) return "ambiguous";
  return unique[0] ?? null;
}

function isIsoDate(iso: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function normalizeSql(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .trim()
    .replace(/;+\s*$/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function stockLabel(stockId: string, stockName: string | null): string {
  return stockName ? `${stockName}（${stockId}）` : stockId;
}

function yuan(cents: number): string {
  const plain = formatTwdFromCents(cents);
  const match = /^(-?)(\d+)(\.\d+)$/.exec(plain);
  if (!match) return plain;
  const grouped = match[2].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${match[1]}${grouped}${match[3]}`;
}
