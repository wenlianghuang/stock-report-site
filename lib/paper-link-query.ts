/**
 * 依連結執行目錄裡的查詢。使用者編號由登入狀態帶入，不從問句解析。
 */

import { createClient } from "@/lib/supabase/server";
import { PaperActionError } from "@/lib/paper-actions";
import {
  admitProposedSql,
  catalogSql,
  formatPaperAnswer,
  linkPaperQuestion,
  type PaperFact,
  type PaperLink,
} from "@/lib/paper-link";
import { resolveStockIdFromText, resolveStockNameById } from "@/lib/tw-stock-registry";

export type PaperAskResult =
  | { ok: false; answer: string }
  | {
      ok: true;
      answer: string;
      sql: string;
      link: PaperLink;
      note: string | null;
    };

export async function askPaperLedger(question: string, proposedSql?: string): Promise<PaperAskResult> {
  const linked = await linkPaperQuestion(question, resolveStockIdFromText);
  if (!linked.ok) return { ok: false, answer: linked.reason };

  const note =
    proposedSql == null || proposedSql.trim() === ""
      ? null
      : admitProposedSql(proposedSql, linked.link.metric, linked.link.when)
        ? null
        : "提出的 SQL 與這條指標的目錄語句不一致，已改執行目錄裡的語句。";

  const userId = await currentUserId();
  const rows = await readFacts(linked.link, userId);
  const stockName = await resolveStockNameById(linked.link.stockId);
  return {
    ok: true,
    answer: formatPaperAnswer({ link: linked.link, stockName, rows }),
    sql: catalogSql(linked.link.metric, linked.link.when),
    link: linked.link,
    note,
  };
}

async function currentUserId(): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const id = data?.claims && typeof data.claims.sub === "string" ? data.claims.sub : null;
  if (error || !id) throw new PaperActionError("未登入", 401);
  return id;
}

async function readFacts(link: PaperLink, userId: string): Promise<PaperFact[]> {
  const supabase = await createClient();
  if (link.metric === "fill_price") {
    const sessionDate = await sessionOn(link, userId, "paper_fills");
    if (!sessionDate) return [];
    const { data, error } = await supabase
      .from("paper_fills")
      .select("fill_price_cents, shares, session_date, created_at")
      .eq("user_id", userId)
      .eq("stock_id", link.stockId)
      .eq("session_date", sessionDate)
      .eq("side", link.side)
      .order("created_at", { ascending: true });
    if (error) throw new PaperActionError(error.message, 500);
    return (data ?? []).map((row) => ({
      kind: "fill_price" as const,
      fillPriceCents: asInt(row.fill_price_cents),
      shares: asInt(row.shares),
      sessionDate: String(row.session_date),
    }));
  }

  if (link.metric === "limit_price") {
    const sessionDate = await sessionOn(link, userId, "paper_orders");
    if (!sessionDate) return [];
    const { data, error } = await supabase
      .from("paper_orders")
      .select("limit_price_cents, shares, session_date, order_type, created_at")
      .eq("user_id", userId)
      .eq("stock_id", link.stockId)
      .eq("session_date", sessionDate)
      .eq("side", link.side)
      .neq("status", "rejected")
      .order("created_at", { ascending: true });
    if (error) throw new PaperActionError(error.message, 500);
    return (data ?? []).map((row) => ({
      kind: "limit_price" as const,
      limitPriceCents: row.limit_price_cents == null ? null : asInt(row.limit_price_cents),
      shares: asInt(row.shares),
      sessionDate: String(row.session_date),
      orderType: row.order_type === "market" ? "market" : "limit",
    }));
  }

  const { data, error } = await supabase
    .from("paper_positions")
    .select("avg_cost_cents, settled_shares")
    .eq("user_id", userId)
    .eq("stock_id", link.stockId)
    .maybeSingle();
  if (error) throw new PaperActionError(error.message, 500);
  if (!data) return [];
  return [
    {
      kind: "avg_cost",
      avgCostCents: data.avg_cost_cents == null ? null : asInt(data.avg_cost_cents),
      settledShares: asInt(data.settled_shares),
    },
  ];
}

async function sessionOn(
  link: PaperLink,
  userId: string,
  table: "paper_fills" | "paper_orders",
): Promise<string | null> {
  if (link.when !== "latest") return link.sessionDate;
  const supabase = await createClient();
  let query = supabase
    .from(table)
    .select("session_date")
    .eq("user_id", userId)
    .eq("stock_id", link.stockId)
    .eq("side", link.side)
    .order("session_date", { ascending: false })
    .limit(1);
  if (table === "paper_orders") query = query.neq("status", "rejected");
  const { data, error } = await query.maybeSingle();
  if (error) throw new PaperActionError(error.message, 500);
  return data?.session_date ? String(data.session_date) : null;
}

function asInt(value: unknown): number {
  const number = typeof value === "string" ? Number(value) : value;
  if (typeof number !== "number" || !Number.isSafeInteger(number)) {
    throw new PaperActionError("金額不正確", 500);
  }
  return number;
}
