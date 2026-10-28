/**
 * 模擬交易畫面用的唯讀快照。
 * 金額與未實現損益在這裡算完，畫面只負責呈現。
 */

import { availableCashCents, availableSettledShares } from "@/lib/paper-ledger";
import { positionAvgCostCents, type PaperOrderStatus } from "@/lib/paper-session";
import {
  PAPER_RULE_TEXT,
  formatTwdFromCents,
  sessionPhaseLabel,
  type PaperOrderType,
  type PaperSide,
  type SessionPhase,
} from "@/lib/paper-trade";

export type PaperSnapshotOrder = {
  id: string;
  stockId: string;
  stockName: string | null;
  side: PaperSide;
  orderType: PaperOrderType;
  limitPriceCents: number | null;
  lots: number;
  shares: number;
  sessionDate: string;
  status: PaperOrderStatus;
  reservedCashCents: number;
  reservedShares: number;
  expireReason: string | null;
  rejectReason: string | null;
  submittedAt: string;
};

export type PaperSnapshotFill = {
  id: string;
  orderId: string;
  stockId: string;
  stockName: string | null;
  side: PaperSide;
  fillPriceCents: number;
  shares: number;
  feeCents: number;
  taxCents: number;
  sessionDate: string;
  createdAt: string;
};

export type PaperSnapshotSettlement = {
  orderId: string;
  stockId: string;
  side: PaperSide;
  settleOn: string;
  status: "pending" | "settled";
  shares: number;
  cashCents: number;
  realizedPnlCents: number | null;
};

export type PaperSnapshotPosition = {
  stockId: string;
  stockName: string | null;
  settledShares: number;
  costBasisCents: number;
};

export type PaperMoneyView = {
  text: string;
  cents: number;
};

export type PaperPositionView = {
  stockId: string;
  stockName: string | null;
  shares: number;
  availableShares: number;
  pendingShares: number;
  statusText: string;
  avgCostText: string;
  closeText: string | null;
  closeDate: string | null;
  marketValue: PaperMoneyView | null;
  unrealized: PaperMoneyView | null;
};

export type PaperWorkingView = {
  id: string;
  stockId: string;
  stockName: string | null;
  side: PaperSide;
  orderType: PaperOrderType;
  shares: number;
  priceText: string;
  sessionDate: string;
  submittedText: string;
  reservedText: string;
  lastText: string | null;
  lastAtText: string | null;
};

export type PaperRecordOutcome = "filled" | "expired" | "cancelled" | "rejected";

export type PaperRecordView = {
  id: string;
  at: string;
  stockId: string;
  stockName: string | null;
  side: PaperSide;
  orderType: PaperOrderType | null;
  shares: number;
  outcome: PaperRecordOutcome;
  priceText: string | null;
  feeText: string | null;
  taxText: string | null;
  detail: string;
  pnl: PaperMoneyView | null;
};

export type PaperSnapshot = {
  cash: PaperMoneyView;
  available: PaperMoneyView;
  reserved: PaperMoneyView;
  phase: SessionPhase;
  phaseLabel: string;
  positions: PaperPositionView[];
  totals: {
    marketValue: PaperMoneyView | null;
    unrealized: PaperMoneyView | null;
    complete: boolean;
  };
  working: PaperWorkingView[];
  records: PaperRecordView[];
};

export function formatPaperTwd(cents: number): string {
  const raw = formatTwdFromCents(cents);
  const negative = raw.startsWith("-");
  const body = negative ? raw.slice(1) : raw;
  const [yuan, fraction] = body.split(".");
  const grouped = yuan.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}.${fraction}`;
}

export function formatTaipeiDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")} ${hour}:${get("minute")}`;
}

