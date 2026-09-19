import type {
  MarketDailyRecord,
  MarketWeeklyRecord,
  PortfolioRecord,
  ReportRecord,
} from "./types";

export function isValidStockId(value: string): boolean {
  return /^\d{4,6}$/.test(value.trim());
}

export function isValidTradeDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export function isValidReportStatus(value: string): value is ReportRecord["status"] {
  return ["queued", "fetching", "gating", "positioning", "done", "failed"].includes(
    value,
  );
}

export function isValidShareCount(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

export function isValidAvgCost(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function isValidPortfolioStatus(
  value: string,
): value is PortfolioRecord["status"] {
  return ["queued", "gating", "done", "failed"].includes(value);
}

export function isValidPortfolioProfile(
  value: string,
): value is PortfolioRecord["profile"] {
  return (
    ["conservative", "balanced", "aggressive"].includes(value) ||
    /^theme_[a-z0-9_]+$/.test(value)
  );
}

export function isValidPortfolioMode(
  value: string,
): value is PortfolioRecord["mode"] {
  return value === "beginner" || value === "theme";
}

export function isValidPortfolioThemes(values: unknown): values is string[] {
  if (!Array.isArray(values) || values.length === 0 || values.length > 3) {
    return false;
  }
  return values.every(
    (item) => typeof item === "string" && /^[a-z][a-z0-9_]*$/.test(item),
  );
}

export function isValidPortfolioAmount(value: number): boolean {
  return Number.isInteger(value) && value >= 50_000;
}

export function isValidMarketWeeklyStatus(
  value: string,
): value is MarketWeeklyRecord["status"] {
  return ["queued", "gating", "done", "failed"].includes(value);
}

export function isValidMarketDailyStatus(
  value: string,
): value is MarketDailyRecord["status"] {
  return ["queued", "gating", "done", "failed"].includes(value);
}
