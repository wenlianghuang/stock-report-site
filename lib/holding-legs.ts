/** Helpers for cash / margin holding legs. */

/** 台股 1 張 = 1000 股；融資以整張為單位。 */
export const SHARES_PER_LOT = 1000;

export type HoldingLegsInput = {
  cashShareCount?: number;
  cashAvgCost?: number;
  /** 融資股數（須為 1000 的倍數）；或改傳 marginLotCount */
  marginShareCount?: number;
  marginAvgCost?: number;
  /** 融資張數（優先於 marginShareCount） */
  marginLotCount?: number;
};

export type BlendedHolding = {
  cashShareCount?: number;
  cashAvgCost?: number;
  marginShareCount?: number;
  marginAvgCost?: number;
  shareCount: number;
  avgCost: number;
  usesMargin: boolean;
};

export function lotsToShares(lots: number): number {
  return Math.trunc(lots) * SHARES_PER_LOT;
}

/** 股數換算張數；非整張時回傳 null。 */
export function sharesToLots(shares: number): number | null {
  if (!Number.isFinite(shares) || shares <= 0) return null;
  const n = Math.trunc(shares);
  if (n % SHARES_PER_LOT !== 0) return null;
  return n / SHARES_PER_LOT;
}

export function formatMarginQuantity(shares: number): string {
  const lots = sharesToLots(shares);
  if (lots !== null) {
    return `${lots.toLocaleString("zh-TW")} 張`;
  }
  return `${shares.toLocaleString("zh-TW")} 股`;
}

export function blendHoldingLegs(input: HoldingLegsInput): BlendedHolding | null {
  const cashShares =
    input.cashShareCount !== undefined && Number.isFinite(input.cashShareCount)
      ? Math.trunc(input.cashShareCount)
      : 0;

  let marginShares = 0;
  if (
    input.marginLotCount !== undefined &&
    Number.isFinite(input.marginLotCount)
  ) {
    const lots = Math.trunc(input.marginLotCount);
    if (lots < 0) return null;
    marginShares = lotsToShares(lots);
  } else if (
    input.marginShareCount !== undefined &&
    Number.isFinite(input.marginShareCount)
  ) {
    marginShares = Math.trunc(input.marginShareCount);
    if (marginShares > 0 && marginShares % SHARES_PER_LOT !== 0) {
      return null;
    }
  }

  const cashCost =
    input.cashAvgCost !== undefined && Number.isFinite(input.cashAvgCost)
      ? Number(input.cashAvgCost)
      : undefined;
  const marginCost =
    input.marginAvgCost !== undefined && Number.isFinite(input.marginAvgCost)
      ? Number(input.marginAvgCost)
      : undefined;

  if (cashShares < 0 || marginShares < 0) return null;
  if (cashShares > 0 && (cashCost === undefined || cashCost <= 0)) return null;
  if (marginShares > 0 && (marginCost === undefined || marginCost <= 0)) return null;

  const total = cashShares + marginShares;
  if (total <= 0) return null;

  const value =
    cashShares * (cashCost ?? 0) + marginShares * (marginCost ?? 0);
  return {
    cashShareCount: cashShares > 0 ? cashShares : undefined,
    cashAvgCost: cashShares > 0 ? cashCost : undefined,
    marginShareCount: marginShares > 0 ? marginShares : undefined,
    marginAvgCost: marginShares > 0 ? marginCost : undefined,
    shareCount: total,
    avgCost: value / total,
    usesMargin: marginShares > 0,
  };
}
