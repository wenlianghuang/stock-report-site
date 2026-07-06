export type ReportStatus =
  | "queued"
  | "fetching"
  | "gating"
  | "done"
  | "failed";

export type ReportRecord = {
  id: string;
  userId: string;
  stockId: string;
  agentJobId: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
  tradeDate?: string;
  error?: string;
  markdown?: string;
};

export type ReportRow = {
  id: string;
  user_id: string;
  stock_id: string;
  agent_job_id: string;
  status: ReportStatus;
  trade_date: string | null;
  error: string | null;
  markdown: string | null;
  created_at: string;
  updated_at: string;
};

export type AgentJob = {
  id: string;
  stock_id: string;
  status: ReportStatus;
  created_at: string;
  updated_at: string;
  requested_trade_date?: string | null;
  trade_date?: string | null;
  error?: string | null;
  markdown?: string | null;
  md_path?: string | null;
  csv_path?: string | null;
};

export function rowToReport(row: ReportRow): ReportRecord {
  return {
    id: row.id,
    userId: row.user_id,
    stockId: row.stock_id,
    agentJobId: row.agent_job_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tradeDate: row.trade_date ?? undefined,
    error: row.error ?? undefined,
    markdown: row.markdown ?? undefined,
  };
}
