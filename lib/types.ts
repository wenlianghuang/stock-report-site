export type ReportStatus =
  | "queued"
  | "fetching"
  | "gating"
  | "positioning"
  | "done"
  | "failed";

export type ReportRecord = {
  id: string;
  userId: string;
  stockId: string;
  stockName?: string;
  agentJobId: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
  tradeDate?: string;
  error?: string;
  markdown?: string;
  isHolding: boolean;
  shareCount?: number;
  avgCost?: number;
  positionMarkdown?: string;
};

export type ReportRow = {
  id: string;
  user_id: string;
  stock_id: string;
  stock_name: string | null;
  agent_job_id: string;
  status: ReportStatus;
  trade_date: string | null;
  error: string | null;
  markdown: string | null;
  is_holding: boolean;
  share_count: number | null;
  avg_cost: number | null;
  position_markdown: string | null;
  created_at: string;
  updated_at: string;
};

export type AgentJob = {
  id: string;
  stock_id: string;
  stock_name?: string | null;
  status: ReportStatus;
  created_at: string;
  updated_at: string;
  requested_trade_date?: string | null;
  trade_date?: string | null;
  error?: string | null;
  markdown?: string | null;
  position_markdown?: string | null;
  md_path?: string | null;
  csv_path?: string | null;
  is_holding?: boolean;
  share_count?: number | null;
  avg_cost?: number | null;
};

export type HoldingRecord = {
  id: string;
  userId: string;
  stockId: string;
  shareCount: number;
  avgCost: number;
  createdAt: string;
  updatedAt: string;
};

export type HoldingRow = {
  id: string;
  user_id: string;
  stock_id: string;
  share_count: number;
  avg_cost: number;
  created_at: string;
  updated_at: string;
};

export function rowToReport(row: ReportRow): ReportRecord {
  return {
    id: row.id,
    userId: row.user_id,
    stockId: row.stock_id,
    stockName: row.stock_name ?? undefined,
    agentJobId: row.agent_job_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tradeDate: row.trade_date ?? undefined,
    error: row.error ?? undefined,
    markdown: row.markdown ?? undefined,
    isHolding: row.is_holding,
    shareCount: row.share_count ?? undefined,
    avgCost: row.avg_cost ?? undefined,
    positionMarkdown: row.position_markdown ?? undefined,
  };
}

export function rowToHolding(row: HoldingRow): HoldingRecord {
  return {
    id: row.id,
    userId: row.user_id,
    stockId: row.stock_id,
    shareCount: row.share_count,
    avgCost: Number(row.avg_cost),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
