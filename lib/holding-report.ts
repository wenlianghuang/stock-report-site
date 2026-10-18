import { blendHoldingLegs } from "@/lib/holding-legs";
import { isValidAvgCost, isValidShareCount, isValidStockId } from "@/lib/validate";

/** 一次分析已存持股的上限，避免一次塞太多 gate。 */
export const MAX_HOLDINGS_BATCH = 20;

export type StoredHolding = {
  stockId: string;
  shareCount: number;
  avgCost: number;
  usesMargin?: boolean;
  cashShareCount?: number;
  cashAvgCost?: number;
  marginShareCount?: number;
  marginAvgCost?: number;
};

export type HoldingReportFields = {
  stockId: string;
  isHolding: true;
  shareCount: number;
  avgCost: number;
  usesMargin: boolean;
  cashShareCount?: number;
  cashAvgCost?: number;
  marginShareCount?: number;
  marginAvgCost?: number;
};

/** 有均價與股數才分析。現股／融資分腿優先，否則用合併後的股數與均價。 */
export function reportFieldsFromHolding(
  holding: StoredHolding,
): HoldingReportFields | null {
  const stockId = holding.stockId.trim();
  if (!isValidStockId(stockId)) {
    return null;
  }

  const legs = blendHoldingLegs({
    cashShareCount: holding.cashShareCount,
    cashAvgCost: holding.cashAvgCost,
    marginShareCount: holding.marginShareCount,
    marginAvgCost: holding.marginAvgCost,
  });
  if (
    legs &&
    isValidShareCount(legs.shareCount) &&
    isValidAvgCost(legs.avgCost)
  ) {
    return {
      stockId,
      isHolding: true,
      shareCount: legs.shareCount,
      avgCost: legs.avgCost,
      usesMargin: legs.usesMargin,
      cashShareCount: legs.cashShareCount,
      cashAvgCost: legs.cashAvgCost,
      marginShareCount: legs.marginShareCount,
      marginAvgCost: legs.marginAvgCost,
    };
  }

  const shareCount = Math.trunc(Number(holding.shareCount));
  const avgCost = Number(holding.avgCost);
  if (!isValidShareCount(shareCount) || !isValidAvgCost(avgCost)) {
    return null;
  }

  return {
    stockId,
    isHolding: true,
    shareCount,
    avgCost,
    usesMargin: Boolean(holding.usesMargin),
  };
}

export function selectHoldingsForAnalysis(
  holdings: StoredHolding[],
  limit = MAX_HOLDINGS_BATCH,
): { selected: HoldingReportFields[]; truncated: boolean } {
  const selected: HoldingReportFields[] = [];
  const seen = new Set<string>();
  for (const holding of holdings) {
    const fields = reportFieldsFromHolding(holding);
    if (!fields || seen.has(fields.stockId)) {
      continue;
    }
    seen.add(fields.stockId);
    selected.push(fields);
  }
  if (selected.length <= limit) {
    return { selected, truncated: false };
  }
  return { selected: selected.slice(0, limit), truncated: true };
}
