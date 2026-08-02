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

export type PositionLegSummary = {
  shares?: number;
  avg_cost?: number;
  unrealized_pnl_pct?: number | null;
  pnl_bucket?: string;
  pnl_bucket_label?: string;
  position_bias?: string;
  position_bias_label?: string;
  uses_margin?: boolean;
  maintenance_rate_pct?: number | null;
  distance_to_call_pp?: number | null;
  margin_call_price?: number | null;
  distance_to_call_price_pct?: number | null;
  margin_pressure_zone?: string;
  margin_pressure_label?: string;
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
  uses_margin?: boolean;
  maintenance_rate_pct?: number | null;
  distance_to_call_pp?: number | null;
  margin_call_price?: number | null;
  distance_to_call_price_pct?: number | null;
  margin_pressure_zone?: string;
  margin_pressure_label?: string;
  priority?: string;
  priority_label?: string;
  synthesis_hint?: string;
  cash?: PositionLegSummary | null;
  margin?: PositionLegSummary | null;
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
  usesMargin?: boolean;
  cashShareCount?: number;
  cashAvgCost?: number;
  marginShareCount?: number;
  marginAvgCost?: number;
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
  uses_margin?: boolean;
  cash_share_count?: number | null;
  cash_avg_cost?: number | null;
  margin_share_count?: number | null;
  margin_avg_cost?: number | null;
  position_markdown: string | null;
  facts_json: ChipFacts | null;
  history_json: HistoryDay[] | null;
  summary_json: ReportSummaryJson | null;
  created_at: string;
  updated_at: string;
};

export type PortfolioProfile = "conservative" | "balanced" | "aggressive";

export type PortfolioMode = "beginner" | "theme";

export type PortfolioThemeId = "financials" | "thermal" | "ai" | string;

export type PortfolioThemeMeta = {
  id: string;
  label: string;
  style: string;
  risk_hint: string;
};

export type PortfolioHolding = {
  stock_id: string;
  name: string;
  asset_class: string;
  category: string;
  sector: string;
  sector_label?: string;
  role: "core" | "satellite" | "theme";
  weight_pct: number;
  score: number;
  close_price?: number | null;
  allocation_twd?: number | null;
  est_shares?: number | null;
  rationale_tags: string[];
  chip_summary?: string;
  themes?: string[];
};

export type PortfolioExcluded = {
  stock_id: string;
  name: string;
  reason: string;
};

export type PortfolioFacts = {
  profile: string;
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
  mode?: PortfolioMode;
  themes?: string[];
  theme_labels?: string[];
};

export type PortfolioResult = {
  facts: PortfolioFacts;
  narrative: string | null;
  has_narrative: boolean;
  generated_via: "agy" | "rules";
  artifact_key?: string;
};

export type PortfolioJobStatus =
  | "queued"
  | "fetching"
  | "gating"
  | "positioning"
  | "done"
  | "failed";

export type PortfolioRecord = {
  id: string;
  userId: string;
  agentJobId: string;
  status: PortfolioJobStatus;
  mode: PortfolioMode;
  profile: string;
  themes: string[];
  amount: number;
  tradeDate?: string;
  error?: string;
  narrative?: string;
  factsJson?: PortfolioFacts;
  generatedVia?: "agy" | "rules";
  createdAt: string;
  updatedAt: string;
};

export type PortfolioRow = {
  id: string;
  user_id: string;
  agent_job_id: string;
  status: PortfolioJobStatus;
  mode: PortfolioMode | null;
  profile: string;
  themes: string[] | null;
  amount: number;
  trade_date: string | null;
  error: string | null;
  narrative: string | null;
  facts_json: PortfolioFacts | null;
  generated_via: "agy" | "rules" | null;
  created_at: string;
  updated_at: string;
};

export type PortfolioJob = {
  id: string;
  profile: string;
  status: PortfolioJobStatus;
  created_at: string;
  updated_at: string;
  amount?: number | null;
  requested_trade_date?: string | null;
  trade_date?: string | null;
  error?: string | null;
  portfolio?: PortfolioResult | null;
  skip_pdf?: boolean;
  mode?: PortfolioMode;
  themes?: string[];
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
  uses_margin?: boolean;
  cash_share_count?: number | null;
  cash_avg_cost?: number | null;
  margin_share_count?: number | null;
  margin_avg_cost?: number | null;
};

export type HoldingRecord = {
  id: string;
  userId: string;
  stockId: string;
  shareCount: number;
  avgCost: number;
  usesMargin: boolean;
  cashShareCount?: number;
  cashAvgCost?: number;
  marginShareCount?: number;
  marginAvgCost?: number;
  createdAt: string;
  updatedAt: string;
};

