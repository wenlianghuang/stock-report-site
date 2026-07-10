export type ReportStatus =
  | "queued"
  | "fetching"
  | "gating"
  | "positioning"
  | "done"
  | "failed";

export type ChipFacts = {
  stock_id?: string;
  stock_name?: string;
  trade_date?: string;
  close?: number | null;
  ma5?: number | null;
  ma10?: number | null;
  ma20?: number | null;
  close_vs_ma20_pct?: number | null;
  period_return_pct?: number | null;
  price_trend?: string;
  ma5_position?: string;
  ma10_position?: string;
  ma20_position?: string;
  ma_alignment?: string;
  ma_short_alignment?: string;
  ma_mid_alignment?: string;
  ma_stack?: string;
  ma20_slope?: string;
  ma20_slope_pct?: number | null;
  institutional_consensus?: string;
  chip_regime?: string;
  volume_anomaly?: string;
  rs_today?: string;
  rs_period?: string;
  market_trend?: string;
  divergences?: string[];
  anchors?: string[];
};

export type HistoryDay = {
  date: string;
  close: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  change_pct?: number;
};

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
  factsJson?: ChipFacts;
  historyJson?: HistoryDay[];
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
  facts_json: ChipFacts | null;
  history_json: HistoryDay[] | null;
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
  facts_json?: ChipFacts | null;
  history_json?: HistoryDay[] | null;
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
    factsJson: row.facts_json ?? undefined,
    historyJson: row.history_json ?? undefined,
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
