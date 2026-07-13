export type SummaryTone = "bullish" | "bearish" | "neutral" | "info";

export type SignalMatrixRow = {
  category: "technical" | "chip" | "market";
  label: string;
  value: string;
  tone: SummaryTone;
};

export type SummaryNewsItem = {
  date: string;
  title: string;
  category: string;
  summary: string;
};

export type SummaryScenario = {
  title?: string;
  content: string;
};

export type InstitutionalFlowDay = {
  date: string;
  foreign?: number;
  trust?: number;
  dealer?: number;
  major?: number | null;
};

export type MarketSummary = {
  version: number;
  stock_id: string;
  stock_name: string;
  trade_date: string;
  signal_matrix: SignalMatrixRow[];
  key_metrics: {
    close?: number;
    today_change_pct?: number;
    period_return_pct?: number;
    foreign_net_lots?: number;
    trust_net_lots?: number;
    dealer_net_lots?: number;
    major_net_lots?: number;
    volume_today_lots?: number;
    market_change_pct?: number;
  };
  institutional_flow: InstitutionalFlowDay[];
  news: SummaryNewsItem[];
  narrative: {
    today_chip?: string | null;
    trend?: string | null;
    cross_points: string[];
    scenarios: SummaryScenario[];
    watch_items: string[];
  };
  anchors: string[];
};

export type PositionScenarioPlan = {
  rank: string;
  label: string;
  weight_pct: number;
  action: string;
  trigger_hint: string;
};

export type PositionSummary = {
  version: number;
  unrealized_pnl_pct?: number | null;
  pnl_bucket?: string;
  pnl_bucket_label?: string;
  position_bias?: string;
  position_bias_label?: string;
  avg_cost?: number;
  shares?: number;
  scenario_plan: PositionScenarioPlan[];
  narrative: {
    position_status?: string | null;
    market_summary?: string | null;
    cross_points: string[];
    scenarios: SummaryScenario[];
    risk_items: string[];
  };
  anchors: string[];
};

export type ReportSummaryJson = {
  market: MarketSummary;
  position?: PositionSummary;
};

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
  rsi_14?: number | null;
  rsi_zone?: string;
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
  summaryJson?: ReportSummaryJson;
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
  summary_json: ReportSummaryJson | null;
  created_at: string;
  updated_at: string;
};

export type PortfolioProfile = "conservative" | "balanced" | "aggressive";

export type PortfolioHolding = {
  stock_id: string;
  name: string;
  asset_class: string;
  category: string;
  sector: string;
  sector_label?: string;
  role: "core" | "satellite";
  weight_pct: number;
  score: number;
  close_price?: number | null;
  allocation_twd?: number | null;
  est_shares?: number | null;
  rationale_tags: string[];
  chip_summary?: string;
};

export type PortfolioExcluded = {
  stock_id: string;
  name: string;
  reason: string;
};

export type PortfolioFacts = {
  profile: PortfolioProfile;
  profile_label: string;
  risk_label: string;
  trade_date?: string;
  holdings: PortfolioHolding[];
  num_holdings: number;
  max_single_weight: number;
  etf_weight_pct: number;
  top_sector?: string;
  top_sector_label?: string;
  top_sector_weight_pct: number;
  expected_volatility_level: string;
  diversification_ok: boolean;
  amount_twd?: number | null;
  warnings: string[];
  excluded: PortfolioExcluded[];
  anchors: string[];
};

export type PortfolioResult = {
  facts: PortfolioFacts;
  narrative: string | null;
  has_narrative: boolean;
  generated_via: "agy" | "rules";
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
  summary_json?: ReportSummaryJson | null;
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
    summaryJson: row.summary_json ?? undefined,
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
