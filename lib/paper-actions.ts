import { createClient } from "@/lib/supabase/server";
import { previousTradingDay } from "@/lib/paper-calendar";
import { loadPaperBook, placePaperOrder, cancelPaperOrder, applyPaperClose } from "@/lib/paper-db";
import { fetchDailyCloses, fetchLiveQuotes, loadTradingCalendar } from "@/lib/paper-market";
import { placeOnBook, runPaperTick } from "@/lib/paper-session";
import type { LiveQuote } from "@/lib/paper-quote";
import {
  formatTwdFromCents,
  orderSessionDate,
  PAPER_RULE_TEXT,
  parseTwdToCents,
  sessionPhase,
  taipeiParts,
  type PaperOrderType,
  type PaperSide,
  type SessionPhase,
} from "@/lib/paper-trade";
import { buildPaperSnapshot, latestCloseOnOrBefore, type PaperSnapshot } from "@/lib/paper-view";
import { resolveListedMarket, resolveStockNameById } from "@/lib/tw-stock-registry";

export class PaperActionError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function placePaperOrderForUser(input: {
  stockId: string;
  side: PaperSide;
  orderType: PaperOrderType;
  shares: number;
  limitPrice: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const market = await resolveListedMarket(input.stockId);
  if (!market) throw new PaperActionError("不是上市或上櫃股號", 400);

  const limitPriceCents =
    input.orderType === "limit" ? parseTwdToCents(input.limitPrice ?? "") : null;
  if (input.orderType === "limit" && limitPriceCents === null) {
    throw new PaperActionError(PAPER_RULE_TEXT.invalid_limit_price, 400);
  }

  const account = await ensurePaperAccount();
  const book = await loadPaperBook(account.cash_cents);
  const calendar = await loadTradingCalendar(now);
  const sessionDate = orderSessionDate(now, calendar);
  const closes = await fetchDailyCloses(input.stockId, market);
  const previousClose = closes.get(previousTradingDay(sessionDate, calendar)) ?? null;

  const placed = placeOnBook(book, {
    instrument: { stockId: input.stockId, market, commonStock: true },
    side: input.side,
    orderType: input.orderType,
    limitPriceCents,
    shares: input.shares,
    previousCloseCents: previousClose,
    submittedAt: now,
    calendar,
    orderId: crypto.randomUUID(),
  });
  if (!placed.ok) throw new PaperActionError(textFor(placed.reason), 400);

  try {
    const saved = await placePaperOrder(placed.order);
    return {
      orderId: saved.id,
      status: saved.status,
      sessionDate: saved.session_date,
      reservedCash: formatTwdFromCents(saved.reserved_cash_cents),
      reservedShares: saved.reserved_shares,
    };
  } catch (error) {
    throw new PaperActionError(errorText(error), 400);
  }
}

export async function cancelPaperOrderForUser(orderId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
    throw new PaperActionError("找不到委託", 404);
  }
  try {
    const order = await cancelPaperOrder(orderId);
    return { orderId: order.id, status: order.status };
  } catch (error) {
    throw new PaperActionError(errorText(error), 400);
  }
}

export async function runPaperCloseForUser(now = new Date()) {
  const account = await ensurePaperAccount();
  const calendar = await loadTradingCalendar(now);
  const run = await closeOnce(account.cash_cents, now, calendar);
  return {
    cash: formatTwdFromCents(run.cashCents),
    expired: run.expired,
    filled: run.filled,
    settled: run.settled,
  };
}

async function closeOnce(
  cashCents: number,
  now: Date,
  calendar: Awaited<ReturnType<typeof loadTradingCalendar>>,
  attempt = 0,
) {
  const book = await loadPaperBook(cashCents);
  const [closes, quotes] = await Promise.all([loadCloses(book), loadQuotes(book, now)]);
  const run = runPaperTick(book, {
    now,
    calendar,
    createId: () => crypto.randomUUID(),
    closeOf: (stockId, sessionDate) => closes.get(stockId)?.get(sessionDate) ?? null,
    quotesOf: (stockId) => quotes.get(stockId) ?? null,
  });
  if (run.ops.length === 0) {
    return { cashCents: run.book.cashCents, expired: 0, filled: 0, settled: 0 };
  }

  try {
    await applyPaperClose(book.cashCents, run.ops);
  } catch (error) {
    if (!errorText(error).includes("帳簿已更新") || attempt >= 1) {
      throw new PaperActionError(errorText(error), 400);
    }
    const refreshed = await readAccount();
    if (!refreshed) throw new PaperActionError("沒有模擬帳戶", 400);
    return closeOnce(refreshed.cash_cents, now, calendar, attempt + 1);
  }

  return {
    cashCents: run.book.cashCents,
    expired: run.ops.filter((op) => op.op === "expire").length,
    filled: run.ops.filter((op) => op.op === "fill").length,
    settled: run.ops.filter((op) => op.op === "settle").length,
  };
}

