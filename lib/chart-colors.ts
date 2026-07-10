/** Taiwan market convention: 漲紅跌綠 */
export const CHART_COLORS = {
  up: "#ef4444",
  down: "#22c55e",
  ma5: "#9333ea",
  ma10: "#f59e0b",
  ma20: "#3b82f6",
  avgCost: "#10b981",
  grid: "#e4e4e7",
} as const;

export function candleColor(isUp: boolean): string {
  return isUp ? CHART_COLORS.up : CHART_COLORS.down;
}
