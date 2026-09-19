export function formatLots(
  value?: number | null,
  { signed = false }: { signed?: boolean } = {},
): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  const prefix = signed && value > 0 ? "+" : "";
  return `${prefix}${value.toLocaleString("zh-TW")} 張`;
}

export function formatPct(
  value?: number | null,
  { signed = false, digits = 2 }: { signed?: boolean; digits?: number } = {},
): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  const prefix = signed && value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(digits)}%`;
}

export function formatPrice(value?: number | null, digits = 2): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return value.toLocaleString("zh-TW", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : digits,
    maximumFractionDigits: digits,
  });
}

export function formatShares(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return `${value.toLocaleString("zh-TW")} 股`;
}

export function maPositionLabel(position?: string): string {
  switch (position) {
    case "above":
      return "站上";
    case "below":
      return "跌破";
    case "at":
      return "貼近";
    default:
      return "";
  }
}
