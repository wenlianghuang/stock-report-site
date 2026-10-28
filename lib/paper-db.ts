import { createClient } from "@/lib/supabase/server";
import type { PaperBook, PaperCloseOp, SessionOrder, SessionPosition, SessionSettlement } from "@/lib/paper-session";
import type { PaperMarket, PaperOrderType, PaperSide } from "@/lib/paper-trade";

export type PaperAccountRow = {
  id: string;
  cash_cents: number;
};

export type SavedPaperOrder = {
  id: string;
  status: string;
  session_date: string;
  reserved_cash_cents: number;
  reserved_shares: number;
};

export async function loadPaperBook(cashCents: number): Promise<PaperBook> {
  const supabase = await createClient();
  const [orders, settlements, positions] = await Promise.all([
    supabase.from("paper_orders").select("*"),
    supabase.from("paper_settlements").select("*"),
    supabase.from("paper_positions").select("*"),
  ]);
  if (orders.error) throw new Error(orders.error.message);
  if (settlements.error) throw new Error(settlements.error.message);
  if (positions.error) throw new Error(positions.error.message);

  return {
    cashCents,
    orders: ((orders.data ?? []) as Array<Record<string, unknown>>).map(mapOrder),
    fills: [],
    settlements: ((settlements.data ?? []) as Array<Record<string, unknown>>).map(mapSettlement),
    positions: ((positions.data ?? []) as Array<Record<string, unknown>>).map(mapPosition),
  };
}

export async function placePaperOrder(order: SessionOrder): Promise<SavedPaperOrder> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("insert_paper_order", {
    p_order_id: order.id,
    p_stock_id: order.stockId,
    p_market: order.market,
    p_side: order.side,
    p_order_type: order.orderType,
    p_limit_price_cents: order.limitPriceCents,
    p_lots: order.lots,
    p_shares: order.shares,
    p_session_date: order.sessionDate,
    p_reserved_cash_cents: order.reservedCashCents,
    p_reserved_shares: order.reservedShares,
    p_limit_up_cents: order.limitUpCents,
    p_limit_down_cents: order.limitDownCents,
  });
  if (error || !data) throw new Error(error?.message ?? "無法寫入委託");
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    status: String(row.status),
    session_date: String(row.session_date),
    reserved_cash_cents: asInt(row.reserved_cash_cents),
    reserved_shares: asInt(row.reserved_shares),
  };
}

export async function cancelPaperOrder(orderId: string): Promise<SavedPaperOrder> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_paper_order", { p_order_id: orderId });
  if (error || !data) throw new Error(error?.message ?? "只有掛著的單可以取消");
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    status: String(row.status),
    session_date: String(row.session_date),
    reserved_cash_cents: asInt(row.reserved_cash_cents),
    reserved_shares: asInt(row.reserved_shares),
  };
}

export async function applyPaperClose(expectedCashCents: number, ops: PaperCloseOp[]): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_paper_close", {
    p_expected_cash_cents: expectedCashCents,
    p_operations: ops.map(toSqlOp),
  });
  if (error) throw new Error(error.message);
}

function mapOrder(row: Record<string, unknown>): SessionOrder {
  return {
    id: String(row.id),
    stockId: String(row.stock_id),
    market: row.market as PaperMarket,
    side: row.side as PaperSide,
    orderType: row.order_type as PaperOrderType,
    limitPriceCents: row.limit_price_cents == null ? null : asInt(row.limit_price_cents),
    lots: asInt(row.lots),
    shares: asInt(row.shares),
    sessionDate: String(row.session_date),
    status: row.status as SessionOrder["status"],
    reservedCashCents: asInt(row.reserved_cash_cents),
    reservedShares: asInt(row.reserved_shares),
    limitUpCents: asInt(row.limit_up_cents),
    limitDownCents: asInt(row.limit_down_cents),
    rejectReason: row.reject_reason == null ? null : String(row.reject_reason),
    expireReason: row.expire_reason == null ? null : String(row.expire_reason),
    submittedAt: String(row.submitted_at),
  };
}

function mapSettlement(row: Record<string, unknown>): SessionSettlement {
  return {
    id: String(row.id),
    orderId: String(row.order_id),
    fillId: String(row.fill_id),
    stockId: String(row.stock_id),
    side: row.side as PaperSide,
    settleOn: String(row.settle_on),
    status: row.status as SessionSettlement["status"],
    shares: asInt(row.shares),
    cashCents: asInt(row.cash_cents),
    realizedPnlCents: row.realized_pnl_cents == null ? null : asInt(row.realized_pnl_cents),
  };
}

function mapPosition(row: Record<string, unknown>): SessionPosition {
  return {
    stockId: String(row.stock_id),
    settledShares: asInt(row.settled_shares),
    costBasisCents: asInt(row.cost_basis_cents),
  };
}

function toSqlOp(op: PaperCloseOp): Record<string, unknown> {
  if (op.op === "expire") {
    return { op: "expire", order_id: op.orderId, reason: op.reason };
  }
  if (op.op === "fill") {
    return {
      op: "fill",
      order_id: op.orderId,
      fill_id: op.fillId,
      settlement_id: op.settlementId,
      fill_price_cents: op.fillPriceCents,
      shares: op.shares,
      notional_cents: op.notionalCents,
      fee_cents: op.feeCents,
      tax_cents: op.taxCents,
      settle_on: op.settleOn,
      cash_cents: op.cashCents,
    };
  }
  return {
    op: "settle",
    settlement_id: op.settlementId,
    settled_shares: op.settledShares,
    avg_cost_cents: op.avgCostCents,
    cost_basis_cents: op.costBasisCents,
    realized_pnl_cents: op.realizedPnlCents,
  };
}

function asInt(value: unknown): number {
  const number = typeof value === "string" ? Number(value) : value;
  if (typeof number !== "number" || !Number.isSafeInteger(number)) {
    throw new Error("金額不正確");
  }
  return number;
}
