/**
 * 模擬帳的現金流水。同一登入使用者一戶；不讀寫真實持股 holdings。
 * 開戶金額與 idempotency key 必須與 supabase/migrations/20261027_create_paper_ledger.sql 一致。
 * 流水入帳兩次時，第二次不改現金。
 */

/** 開戶現金 1,000,000 元。 */
export const OPENING_CASH_CENTS = 100_000_000;

export type CashKind = "opening" | "settlement";

export type CashMovement = {
  idempotencyKey: string;
  kind: CashKind;
  /** 開戶為正；買進交割為負；賣出交割為淨收入，可能為負。 */
  amountCents: number;
  orderId: string | null;
};

export type PaperBooks = {
  cashCents: number;
  movements: readonly CashMovement[];
};

export type PostCashResult =
  | { posted: true; books: PaperBooks }
  | { posted: false; reason: "duplicate"; books: PaperBooks };

export function openingKey(accountId: string): string {
  assertId(accountId, "帳戶編號不正確");
  return `${accountId}:opening`;
}

export function settlementKey(orderId: string): string {
  assertId(orderId, "委託編號不正確");
  return `${orderId}:settlement`;
}

export function openingMovement(accountId: string): CashMovement {
  return {
    idempotencyKey: openingKey(accountId),
    kind: "opening",
    amountCents: OPENING_CASH_CENTS,
    orderId: null,
  };
}

export function settlementMovement(orderId: string, amountCents: number): CashMovement {
  if (!Number.isSafeInteger(amountCents) || amountCents === 0) {
    throw new Error("結算金額不正確");
  }
  return {
    idempotencyKey: settlementKey(orderId),
    kind: "settlement",
    amountCents,
    orderId,
  };
}

export function openPaperBooks(accountId: string): PaperBooks {
  const posted = postCashMovement({ cashCents: 0, movements: [] }, openingMovement(accountId));
  if (!posted.posted) throw new Error("開戶失敗");
  return posted.books;
}

/** 已入帳的同一鍵，或同一張委託的第二次交割，都不改餘額。 */
export function postCashMovement(books: PaperBooks, movement: CashMovement): PostCashResult {
  assertMovement(movement);
  if (isDuplicate(books, movement)) {
    return { posted: false, reason: "duplicate", books };
  }

  const cashCents = books.cashCents + movement.amountCents;
  if (!Number.isSafeInteger(cashCents) || cashCents < 0) {
    throw new Error("現金不足");
  }

  return {
    posted: true,
    books: {
      cashCents,
      movements: [...books.movements, movement],
    },
  };
}

/**
 * 可用現金 = 已入帳現金 − 掛著的買單凍結 − 已成交但尚未交割的買進金額。
 * 後兩項傳正數。
 */
export function availableCashCents(input: {
  cashCents: number;
  workingBuyReservedCents: number;
  pendingBuyCashCents: number;
}): number {
  return subtractAvailable(
    input.cashCents,
    input.workingBuyReservedCents,
    input.pendingBuyCashCents,
    "現金不足",
  );
}

/**
 * 還能賣的股數 = 已交割股數 − 掛著的賣單 − 已成交但尚未交割的賣單。
 * 同一批股票只能放在其中一邊。
 */
export function availableSettledShares(input: {
  settledShares: number;
  workingSellReservedShares: number;
  pendingSellShares: number;
}): number {
  return subtractAvailable(
    input.settledShares,
    input.workingSellReservedShares,
    input.pendingSellShares,
    "已交割股數不足",
  );
}

function isDuplicate(books: PaperBooks, movement: CashMovement): boolean {
  return books.movements.some((row) => {
    if (row.idempotencyKey === movement.idempotencyKey) return true;
    if (movement.kind === "opening" && row.kind === "opening") return true;
    return (
      movement.kind === "settlement" &&
      row.kind === "settlement" &&
      row.orderId === movement.orderId
    );
  });
}

function assertMovement(movement: CashMovement): void {
  if (movement.kind === "opening") {
    const accountId = movement.idempotencyKey.slice(0, -":opening".length);
    if (
      movement.orderId !== null ||
      movement.amountCents !== OPENING_CASH_CENTS ||
      movement.idempotencyKey !== openingKey(accountId)
    ) {
      throw new Error("開戶金額不正確");
    }
    return;
  }

  if (movement.orderId === null || movement.idempotencyKey !== settlementKey(movement.orderId)) {
    throw new Error("結算流水鍵不正確");
  }
  if (!Number.isSafeInteger(movement.amountCents) || movement.amountCents === 0) {
    throw new Error("結算金額不正確");
  }
}

function assertId(value: string, message: string): void {
  if (!value || value.includes(":")) throw new Error(message);
}

function subtractAvailable(
  total: number,
  heldA: number,
  heldB: number,
  shortage: string,
): number {
  if (
    !Number.isSafeInteger(total) ||
    !Number.isSafeInteger(heldA) ||
    !Number.isSafeInteger(heldB) ||
    total < 0 ||
    heldA < 0 ||
    heldB < 0
  ) {
    throw new Error("現金或股數不正確");
  }
  const available = total - heldA - heldB;
  if (!Number.isSafeInteger(available) || available < 0) {
    throw new Error(shortage);
  }
  return available;
}
