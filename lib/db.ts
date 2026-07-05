import { createClient } from "@/lib/supabase/server";
import type { ReportRecord, ReportRow } from "./types";
import { rowToReport } from "./types";

export async function createReport(input: {
  userId: string;
  stockId: string;
  agentJobId: string;
}): Promise<ReportRecord> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .insert({
      user_id: input.userId,
      stock_id: input.stockId,
      agent_job_id: input.agentJobId,
      status: "queued",
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
    Pick<ReportRecord, "status" | "tradeDate" | "error" | "markdown">
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

export function isValidReportStatus(value: string): value is ReportRecord["status"] {
  return ["queued", "fetching", "gating", "done", "failed"].includes(value);
}
