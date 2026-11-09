/**
 * 依連結執行目錄裡的查詢。使用者編號由登入狀態帶入，不從問句解析。
 */

import { createClient } from "@/lib/supabase/server";
import { PaperActionError } from "@/lib/paper-actions";
import {
  admitProposedSql,
  canRetryLinkWithModel,
  catalogSql,
  formatPaperAnswer,
  linkPaperQuestion,
  type PaperFact,
  type PaperLink,
  type PaperLinkResult,
} from "@/lib/paper-link";
import { linkUnparsedQuestion } from "@/lib/paper-ollama-link";
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
  const ruled = await linkPaperQuestion(question, resolveStockIdFromText);
  const linked = await linkWithModelFallback(question, ruled);
  if (!linked.ok) return { ok: false, answer: linked.reason };

  const forStock = linked.link.metric === "month_fills" && linked.link.stockId != null;
  const notes: string[] = [];
  if (linked.viaModel) notes.push("問句由模型對上目錄，查的仍是目錄裡的語句。");
  if (
    proposedSql != null &&
    proposedSql.trim() !== "" &&
    !admitProposedSql(proposedSql, linked.link.metric, linked.link.when, forStock)
  ) {
    notes.push("提出的 SQL 與這條指標的目錄語句不一致，已改執行目錄裡的語句。");
  }
  const note = notes.length > 0 ? notes.join("") : null;

  const userId = await currentUserId();
  const rows = await readFacts(linked.link, userId);
  const stockNames = await namesFor(linked.link, rows);
  const stockName = linked.link.stockId ? (stockNames[linked.link.stockId] ?? null) : null;
  return {
    ok: true,
    answer: formatPaperAnswer({ link: linked.link, stockName, stockNames, rows }),
    sql: catalogSql(linked.link.metric, linked.link.when, forStock),
    link: linked.link,
    note,
  };
}

async function linkWithModelFallback(
  question: string,
  ruled: PaperLinkResult,
): Promise<PaperLinkResult & { viaModel?: boolean }> {
  if (ruled.ok) return ruled;
  if (!canRetryLinkWithModel(ruled.reason, question)) return ruled;
  const modeled = await linkUnparsedQuestion(question, resolveStockIdFromText);
  if (!modeled?.ok) return ruled;
  return { ...modeled, viaModel: true };
}

async function currentUserId(): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const id = data?.claims && typeof data.claims.sub === "string" ? data.claims.sub : null;
  if (error || !id) throw new PaperActionError("未登入", 401);
  return id;
}

async function namesFor(link: PaperLink, rows: PaperFact[]): Promise<Record<string, string | null>> {
  const ids = new Set<string>();
  if (link.stockId) ids.add(link.stockId);
  for (const row of rows) {
    if (row.kind === "fill_price" && row.stockId) ids.add(row.stockId);
  }
  const names: Record<string, string | null> = {};
  await Promise.all(
    [...ids].map(async (id) => {
      names[id] = await resolveStockNameById(id);
    }),
  );
  return names;
}

async function readFacts(link: PaperLink, userId: string): Promise<PaperFact[]> {
  const supabase = await createClient();
  if (link.metric === "month_fills") {
    let query = supabase
      .from("paper_fills")
      .select("stock_id, fill_price_cents, shares, session_date, created_at")
      .eq("user_id", userId)
      .eq("side", link.side)
      .gte("session_date", link.fromDate)
      .lte("session_date", link.toDate)
      .order("session_date", { ascending: true })
      .order("created_at", { ascending: true });
    if (link.stockId) query = query.eq("stock_id", link.stockId);
    const { data, error } = await query;
    if (error) throw new PaperActionError(error.message, 500);
    return (data ?? []).map((row) => ({
      kind: "fill_price" as const,
      fillPriceCents: asInt(row.fill_price_cents),
      shares: asInt(row.shares),
      sessionDate: String(row.session_date),
      stockId: String(row.stock_id),
    }));
  }

  if (link.metric === "latest_fill") {
    const { data, error } = await supabase
      .from("paper_fills")
      .select("stock_id, fill_price_cents, shares, session_date, created_at")
      .eq("user_id", userId)
      .eq("side", link.side)
      .order("session_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new PaperActionError(error.message, 500);
    return (data ?? []).map((row) => ({
      kind: "fill_price" as const,
      fillPriceCents: asInt(row.fill_price_cents),
      shares: asInt(row.shares),
      sessionDate: String(row.session_date),
      stockId: String(row.stock_id),
    }));
  }

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