export async function loadPaperSnapshotForUser(now = new Date()): Promise<PaperSnapshot> {
  const account = await ensurePaperAccount();
  const supabase = await createClient();
  const [orders, fills, settlements, positions] = await Promise.all([
    supabase.from("paper_orders").select("*"),
    supabase.from("paper_fills").select("*"),
    supabase.from("paper_settlements").select("*"),
    supabase.from("paper_positions").select("*"),
  ]);
  if (orders.error) throw new PaperActionError(orders.error.message, 500);
  if (fills.error) throw new PaperActionError(fills.error.message, 500);
  if (settlements.error) throw new PaperActionError(settlements.error.message, 500);
  if (positions.error) throw new PaperActionError(positions.error.message, 500);

  const orderRows = (orders.data ?? []) as Array<Record<string, unknown>>;
  const fillRows = (fills.data ?? []) as Array<Record<string, unknown>>;
  const settlementRows = (settlements.data ?? []) as Array<Record<string, unknown>>;
  const positionRows = (positions.data ?? []) as Array<Record<string, unknown>>;

  const stockIds = new Set<string>();
  for (const row of [...orderRows, ...fillRows, ...positionRows]) {
    stockIds.add(String(row.stock_id));
  }
  const names = new Map<string, string | null>();
  await Promise.all(
    Array.from(stockIds).map(async (stockId) => {
      names.set(stockId, await resolveStockNameById(stockId));
    }),
  );

  const today = taipeiParts(now).isoDate;
  const phase = await readPhase(now);
  const markedIds = new Set<string>();
  for (const row of positionRows) {
    if (asInt(row.settled_shares) > 0) markedIds.add(String(row.stock_id));
  }
  for (const row of settlementRows) {
    if (row.status === "pending" && row.side === "buy") markedIds.add(String(row.stock_id));
  }
  for (const row of orderRows) {
    if (row.status === "working") markedIds.add(String(row.stock_id));
  }
  const { closes, lastPrices, quoteAts } = await loadMarks(Array.from(markedIds), today, now, phase);

  return buildPaperSnapshot({
    cashCents: account.cash_cents,
    orders: orderRows.map((row) => ({
      id: String(row.id),
      stockId: String(row.stock_id),
      stockName: names.get(String(row.stock_id)) ?? null,
      side: asSide(row.side),
      orderType: asOrderType(row.order_type),
      limitPriceCents: row.limit_price_cents == null ? null : asInt(row.limit_price_cents),
      lots: asInt(row.lots),
      shares: asInt(row.shares),
      sessionDate: String(row.session_date),
      status: asStatus(row.status),
      reservedCashCents: asInt(row.reserved_cash_cents),
      reservedShares: asInt(row.reserved_shares),
      expireReason: row.expire_reason == null ? null : String(row.expire_reason),
      rejectReason: row.reject_reason == null ? null : String(row.reject_reason),
      submittedAt: String(row.submitted_at),
    })),
    fills: fillRows.map((row) => ({
      id: String(row.id),
      orderId: String(row.order_id),
      stockId: String(row.stock_id),
      stockName: names.get(String(row.stock_id)) ?? null,
      side: asSide(row.side),
      fillPriceCents: asInt(row.fill_price_cents),
      shares: asInt(row.shares),
      feeCents: asInt(row.fee_cents),
      taxCents: asInt(row.tax_cents),
      sessionDate: String(row.session_date),
      createdAt: String(row.created_at),
    })),
    settlements: settlementRows.map((row) => ({
      orderId: String(row.order_id),
      stockId: String(row.stock_id),
      side: asSide(row.side),
      settleOn: String(row.settle_on),
      status: asSettlementStatus(row.status),
      shares: asInt(row.shares),
      cashCents: asInt(row.cash_cents),
      realizedPnlCents: row.realized_pnl_cents == null ? null : asInt(row.realized_pnl_cents),
    })),
    positions: positionRows
      .filter((row) => asInt(row.settled_shares) > 0)
      .map((row) => ({
        stockId: String(row.stock_id),
        stockName: names.get(String(row.stock_id)) ?? null,
        settledShares: asInt(row.settled_shares),
        costBasisCents: asInt(row.cost_basis_cents),
      })),
    closes,
    phase,
    lastPrices,
    quoteAts,
  });
}

async function readPhase(now: Date): Promise<SessionPhase> {
  try {
    return sessionPhase(now, await loadTradingCalendar(now));
  } catch {
    return "off";
  }
}

