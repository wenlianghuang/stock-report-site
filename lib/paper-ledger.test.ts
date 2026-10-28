import { describe, expect, it } from "vitest";
import { formatTwdFromCents } from "./paper-trade";
import {
  availableCashCents,
  availableSettledShares,
  openPaperBooks,
  OPENING_CASH_CENTS,
  openingKey,
  postCashMovement,
  settlementKey,
  settlementMovement,
  type CashMovement,
} from "./paper-ledger";

const ACCOUNT = "account-1";
const ORDER = "order-1";

describe("paper ledger", () => {
  it("opens one account with 1,000,000 TWD", () => {
    const books = openPaperBooks(ACCOUNT);
    expect(books.cashCents).toBe(OPENING_CASH_CENTS);
    expect(formatTwdFromCents(books.cashCents)).toBe("1000000.00");
    expect(books.movements).toEqual([
      {
        idempotencyKey: openingKey(ACCOUNT),
        kind: "opening",
        amountCents: OPENING_CASH_CENTS,
        orderId: null,
      },
    ]);
  });

  it("does not credit opening cash a second time", () => {
    const books = openPaperBooks(ACCOUNT);
    const again = postCashMovement(books, {
      idempotencyKey: "other:opening",
      kind: "opening",
      amountCents: OPENING_CASH_CENTS,
      orderId: null,
    });
    expect(again).toEqual({ posted: false, reason: "duplicate", books });
    expect(again.books.cashCents).toBe(OPENING_CASH_CENTS);
  });

  it("deducts a buy settlement once, even if the second key is different", () => {
    const opened = openPaperBooks(ACCOUNT);
    const first = postCashMovement(opened, settlementMovement(ORDER, -2_000_000));
    if (!first.posted) throw new Error(first.reason);
    expect(first.books.cashCents).toBe(OPENING_CASH_CENTS - 2_000_000);

    const retry = postCashMovement(first.books, settlementMovement(ORDER, -2_000_000));
    expect(retry.posted).toBe(false);
    if (retry.posted) return;
    expect(retry.books.cashCents).toBe(first.books.cashCents);

    const renamed: CashMovement = {
      idempotencyKey: settlementKey("other-order"),
      kind: "settlement",
      amountCents: -2_000_000,
      orderId: ORDER,
    };
    expect(() => postCashMovement(first.books, renamed)).toThrow(/結算流水鍵不正確/);
    expect(first.books.cashCents).toBe(OPENING_CASH_CENTS - 2_000_000);
  });

  it("rejects a second settlement for the same order before cash can change", () => {
    const opened = openPaperBooks(ACCOUNT);
    const first = postCashMovement(opened, settlementMovement(ORDER, -2_000_000));
    if (!first.posted) throw new Error(first.reason);
    const sameOrderDifferentAmount = postCashMovement(
      first.books,
      settlementMovement(ORDER, -1),
    );
    expect(sameOrderDifferentAmount).toMatchObject({
      posted: false,
      reason: "duplicate",
    });
    expect(sameOrderDifferentAmount.books.cashCents).toBe(first.books.cashCents);
  });

  it("leaves the previous balance untouched when cash would go negative", () => {
    const books = openPaperBooks(ACCOUNT);
    expect(() => postCashMovement(books, settlementMovement(ORDER, -(OPENING_CASH_CENTS + 1)))).toThrow(
      /現金不足/,
    );
    expect(books.cashCents).toBe(OPENING_CASH_CENTS);
    expect(books.movements).toHaveLength(1);
  });

  it("keeps reserved and unsettled buys out of spendable cash", () => {
    expect(
      availableCashCents({
        cashCents: OPENING_CASH_CENTS,
        workingBuyReservedCents: 5_000_000,
        pendingBuyCashCents: 1_000_000,
      }),
    ).toBe(OPENING_CASH_CENTS - 6_000_000);
  });

  it("keeps working and unsettled sells out of sellable shares", () => {
    expect(
      availableSettledShares({
        settledShares: 3000,
        workingSellReservedShares: 1000,
        pendingSellShares: 1000,
      }),
    ).toBe(1000);
    expect(() =>
      availableSettledShares({
        settledShares: 1000,
        workingSellReservedShares: 1000,
        pendingSellShares: 1000,
      }),
    ).toThrow(/已交割股數不足/);
  });
});
