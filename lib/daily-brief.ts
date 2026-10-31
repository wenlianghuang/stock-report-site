export type DailyBrief = "open" | "close";

export function parseDailyBrief(raw: string | null): DailyBrief {
  return raw === "close" ? "close" : "open";
}
