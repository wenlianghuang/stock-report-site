import { createClient } from "@/lib/supabase/server";
import type { ReportRecord, ReportRow } from "./types";
import { rowToReport } from "./types";

export async function createReport(input: {
  userId: string;
  stockId: string;
  agentJobId: string;
  tradeDate?: string;
  isHolding?: boolean;
  shareCount?: number;
  avgCost?: number;
}): Promise<ReportRecord> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .insert({
      user_id: input.userId,
      stock_id: input.stockId,
      agent_job_id: input.agentJobId,
      status: "queued",
      is_holding: input.isHolding ?? false,
      ...(input.tradeDate ? { trade_date: input.tradeDate } : {}),
      ...(input.isHolding && input.shareCount !== undefined
        ? { share_count: input.shareCount }
        : {}),
      ...(input.isHolding && input.avgCost !== undefined
        ? { avg_cost: input.avgCost }
        : {}),
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "無法建立報告紀錄");
  }

  return rowToReport(data as ReportRow);
}

export async function updateReport(
  id: string,
  patch: Partial<
    Pick<
      ReportRecord,
      "status" | "tradeDate" | "error" | "markdown" | "positionMarkdown"
    >
  >,
): Promise<ReportRecord | undefined> {
  const supabase = await createClient();
  const payload: Record<string, string | null | undefined> = {};

  if (patch.status !== undefined) {
    payload.status = patch.status;
  }
  if (patch.tradeDate !== undefined) {
    payload.trade_date = patch.tradeDate;
  }
  if (patch.error !== undefined) {
    payload.error = patch.error;
  }
  if (patch.markdown !== undefined) {
    payload.markdown = patch.markdown;
  }
  if (patch.positionMarkdown !== undefined) {
    payload.position_markdown = patch.positionMarkdown;
  }

  const { data, error } = await supabase
    .from("reports")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    return undefined;
  }

  return rowToReport(data as ReportRow);
}

export async function findReportById(id: string): Promise<ReportRecord | undefined> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return undefined;
  }

  return rowToReport(data as ReportRow);
}

export async function deleteReport(
  id: string,
  userId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reports")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  return !error;
}

export async function listReportsForUser(userId: string): Promise<ReportRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return (data as ReportRow[]).map(rowToReport);
}

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