async function loadMarks(stockIds: string[], today: string, now: Date, phase: SessionPhase) {
  const closes = new Map<string, { date: string; cents: number } | null>();
  const lastPrices = new Map<string, number | null>();
  const quoteAts = new Map<string, string | null>();
  const markets = new Map<string, "twse" | "tpex">();
  await Promise.all(
    stockIds.map(async (stockId) => {
      const market = await resolveListedMarket(stockId);
      if (market) markets.set(stockId, market);
    }),
  );

  let quotes = new Map<string, LiveQuote>();
  if (phase === "open" && markets.size > 0) {
    try {
      quotes = await fetchLiveQuotes(
        Array.from(markets, ([stockId, market]) => ({ stockId, market })),
        now,
      );
    } catch {
      quotes = new Map();
    }
  }

  await Promise.all(
    stockIds.map(async (stockId) => {
      const market = markets.get(stockId);
      if (!market) {
        closes.set(stockId, null);
        lastPrices.set(stockId, null);
        quoteAts.set(stockId, null);
        return;
      }
      const quote = quotes.get(stockId) ?? null;
      const intraday = quote?.last ?? null;
      let daily: { date: string; cents: number } | null = null;
      try {
        daily = latestCloseOnOrBefore(await fetchDailyCloses(stockId, market), today);
      } catch {
        daily = null;
      }
      lastPrices.set(stockId, intraday ?? (daily?.date === today ? daily.cents : null));
      quoteAts.set(stockId, intraday ? quote?.quoteAt ?? quote?.at ?? null : null);
      closes.set(stockId, intraday ? { date: today, cents: intraday } : daily);
    }),
  );
  return { closes, lastPrices, quoteAts };
}

async function ensurePaperAccount() {
  const existing = await readAccount();
  if (existing) return existing;
  const supabase = await createClient();
  const { error } = await supabase.rpc("open_paper_account");
  if (error && !error.message.includes("已經有模擬帳戶")) {
    throw new PaperActionError(error.message, 400);
  }
  const opened = await readAccount();
  if (!opened) throw new PaperActionError("沒有模擬帳戶", 400);
  return opened;
}

async function readAccount() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("paper_accounts").select("id, cash_cents").maybeSingle();
  if (error) throw new PaperActionError(error.message, 500);
  if (!data) return null;
  return { id: String(data.id), cash_cents: asInt(data.cash_cents) };
}

async function loadCloses(book: { orders: Array<{ stockId: string; market: "twse" | "tpex"; status: string }> }) {
  const wanted = new Map<string, "twse" | "tpex">();
  for (const order of book.orders) {
    if (order.status === "working") wanted.set(order.stockId, order.market);
  }
  const closes = new Map<string, Map<string, number>>();
  await Promise.all(
    Array.from(wanted.entries()).map(async ([stockId, market]) => {
      try {
        closes.set(stockId, await fetchDailyCloses(stockId, market));
      } catch {
        closes.set(stockId, new Map());
      }
    }),
  );
  return closes;
}

async function loadQuotes(
  book: { orders: Array<{ stockId: string; market: "twse" | "tpex"; status: string }> },
  now: Date,
) {
  const wanted = new Map<string, { stockId: string; market: "twse" | "tpex" }>();
  for (const order of book.orders) {
    if (order.status !== "working") continue;
    wanted.set(order.stockId, { stockId: order.stockId, market: order.market });
  }
  if (wanted.size === 0) return new Map<string, LiveQuote>();
  try {
    return await fetchLiveQuotes(Array.from(wanted.values()), now, { refresh: true });
  } catch {
    return new Map<string, LiveQuote>();
  }
}

function textFor(reason: string): string {
  if (reason in PAPER_RULE_TEXT) {
    return PAPER_RULE_TEXT[reason as keyof typeof PAPER_RULE_TEXT];
  }
  return reason;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "模擬帳寫入失敗";
}

function asSide(value: unknown): PaperSide {
  if (value === "buy" || value === "sell") return value;
  throw new PaperActionError("委託方向不正確", 500);
}

function asOrderType(value: unknown): PaperOrderType {
  if (value === "market" || value === "limit") return value;
  throw new PaperActionError("委託種類不正確", 500);
}

function asStatus(value: unknown): "working" | "filled" | "expired" | "cancelled" | "rejected" {
  if (
    value === "working" ||
    value === "filled" ||
    value === "expired" ||
    value === "cancelled" ||
    value === "rejected"
  ) {
    return value;
  }
  throw new PaperActionError("委託狀態不正確", 500);
}

function asSettlementStatus(value: unknown): "pending" | "settled" {
  if (value === "pending" || value === "settled") return value;
  throw new PaperActionError("交割狀態不正確", 500);
}

function asInt(value: unknown): number {
  const number = typeof value === "string" ? Number(value) : value;
  if (typeof number !== "number" || !Number.isSafeInteger(number)) {
    throw new PaperActionError("金額不正確", 500);
  }
  return number;
}