export function formatTaipeiClock(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${hour}:${get("minute")}`;
}

/** 取 today（含）以前最近的一筆收盤。日期為台北曆日。 */
export function latestCloseOnOrBefore(
  closes: ReadonlyMap<string, number>,
  today: string,
): { date: string; cents: number } | null {
  let best: { date: string; cents: number } | null = null;
  for (const [date, cents] of closes) {
    if (date > today) continue;
    if (!Number.isSafeInteger(cents) || cents <= 0) continue;
    if (!best || date > best.date) best = { date, cents };
  }
  return best;
}

export function buildPaperSnapshot(input: {
  cashCents: number;
  orders: PaperSnapshotOrder[];
  fills: PaperSnapshotFill[];
  settlements: PaperSnapshotSettlement[];
  positions: PaperSnapshotPosition[];
  closes: ReadonlyMap<string, { date: string; cents: number } | null>;
  phase?: SessionPhase;
  lastPrices?: ReadonlyMap<string, number | null>;
  quoteAts?: ReadonlyMap<string, string | null>;
}): PaperSnapshot {
  const availableCents = availableCashCents({
    cashCents: input.cashCents,
    workingBuyReservedCents: sum(
      input.orders.filter((order) => order.status === "working" && order.side === "buy"),
      (order) => order.reservedCashCents,
    ),
    pendingBuyCashCents: sum(
      input.settlements.filter((row) => row.status === "pending" && row.side === "buy"),
      (row) => -row.cashCents,
    ),
  });
  const reservedCents = input.cashCents - availableCents;

  const positions = holdings(input)
    .sort((a, b) => a.stockId.localeCompare(b.stockId))
    .map((position) => toPositionView(position, input));

  const marked = positions.filter((position) => position.marketValue && position.unrealized);
  const complete = positions.length > 0 && marked.length === positions.length;
  const marketValueCents = complete
    ? marked.reduce((total, position) => total + (position.marketValue?.cents ?? 0), 0)
    : null;
  const unrealizedCents = complete
    ? marked.reduce((total, position) => total + (position.unrealized?.cents ?? 0), 0)
    : null;

  const orderById = new Map(input.orders.map((order) => [order.id, order]));
  const settlementByOrder = new Map(input.settlements.map((row) => [row.orderId, row]));
  const filledOrderIds = new Set(input.fills.map((fill) => fill.orderId));

  const records: PaperRecordView[] = [
    ...input.fills.map((fill) => toFillRecord(fill, orderById.get(fill.orderId), settlementByOrder.get(fill.orderId))),
    ...input.orders
      .filter((order) => order.status !== "working" && !filledOrderIds.has(order.id))
      .map(toOrderRecord),
  ].sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));

  const working = input.orders
    .filter((order) => order.status === "working")
    .slice()
    .sort(
      (a, b) =>
        a.sessionDate.localeCompare(b.sessionDate) ||
        a.submittedAt.localeCompare(b.submittedAt) ||
        a.id.localeCompare(b.id),
    )
    .map((order) =>
      toWorkingView(
        order,
        input.lastPrices?.get(order.stockId) ?? null,
        input.quoteAts?.get(order.stockId) ?? null,
      ),
    );

  const phase = input.phase ?? "closed";
  return {
    cash: money(input.cashCents),
    available: money(availableCents),
    reserved: money(reservedCents),
    phase,
    phaseLabel: sessionPhaseLabel(phase),
    positions,
    totals: {
      marketValue:
        marketValueCents !== null && Number.isSafeInteger(marketValueCents)
          ? money(marketValueCents)
          : null,
      unrealized:
        unrealizedCents !== null && Number.isSafeInteger(unrealizedCents)
          ? money(unrealizedCents)
          : null,
      complete,
    },
    working,
    records,
  };
}

type Holding = {
  stockId: string;
  stockName: string | null;
  settledShares: number;
  settledCostCents: number;
  pendingShares: number;
  pendingCostCents: number;
  settleOn: string | null;
};

function holdings(input: {
  orders: PaperSnapshotOrder[];
  fills: PaperSnapshotFill[];
  settlements: PaperSnapshotSettlement[];
  positions: PaperSnapshotPosition[];
}): Holding[] {
  const names = new Map<string, string | null>();
  for (const row of [...input.orders, ...input.fills, ...input.positions]) {
    if (row.stockName) names.set(row.stockId, row.stockName);
  }
  const byStock = new Map<string, Holding>();
  const ensure = (stockId: string): Holding => {
    const current = byStock.get(stockId);
    if (current) return current;
    const created: Holding = {
      stockId,
      stockName: names.get(stockId) ?? null,
      settledShares: 0,
      settledCostCents: 0,
      pendingShares: 0,
      pendingCostCents: 0,
      settleOn: null,
    };
    byStock.set(stockId, created);
    return created;
  };

  for (const position of input.positions) {
    if (position.settledShares <= 0) continue;
    const row = ensure(position.stockId);
    row.settledShares = position.settledShares;
    row.settledCostCents = position.costBasisCents;
  }
  for (const settlement of input.settlements) {
    if (settlement.status !== "pending" || settlement.side !== "buy") continue;
    if (settlement.shares < 1 || settlement.cashCents >= 0) continue;
    const row = ensure(settlement.stockId);
    row.pendingShares += settlement.shares;
    row.pendingCostCents += -settlement.cashCents;
    if (!row.settleOn || settlement.settleOn < row.settleOn) row.settleOn = settlement.settleOn;
  }
  return Array.from(byStock.values()).filter((row) => row.settledShares + row.pendingShares > 0);
}

function toPositionView(
  position: Holding,
  input: {
    orders: PaperSnapshotOrder[];
    settlements: PaperSnapshotSettlement[];
    closes: ReadonlyMap<string, { date: string; cents: number } | null>;
    quoteAts?: ReadonlyMap<string, string | null>;
  },
): PaperPositionView {
  const shares = position.settledShares + position.pendingShares;
  const costBasisCents = position.settledCostCents + position.pendingCostCents;
  const availableShares = availableSettledShares({
    settledShares: position.settledShares,
    workingSellReservedShares: sum(
      input.orders.filter(
        (order) =>
          order.status === "working" && order.side === "sell" && order.stockId === position.stockId,
      ),
      (order) => order.reservedShares,
    ),
    pendingSellShares: sum(
      input.settlements.filter(
        (row) => row.status === "pending" && row.side === "sell" && row.stockId === position.stockId,
      ),
      (row) => row.shares,
    ),
  });
  const avg =
    shares > 0
      ? positionAvgCostCents({
          stockId: position.stockId,
          settledShares: shares,
          costBasisCents,
        })
      : null;
  const close = input.closes.get(position.stockId) ?? null;
  const quoteAt = input.quoteAts?.get(position.stockId) ?? null;
  const marketValueCents = close ? close.cents * shares : null;
  const unrealizedCents =
    marketValueCents !== null && Number.isSafeInteger(marketValueCents)
      ? marketValueCents - costBasisCents
      : null;
  const statusText =
    position.pendingShares > 0
      ? position.settledShares > 0
        ? `含待交割 ${position.pendingShares} 股`
        : `待交割，交割日 ${position.settleOn ?? "—"}`
      : "已交割";

  return {
    stockId: position.stockId,
    stockName: position.stockName,
    shares,
    availableShares,
    pendingShares: position.pendingShares,
    statusText,
    avgCostText: avg === null ? "—" : formatPaperTwd(avg),
    closeText: close ? formatPaperTwd(close.cents) : null,
    closeDate: quoteAt ? formatTaipeiClock(quoteAt) : close?.date ?? null,
    marketValue:
      marketValueCents !== null && Number.isSafeInteger(marketValueCents)
        ? money(marketValueCents)
        : null,
    unrealized:
      unrealizedCents !== null && Number.isSafeInteger(unrealizedCents)
        ? money(unrealizedCents)
        : null,
  };
}

function toWorkingView(
  order: PaperSnapshotOrder,
  lastCents: number | null,
  quoteAt: string | null,
): PaperWorkingView {
  return {
    id: order.id,
    stockId: order.stockId,
    stockName: order.stockName,
    side: order.side,
    orderType: order.orderType,
    shares: order.shares,
    priceText: order.orderType === "market" ? "市價" : formatPaperTwd(order.limitPriceCents ?? 0),
    sessionDate: order.sessionDate,
    submittedText: formatTaipeiDateTime(order.submittedAt),
    lastText: lastCents && lastCents > 0 ? formatPaperTwd(lastCents) : null,
    lastAtText: quoteAt ? formatTaipeiClock(quoteAt) : null,
    reservedText:
      order.side === "buy"
        ? `凍結 ${formatPaperTwd(order.reservedCashCents)} 元`
        : `凍結 ${order.shares} 股`,
  };
}

function toFillRecord(
  fill: PaperSnapshotFill,
  order: PaperSnapshotOrder | undefined,
  settlement: PaperSnapshotSettlement | undefined,
): PaperRecordView {
  const settled = settlement?.status === "settled";
  const pnl =
    settled && settlement?.realizedPnlCents != null ? money(settlement.realizedPnlCents) : null;
  return {
    id: fill.id,
    at: formatTaipeiDateTime(fill.createdAt),
    stockId: fill.stockId,
    stockName: fill.stockName,
    side: fill.side,
    orderType: order?.orderType ?? null,
    shares: fill.shares,
    outcome: "filled",
    priceText: formatPaperTwd(fill.fillPriceCents),
    feeText: formatPaperTwd(fill.feeCents),
    taxText: fill.side === "sell" ? formatPaperTwd(fill.taxCents) : null,
    detail: settlement
      ? settled
        ? `已於 ${settlement.settleOn} 交割`
        : `待交割，交割日 ${settlement.settleOn}`
      : "已成交",
    pnl,
  };
}

function toOrderRecord(order: PaperSnapshotOrder): PaperRecordView {
  const outcome: PaperRecordOutcome =
    order.status === "expired" || order.status === "cancelled" || order.status === "rejected"
      ? order.status
      : "expired";
  return {
    id: order.id,
    at: formatTaipeiDateTime(order.submittedAt),
    stockId: order.stockId,
    stockName: order.stockName,
    side: order.side,
    orderType: order.orderType,
    shares: order.shares,
    outcome,
    priceText: order.orderType === "limit" ? formatPaperTwd(order.limitPriceCents ?? 0) : "市價",
    feeText: null,
    taxText: null,
    detail: recordDetail(order),
    pnl: null,
  };
}

function recordDetail(order: PaperSnapshotOrder): string {
  if (order.status === "expired") return reasonText(order.expireReason, "已到期");
  if (order.status === "cancelled") return "凍結已釋放";
  if (order.status === "rejected") return reasonText(order.rejectReason, "已拒絕");
  return "已結束";
}

function reasonText(reason: string | null, fallback: string): string {
  if (!reason) return fallback;
  if (reason in PAPER_RULE_TEXT) {
    return PAPER_RULE_TEXT[reason as keyof typeof PAPER_RULE_TEXT];
  }
  return reason;
}

function money(cents: number): PaperMoneyView {
  return { text: formatPaperTwd(cents), cents };
}

function sum<T>(rows: T[], value: (row: T) => number): number {
  return rows.reduce((total, row) => total + value(row), 0);
}