export type HoldingRow = {
  id: string;
  user_id: string;
  stock_id: string;
  share_count: number;
  avg_cost: number;
  uses_margin?: boolean;
  cash_share_count?: number | null;
  cash_avg_cost?: number | null;
  margin_share_count?: number | null;
  margin_avg_cost?: number | null;
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
    usesMargin: row.uses_margin ?? false,
    cashShareCount: row.cash_share_count ?? undefined,
    cashAvgCost:
      row.cash_avg_cost != null ? Number(row.cash_avg_cost) : undefined,
    marginShareCount: row.margin_share_count ?? undefined,
    marginAvgCost:
      row.margin_avg_cost != null ? Number(row.margin_avg_cost) : undefined,
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
    usesMargin: row.uses_margin ?? false,
    cashShareCount: row.cash_share_count ?? undefined,
    cashAvgCost:
      row.cash_avg_cost != null ? Number(row.cash_avg_cost) : undefined,
    marginShareCount: row.margin_share_count ?? undefined,
    marginAvgCost:
      row.margin_avg_cost != null ? Number(row.margin_avg_cost) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToPortfolio(row: PortfolioRow): PortfolioRecord {
  const themes = Array.isArray(row.themes)
    ? row.themes.map((item) => String(item))
    : [];
  return {
    id: row.id,
    userId: row.user_id,
    agentJobId: row.agent_job_id,
    status: row.status,
    mode: row.mode === "theme" ? "theme" : "beginner",
    profile: row.profile,
    themes,
    amount: row.amount,
    tradeDate: row.trade_date ?? undefined,
    error: row.error ?? undefined,
    narrative: row.narrative ?? undefined,
    factsJson: row.facts_json ?? undefined,
    generatedVia: row.generated_via ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function portfolioRecordToResult(
  record: PortfolioRecord,
): PortfolioResult | null {
  if (!record.factsJson) {
    return null;
  }
  return {
    facts: record.factsJson,
    narrative: record.narrative ?? null,
    has_narrative: Boolean(record.narrative),
    generated_via: record.generatedVia ?? "rules",
  };
}

export type MarketWeekLeader = {
  stock_id: string;
  name: string;
  week_return_pct?: number;
  excess_vs_taiex_pct?: number | null;
  contribution_score?: number | null;
};

export type MarketWeekSector = {
  index_id?: string;
  name: string;
  week_return_pct?: number;
  excess_vs_taiex_pct?: number | null;
};

export type MarketWeekNewsItem = {
  title: string;
  stock_id?: string | null;
  name?: string | null;
  related_sector?: string | null;
  date?: string | null;
  publisher?: string | null;
};

export type MarketWeekFacts = {
  week_start: string;
  week_end: string;
  trading_days: string[];
  resolved_as_of?: string;
  cutover_applied?: boolean;
  market?: {
    week_return_pct?: number | null;
    last_close?: number | null;
    close_in_week_range_pct?: number | null;
  };
  leaders?: {
    top?: MarketWeekLeader[];
    bottom?: MarketWeekLeader[];
  };
  sectors?: {
    universe?: string;
    strong?: MarketWeekSector[];
    weak?: MarketWeekSector[];
  };
  anchors?: string[];
  news_titles?: string[];
  news_items?: MarketWeekNewsItem[];
};

export type MarketWeekSummary = {
  version?: number;
  kind?: string;
  week_start?: string;
  week_end?: string;
  market?: {
    week_return_pct?: number | null;
    tone?: string;
    last_close?: number | null;
    headline?: string;
  };
  leaders?: {
    top?: MarketWeekLeader[];
    bottom?: MarketWeekLeader[];
  };
  sectors?: {
    strong?: MarketWeekSector[];
    weak?: MarketWeekSector[];
  };
  scenarios?: string;
  cross?: string;
  watch?: string;
  anchors?: string[];
  news_titles?: string[];
  news_items?: MarketWeekNewsItem[];
};

export type MarketWeeklyJob = {
  id: string;
  status: string;
  week_start?: string | null;
  week_end?: string | null;
  as_of?: string | null;
  error?: string | null;
  facts?: MarketWeekFacts | null;
  summary?: MarketWeekSummary | null;
  markdown?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type MarketWeeklyRecord = {
  id: string;
  userId: string;
  agentJobId: string;
  status: "queued" | "gating" | "done" | "failed";
  weekStart?: string;
  weekEnd?: string;
  error?: string;
  markdown?: string;
  factsJson?: MarketWeekFacts;
  summaryJson?: MarketWeekSummary;
  createdAt: string;
  updatedAt: string;
};

export type MarketWeeklyRow = {
  id: string;
  user_id: string;
  agent_job_id: string;
  status: MarketWeeklyRecord["status"];
  week_start: string | null;
  week_end: string | null;
  error: string | null;
  markdown: string | null;
  facts_json: MarketWeekFacts | null;
  summary_json: MarketWeekSummary | null;
  created_at: string;
  updated_at: string;
};

export function rowToMarketWeekly(row: MarketWeeklyRow): MarketWeeklyRecord {
  return {
    id: row.id,
    userId: row.user_id,
    agentJobId: row.agent_job_id,
    status: row.status,
    weekStart: row.week_start ?? undefined,
    weekEnd: row.week_end ?? undefined,
    error: row.error ?? undefined,
    markdown: row.markdown ?? undefined,
    factsJson: row.facts_json ?? undefined,
    summaryJson: row.summary_json ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
