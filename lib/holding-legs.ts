/** Helpers for cash / margin holding legs. */

export type HoldingLegsInput = {
  cashShareCount?: number;
  cashAvgCost?: number;
  marginShareCount?: number;
  marginAvgCost?: number;
};

export type BlendedHolding = HoldingLegsInput & {
  shareCount: number;
  avgCost: number;
  usesMargin: boolean;
};

export function blendHoldingLegs(input: HoldingLegsInput): BlendedHolding | null {
  const cashShares =
    input.cashShareCount !== undefined && Number.isFinite(input.cashShareCount)
      ? Math.trunc(input.cashShareCount)
      : 0;
  const marginShares =
    input.marginShareCount !== undefined && Number.isFinite(input.marginShareCount)
      ? Math.trunc(input.marginShareCount)
      : 0;
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
