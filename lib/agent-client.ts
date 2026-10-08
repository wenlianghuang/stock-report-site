import type {
  AgentJob,
  ChipFacts,
  HistoryDay,
  MarketDailyChatHistoryItem,
  MarketDailyJob,
  MarketWeeklyJob,
  PortfolioJob,
  PortfolioProfile,
  PortfolioResult,
} from "./types";

export type StockChart = {
  stockId: string;
  stockName?: string;
  tradeDate?: string;
  history: HistoryDay[];
  facts?: ChipFacts;
};

const DEFAULT_BASE_URL = "http://127.0.0.1:8765";

function baseUrl(): string {
  return process.env.ANTIGRAVITY_API_URL ?? DEFAULT_BASE_URL;
}

function agentHeaders(extra?: Record<string, string>): HeadersInit {
  const headers: Record<string, string> = { ...extra };
  if (baseUrl().includes("ngrok")) {
    headers["ngrok-skip-browser-warning"] = "true";
  }
  return headers;
}

type AgentJobResponse = {
  job: AgentJob;
};

type DigestItem = {
  stockId: string;
  stockName?: string;
  tradeDate?: string;
  markdown: string;
  positionMarkdown?: string;
};

type DigestResponse = {
  digest: { subject: string; main_detail_markdown: string };
};

type CreateAgentJobInput = {
  stockId: string;
  tradeDate?: string;
  isHolding?: boolean;
  shareCount?: number;
  avgCost?: number;
  usesMargin?: boolean;
  cashShareCount?: number;
  cashAvgCost?: number;
  marginShareCount?: number;
  marginAvgCost?: number;
};

type LastTradingDateResponse = {
  reference_date: string;
  trade_date: string;
  note: string | null;
};

export async function createAgentJob(
  input: CreateAgentJobInput | string,
  tradeDate?: string,
): Promise<AgentJob> {
  const params: CreateAgentJobInput =
    typeof input === "string" ? { stockId: input, tradeDate } : input;

  const body: {
    stock_id: string;
    skip_pdf: boolean;
    trade_date?: string;
    is_holding?: boolean;
    share_count?: number;
    avg_cost?: number;
    uses_margin?: boolean;
    cash_share_count?: number;
    cash_avg_cost?: number;
    margin_share_count?: number;
    margin_avg_cost?: number;
  } = {
    stock_id: params.stockId,
    skip_pdf: true,
  };
  if (params.tradeDate) {
    body.trade_date = params.tradeDate;
  }
  if (params.isHolding) {
    body.is_holding = true;
    if (params.shareCount !== undefined) {
      body.share_count = params.shareCount;
    }
    if (params.avgCost !== undefined) {
      body.avg_cost = params.avgCost;
    }
    if (params.usesMargin) {
      body.uses_margin = true;
    }
    if (params.cashShareCount !== undefined) {
      body.cash_share_count = params.cashShareCount;
    }
    if (params.cashAvgCost !== undefined) {
      body.cash_avg_cost = params.cashAvgCost;
    }
    if (params.marginShareCount !== undefined) {
      body.margin_share_count = params.marginShareCount;
    }
    if (params.marginAvgCost !== undefined) {
      body.margin_avg_cost = params.marginAvgCost;
    }
  }

  const response = await fetch(`${baseUrl()}/jobs`, {
    method: "POST",
    headers: agentHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Agent API error ${response.status}`);
  }

  const payload = (await response.json()) as AgentJobResponse;
  return payload.job;
}

export async function getAgentJob(jobId: string): Promise<AgentJob> {
  const response = await fetch(`${baseUrl()}/jobs/${jobId}`, {
    headers: agentHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Agent API error ${response.status}`);
  }

  const payload = (await response.json()) as AgentJobResponse;
  return payload.job;
}

export async function getLastTradingDate(): Promise<{
  referenceDate: string;
  tradeDate: string;
  note: string | null;
}> {
  const response = await fetch(`${baseUrl()}/last-trading-date`, {
    headers: agentHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Agent API error ${response.status}`);
  }

  const payload = (await response.json()) as LastTradingDateResponse;
  return {
    referenceDate: payload.reference_date,
    tradeDate: payload.trade_date,
    note: payload.note,
  };
}

export async function createDailyDigest(input: {
  digestDate: string;
  items: DigestItem[];
}): Promise<{ subject: string; mainDetailMarkdown: string }> {
  const response = await fetch(`${baseUrl()}/digest`, {
    method: "POST",
    headers: agentHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      digest_date: input.digestDate,
      items: input.items.map((item) => ({
        stock_id: item.stockId,
        stock_name: item.stockName ?? null,
        trade_date: item.tradeDate ?? null,
        markdown: item.markdown,
        position_markdown: item.positionMarkdown ?? null,
      })),
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Agent API error ${response.status}`);
  }

  const payload = (await response.json()) as DigestResponse;
  return {
    subject: payload.digest.subject,
    mainDetailMarkdown: payload.digest.main_detail_markdown,
  };
}

export async function createPortfolioJob(input: {
  mode?: "beginner" | "theme";
  profile?: PortfolioProfile | string;
  themes?: string[];
  amount: number;
  date?: string;
  force?: boolean;
}): Promise<PortfolioJob> {
  const mode = input.mode ?? "beginner";
  const body: {
    mode: string;
    amount: number;
    skip_pdf: boolean;
    profile?: string;
    themes?: string[];
    trade_date?: string;
    force?: boolean;
  } = {
    mode,
    amount: input.amount,
    skip_pdf: true,
  };
  if (mode === "theme") {
    body.themes = input.themes ?? [];
  } else {
    body.profile = String(input.profile ?? "");
  }
  if (input.date) {
    body.trade_date = input.date;
  }
  if (input.force) {
    body.force = true;
  }

  const response = await fetch(`${baseUrl()}/portfolio/jobs`, {
    method: "POST",
    headers: agentHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    let detail = "";
    try {
      const data = (await response.json()) as { detail?: string };
      detail = data.detail ?? "";
    } catch {
      detail = await response.text();
    }
    throw new Error(detail || `Agent API error ${response.status}`);
  }

  const payload = (await response.json()) as { job: PortfolioJob };
  return payload.job;
}

export async function getPortfolioJob(jobId: string): Promise<PortfolioJob> {
  const response = await fetch(`${baseUrl()}/portfolio/jobs/${jobId}`, {
    headers: agentHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    let detail = "";
    try {
      const data = (await response.json()) as { detail?: string };
      detail = data.detail ?? "";
    } catch {
      detail = await response.text();
    }
    throw new Error(detail || `Agent API error ${response.status}`);
  }

  const payload = (await response.json()) as { job: PortfolioJob };
  return payload.job;
}

export async function getPortfolio(input: {
  mode?: "beginner" | "theme";
  profile?: PortfolioProfile | string;
  themes?: string[];
  amount?: number;
  date?: string;
}): Promise<PortfolioResult> {
  const mode = input.mode ?? "beginner";
  const params = new URLSearchParams({ mode });
  if (mode === "theme") {
    params.set("themes", (input.themes ?? []).join(","));
  } else if (input.profile) {
    params.set("profile", String(input.profile));
  }
  if (input.amount !== undefined) {
    params.set("amount", String(input.amount));
  }
  if (input.date) {
    params.set("date", input.date);
  }

  const response = await fetch(`${baseUrl()}/portfolio?${params.toString()}`, {
    headers: agentHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    let detail = "";
    try {
      const data = (await response.json()) as { detail?: string };
      detail = data.detail ?? "";
    } catch {
      detail = await response.text();
    }
    throw new Error(detail || `Agent API error ${response.status}`);
  }

  const payload = (await response.json()) as { portfolio: PortfolioResult };
  return payload.portfolio;
}

export async function listPortfolioThemes(): Promise<
  Array<{ id: string; label: string; style: string; risk_hint: string }>
> {
  const response = await fetch(`${baseUrl()}/portfolio/themes`, {
    headers: agentHeaders(),
    cache: "no-store",
  });
  if (!response.ok) {
    return [];
  }
  const payload = (await response.json()) as {
    themes?: Array<{
      id: string;
      label: string;
      style: string;
      risk_hint: string;
    }>;
  };
  return payload.themes ?? [];
}

export type ConceptPeer = {
  stockId: string;
  stockName: string;
  assetClass?: string;
  sector?: string;
};

export type ConceptPeerGroup = {
  themeId: string;
  label: string;
  style?: string;
  riskHint?: string;
  peers: ConceptPeer[];
};

export type ConceptPeersResult = {
  stockId: string;
  stockName?: string;
  inUniverse: boolean;
  themes: Array<{ id: string; label: string; style?: string; riskHint?: string }>;
  groups: ConceptPeerGroup[];
};

export type ConceptCompareSide = {
  stockId?: string | null;
  stockName?: string | null;
  tradeDate?: string | null;
  close?: number | null;
  available: boolean;
  today_change_pct?: number | null;
  period_return_pct?: number | null;
  foreign_net_lots?: number | null;
  trust_net_lots?: number | null;
  dealer_net_lots?: number | null;
  major_net_lots?: number | null;
  volume_today_lots?: number | null;
  volume_ma_ratio?: number | null;
  close_vs_ma10_pct?: number | null;
  close_vs_ma20_pct?: number | null;
  ma20_position?: string | null;
  ma_stack?: string | null;
  institutional_consensus?: string | null;
  chip_regime?: string | null;
  rs_today?: string | null;
  rs_period?: string | null;
  price_trend?: string | null;
  rsi_14?: number | null;
};

export type ConceptCompareRow = {
  key: string;
  label: string;
  kind: "pct" | "lots" | "ratio" | "number" | "label" | string;
  base: string | number | null;
  peer: string | number | null;
  base_raw?: string | number | null;
  peer_raw?: string | number | null;
};

export type ConceptCompareResult = {
  tradeDate?: string | null;
  baseId: string;
  peerId: string;
  base: ConceptCompareSide;
  peer: ConceptCompareSide;
  rows: ConceptCompareRow[];
  highlights: string[];
  sharedThemes: Array<{ id: string; label: string }>;
  stance?: {
    label: "weaker" | "stronger" | "mixed" | "unknown" | string;
    base_weaker: boolean;
    reasons: string[];
  };
};

export type PeerGraphStep = {
  node: string;
  ok: boolean;
  detail: string;
};

export type PeerGraphJob = {
  id: string;
  stockId: string;
  peerId: string;
  status: string;
  tradeDate?: string | null;
  error?: string | null;
  notes: string[];
  steps: PeerGraphStep[];
  comparison?: {
    label?: string;
    base_weaker?: boolean;
    reasons?: string[];
    highlights?: string[];
    tradeDate?: string | null;
  } | null;
  baseWeaker: boolean;
  positionEntered: boolean;
  positionSkippedReason?: string | null;
  mdPath?: string | null;
  positionMdPath?: string | null;
  digestStatus: string;
  digestSubject?: string | null;
  digestBody?: string | null;
  digestPath?: string | null;
  interruptedBefore?: string | null;
};

export async function getConceptPeers(
  stockId: string,
): Promise<ConceptPeersResult> {
  const url = `${baseUrl()}/stocks/${encodeURIComponent(stockId)}/concept-peers`;
  const response = await fetch(url, {
    headers: agentHeaders(),
    cache: "no-store",
  });
  if (!response.ok) {
    let detail = "";
    try {
      const data = (await response.json()) as { detail?: string };
      detail = data.detail ?? "";
    } catch {
      detail = await response.text();
    }
    throw new Error(detail || `Agent API error ${response.status}`);
  }
  const payload = (await response.json()) as {
    stock_id: string;
    stock_name?: string | null;
    in_universe: boolean;
    themes?: Array<{
      id: string;
      label: string;
      style?: string;
      risk_hint?: string;
    }>;
    groups?: Array<{
      theme_id: string;
      label: string;
      style?: string;
      risk_hint?: string;
      peers: Array<{
        stock_id: string;
        stock_name: string;
        asset_class?: string;
        sector?: string;
      }>;
    }>;
  };
  return {
    stockId: payload.stock_id,
    stockName: payload.stock_name ?? undefined,
    inUniverse: Boolean(payload.in_universe),
    themes: (payload.themes ?? []).map((t) => ({
      id: t.id,
      label: t.label,
      style: t.style,
      riskHint: t.risk_hint,
    })),
    groups: (payload.groups ?? []).map((g) => ({
      themeId: g.theme_id,
      label: g.label,
      style: g.style,
      riskHint: g.risk_hint,
      peers: (g.peers ?? []).map((p) => ({
        stockId: p.stock_id,
        stockName: p.stock_name,
        assetClass: p.asset_class,
        sector: p.sector,
      })),
    })),
  };
}

export async function compareConceptStocks(
  stockId: string,
  peerId: string,
  tradeDate?: string,
): Promise<ConceptCompareResult> {
  const params = new URLSearchParams();
  if (tradeDate) {
    params.set("date", tradeDate);
  }
  const query = params.toString();
  const url = `${baseUrl()}/stocks/${encodeURIComponent(stockId)}/compare/${encodeURIComponent(peerId)}${
    query ? `?${query}` : ""
  }`;
  const response = await fetch(url, {
    headers: agentHeaders(),
    cache: "no-store",
  });
  if (!response.ok) {
    let detail = "";
    try {
      const data = (await response.json()) as { detail?: string };
      detail = data.detail ?? "";
    } catch {
      detail = await response.text();
    }
    throw new Error(detail || `Agent API error ${response.status}`);
  }
  const payload = (await response.json()) as {
    trade_date?: string | null;
    base_id: string;
    peer_id: string;
    base: Record<string, unknown>;
    peer: Record<string, unknown>;
    rows: ConceptCompareRow[];
    highlights: string[];
    shared_themes?: Array<{ id: string; label: string }>;
    stance?: {
      label: string;
      base_weaker: boolean;
      reasons: string[];
    };
  };

  const mapSide = (side: Record<string, unknown>): ConceptCompareSide => ({
    stockId: (side.stock_id as string | null | undefined) ?? null,
    stockName: (side.stock_name as string | null | undefined) ?? null,
    tradeDate: (side.trade_date as string | null | undefined) ?? null,
    close: (side.close as number | null | undefined) ?? null,
    available: Boolean(side.available),
    today_change_pct: side.today_change_pct as number | null | undefined,
    period_return_pct: side.period_return_pct as number | null | undefined,
    foreign_net_lots: side.foreign_net_lots as number | null | undefined,
    trust_net_lots: side.trust_net_lots as number | null | undefined,
    dealer_net_lots: side.dealer_net_lots as number | null | undefined,
    major_net_lots: side.major_net_lots as number | null | undefined,
    volume_today_lots: side.volume_today_lots as number | null | undefined,
    volume_ma_ratio: side.volume_ma_ratio as number | null | undefined,
    close_vs_ma10_pct: side.close_vs_ma10_pct as number | null | undefined,
    close_vs_ma20_pct: side.close_vs_ma20_pct as number | null | undefined,
    ma20_position: side.ma20_position as string | null | undefined,
    ma_stack: side.ma_stack as string | null | undefined,
    institutional_consensus:
      side.institutional_consensus as string | null | undefined,
    chip_regime: side.chip_regime as string | null | undefined,
    rs_today: side.rs_today as string | null | undefined,
    rs_period: side.rs_period as string | null | undefined,
    price_trend: side.price_trend as string | null | undefined,
    rsi_14: side.rsi_14 as number | null | undefined,
  });

  return {
    tradeDate: payload.trade_date,
    baseId: payload.base_id,
    peerId: payload.peer_id,
    base: mapSide(payload.base ?? {}),
    peer: mapSide(payload.peer ?? {}),
    rows: payload.rows ?? [],
    highlights: payload.highlights ?? [],
    sharedThemes: payload.shared_themes ?? [],
    stance: payload.stance,
  };
}

function mapPeerGraphJob(job: {
  id: string;
  stock_id: string;
  peer_id: string;
  status: string;
  trade_date?: string | null;
  error?: string | null;
  notes?: string[];
  steps?: PeerGraphStep[];
  comparison?: PeerGraphJob["comparison"];
  base_weaker?: boolean;
  position_entered?: boolean;
  position_skipped_reason?: string | null;
  md_path?: string | null;
  position_md_path?: string | null;
  digest_status?: string;
  digest_subject?: string | null;
  digest_body?: string | null;
  digest_path?: string | null;
  interrupted_before?: string | null;
}): PeerGraphJob {
  return {
    id: job.id,
    stockId: job.stock_id,
    peerId: job.peer_id,
    status: job.status,
    tradeDate: job.trade_date,
    error: job.error,
    notes: job.notes ?? [],
    steps: job.steps ?? [],
    comparison: job.comparison,
    baseWeaker: Boolean(job.base_weaker),
    positionEntered: Boolean(job.position_entered),
    positionSkippedReason: job.position_skipped_reason,
    mdPath: job.md_path,
    positionMdPath: job.position_md_path,
    digestStatus: job.digest_status ?? "not_applicable",
    digestSubject: job.digest_subject,
    digestBody: job.digest_body,
    digestPath: job.digest_path,
    interruptedBefore: job.interrupted_before,
  };
}

async function postPeerGraphSend(
  jobId: string,
  path: "send-claim" | "send-result",
  body?: { ok: boolean; error?: string },
): Promise<PeerGraphJob> {
  const response = await fetch(
    `${baseUrl()}/peer-graph/jobs/${encodeURIComponent(jobId)}/${path}`,
    {
      method: "POST",
      headers: agentHeaders(
        body ? { "Content-Type": "application/json" } : undefined,
      ),
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    },
  );
  if (!response.ok) {
    let detail = "";
    try {
      const data = (await response.json()) as { detail?: string };
      detail = data.detail ?? "";
    } catch {
      detail = await response.text();
    }
    throw new Error(detail || `Agent API error ${response.status}`);
  }
  const payload = (await response.json()) as { job: Parameters<typeof mapPeerGraphJob>[0] };
  return mapPeerGraphJob(payload.job);
}

export function claimPeerGraphSend(jobId: string): Promise<PeerGraphJob> {
  return postPeerGraphSend(jobId, "send-claim");
}

export function finishPeerGraphSend(
  jobId: string,
  ok: boolean,
  error?: string,
): Promise<PeerGraphJob> {
  return postPeerGraphSend(jobId, "send-result", { ok, error });
}

export async function createPeerGraphJob(input: {
  stockId: string;
  peerId: string;
  tradeDate?: string;
  fetch?: boolean;
  isHolding?: boolean;
  shareCount?: number;
  avgCost?: number;
}): Promise<PeerGraphJob> {
  const response = await fetch(`${baseUrl()}/peer-graph/jobs`, {
    method: "POST",
    headers: agentHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      stock_id: input.stockId,
      peer_id: input.peerId,
      trade_date: input.tradeDate,
      fetch: input.fetch ?? false,
      is_holding: Boolean(input.isHolding),
      share_count: input.shareCount,
      avg_cost: input.avgCost,
      skip_pdf: true,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    let detail = "";
    try {
      const data = (await response.json()) as { detail?: string };
      detail = data.detail ?? "";
    } catch {
      detail = await response.text();
    }
    throw new Error(detail || `Agent API error ${response.status}`);
  }
  const payload = (await response.json()) as { job: Parameters<typeof mapPeerGraphJob>[0] };
  return mapPeerGraphJob(payload.job);
}

export async function getPeerGraphJob(jobId: string): Promise<PeerGraphJob> {
  const response = await fetch(
    `${baseUrl()}/peer-graph/jobs/${encodeURIComponent(jobId)}`,
    { headers: agentHeaders(), cache: "no-store" },
  );
  if (!response.ok) {
    let detail = "";
    try {
      const data = (await response.json()) as { detail?: string };
      detail = data.detail ?? "";
    } catch {
      detail = await response.text();
    }
    throw new Error(detail || `Agent API error ${response.status}`);
  }
  const payload = (await response.json()) as { job: Parameters<typeof mapPeerGraphJob>[0] };
  return mapPeerGraphJob(payload.job);
}

export async function getStockChart(
  stockId: string,
  tradeDate?: string,
): Promise<StockChart | null> {
  const params = new URLSearchParams();
  if (tradeDate) {
    params.set("date", tradeDate);
  }
  const query = params.toString();
  const url = `${baseUrl()}/stocks/${encodeURIComponent(stockId)}/chart${
    query ? `?${query}` : ""
  }`;

  const response = await fetch(url, {
    headers: agentHeaders(),
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    let detail = "";
    try {
      const data = (await response.json()) as { detail?: string };
      detail = data.detail ?? "";
    } catch {
      detail = await response.text();
    }
    throw new Error(detail || `Agent API error ${response.status}`);
  }

  const payload = (await response.json()) as {
    stock_id: string;
    stock_name?: string | null;
    trade_date?: string | null;
    history_json?: HistoryDay[] | null;
    facts_json?: ChipFacts | null;
  };

  return {
    stockId: payload.stock_id,
    stockName: payload.stock_name ?? undefined,
    tradeDate: payload.trade_date ?? undefined,
    history: payload.history_json ?? [],
    facts: payload.facts_json ?? undefined,
  };
}

export async function checkAgentHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl()}/health`, {
      headers: agentHeaders(),
      cache: "no-store",
    });
    if (!response.ok) {
      return false;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return false;
    }

    const data = (await response.json()) as { status?: string };
    return data.status === "ok";
  } catch {
    return false;
  }
}

export async function resolveMarketWeekly(input?: {
  asOf?: string;
  weekEnd?: string;
}): Promise<{
  week_start: string;
  week_end: string;
  trading_days: string[];
  cutover_applied: boolean;
  resolved_as_of: string;
}> {
  const params = new URLSearchParams();
  if (input?.asOf) params.set("as_of", input.asOf);
  if (input?.weekEnd) params.set("week_end", input.weekEnd);
  const qs = params.toString();
  const response = await fetch(
    `${baseUrl()}/market-weekly/resolve${qs ? `?${qs}` : ""}`,
    { headers: agentHeaders(), cache: "no-store" },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Agent API error ${response.status}`);
  }
  const payload = (await response.json()) as {
    window: {
      week_start: string;
      week_end: string;
      trading_days: string[];
      cutover_applied: boolean;
      resolved_as_of: string;
    };
  };
  return payload.window;
}

export async function createMarketWeeklyJob(input?: {
  asOf?: string;
  weekEnd?: string;
  force?: boolean;
  skipFetch?: boolean;
  skipNews?: boolean;
}): Promise<MarketWeeklyJob> {
  const body: Record<string, unknown> = {};
  if (input?.asOf) body.as_of = input.asOf;
  if (input?.weekEnd) body.week_end = input.weekEnd;
  if (input?.force) body.force = true;
  if (input?.skipFetch) body.skip_fetch = true;
  if (input?.skipNews) body.skip_news = true;

  const response = await fetch(`${baseUrl()}/market-weekly/jobs`, {
    method: "POST",
    headers: agentHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    let detail = "";
    try {
      const data = (await response.json()) as { detail?: string };
      detail = data.detail ?? "";
    } catch {
      detail = await response.text();
    }
    throw new Error(detail || `Agent API error ${response.status}`);
  }
  const payload = (await response.json()) as { job: MarketWeeklyJob };
  return payload.job;
}

export async function getMarketWeeklyJob(
  jobId: string,
): Promise<MarketWeeklyJob> {
  const response = await fetch(`${baseUrl()}/market-weekly/jobs/${jobId}`, {
    headers: agentHeaders(),
    cache: "no-store",
  });
  if (!response.ok) {
    let detail = "";
    try {
      const data = (await response.json()) as { detail?: string };
      detail = data.detail ?? "";
    } catch {
      detail = await response.text();
    }
    throw new Error(detail || `Agent API error ${response.status}`);
  }
  const payload = (await response.json()) as { job: MarketWeeklyJob };
  return payload.job;
}

export type SharedMarketWeeklyItem = {
  week_end: string;
  week_start?: string | null;
  summary?: MarketWeeklyJob["summary"];
  facts?: MarketWeeklyJob["facts"];
  markdown?: string | null;
  has_report?: boolean;
  shared?: boolean;
};

export async function listMarketWeeklyBriefs(): Promise<{
  items: SharedMarketWeeklyItem[];
  shared: boolean;
}> {
  const response = await fetch(`${baseUrl()}/market-weekly`, {
    headers: agentHeaders(),
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Agent API error ${response.status}`);
  }
  const payload = (await response.json()) as {
    items?: SharedMarketWeeklyItem[];
    shared?: boolean;
  };
  return { items: payload.items ?? [], shared: payload.shared !== false };
}

export type SharedMarketDailyItem = {
  trade_date: string;
  for_session?: string | null;
  summary?: MarketDailyJob["summary"];
  facts?: MarketDailyJob["facts"];
  markdown?: string | null;
  has_report?: boolean;
  ready?: boolean;
  us_available?: boolean;
  shared?: boolean;
};

export async function listMarketDailyBriefs(): Promise<{
  items: SharedMarketDailyItem[];
  shared: boolean;
}> {
  const response = await fetch(`${baseUrl()}/market-daily`, {
    headers: agentHeaders(),
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Agent API error ${response.status}`);
  }
  const payload = (await response.json()) as {
    items?: SharedMarketDailyItem[];
    shared?: boolean;
  };
  return { items: payload.items ?? [], shared: payload.shared !== false };
}

export async function getMarketDailyCurrent(input?: {
  asOf?: string;
  tradeDate?: string;
}): Promise<{
  window: Awaited<ReturnType<typeof resolveMarketDaily>>;
  ready: boolean;
  shared: boolean;
  brief: SharedMarketDailyItem;
}> {
  const params = new URLSearchParams();
  if (input?.asOf) params.set("as_of", input.asOf);
  if (input?.tradeDate) params.set("trade_date", input.tradeDate);
  const qs = params.toString();
  const response = await fetch(
    `${baseUrl()}/market-daily/current${qs ? `?${qs}` : ""}`,
    { headers: agentHeaders(), cache: "no-store" },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Agent API error ${response.status}`);
  }
  return (await response.json()) as {
    window: Awaited<ReturnType<typeof resolveMarketDaily>>;
    ready: boolean;
    shared: boolean;
    brief: SharedMarketDailyItem;
  };
}

export async function resolveMarketDaily(input?: {
  asOf?: string;
  tradeDate?: string;
}): Promise<{
  trade_date: string;
  for_session: string;
  prior_trade_date: string | null;
  lookback_days: string[];
  cutover_applied: boolean;
  resolved_as_of: string;
  us_as_of: string;
  us_cutover_passed: boolean;
}> {
  const params = new URLSearchParams();
  if (input?.asOf) params.set("as_of", input.asOf);
  if (input?.tradeDate) params.set("trade_date", input.tradeDate);
  const qs = params.toString();
  const response = await fetch(
    `${baseUrl()}/market-daily/resolve${qs ? `?${qs}` : ""}`,
    { headers: agentHeaders(), cache: "no-store" },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Agent API error ${response.status}`);
  }
  const payload = (await response.json()) as {
    window: {
      trade_date: string;
      for_session: string;
      prior_trade_date: string | null;
      lookback_days: string[];
      cutover_applied: boolean;
      resolved_as_of: string;
      us_as_of: string;
      us_cutover_passed: boolean;
    };
  };
  return payload.window;
}

export async function createMarketDailyJob(input?: {
  asOf?: string;
  tradeDate?: string;
  force?: boolean;
  skipFetch?: boolean;
  skipUs?: boolean;
}): Promise<MarketDailyJob> {
  const body: Record<string, unknown> = {};
  if (input?.asOf) body.as_of = input.asOf;
  if (input?.tradeDate) body.trade_date = input.tradeDate;
  if (input?.force) body.force = true;
  if (input?.skipFetch) body.skip_fetch = true;
  if (input?.skipUs) body.skip_us = true;

  const response = await fetch(`${baseUrl()}/market-daily/jobs`, {
    method: "POST",
    headers: agentHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    let detail = "";
    try {
      const data = (await response.json()) as { detail?: string };
      detail = data.detail ?? "";
    } catch {
      detail = await response.text();
    }
    throw new Error(detail || `Agent API error ${response.status}`);
  }
  const payload = (await response.json()) as { job: MarketDailyJob };
  return payload.job;
}

export async function getMarketDailyJob(
  jobId: string,
): Promise<MarketDailyJob> {
  const response = await fetch(`${baseUrl()}/market-daily/jobs/${jobId}`, {
    headers: agentHeaders(),
    cache: "no-store",
  });
  if (!response.ok) {
    let detail = "";
    try {
      const data = (await response.json()) as { detail?: string };
      detail = data.detail ?? "";
    } catch {
      detail = await response.text();
    }
    throw new Error(detail || `Agent API error ${response.status}`);
  }
  const payload = (await response.json()) as { job: MarketDailyJob };
  return payload.job;
}

export type MarketDailyChatStreamInput = {
  message: string;
  tradeDate?: string | null;
  facts?: Record<string, unknown> | null;
  summary?: Record<string, unknown> | null;
  markdown?: string | null;
  hasHoldings?: boolean;
  holdings?: Array<{
    stock_id: string;
    share_count: number;
    avg_cost: number;
    uses_margin?: boolean;
    cash_share_count?: number | null;
    cash_avg_cost?: number | null;
    margin_share_count?: number | null;
    margin_avg_cost?: number | null;
  }>;
  history?: MarketDailyChatHistoryItem[];
  useLlm?: boolean;
  skipTavily?: boolean;
};

export async function chatMarketDailyStream(
  input: MarketDailyChatStreamInput,
): Promise<Response> {
  const body: Record<string, unknown> = {
    message: input.message,
    has_holdings: Boolean(input.hasHoldings),
    use_llm: input.useLlm !== false,
    skip_tavily: Boolean(input.skipTavily),
  };
  if (input.tradeDate) body.trade_date = input.tradeDate;
  if (input.facts) body.facts = input.facts;
  if (input.summary) body.summary = input.summary;
  if (input.markdown) body.markdown = input.markdown;
  if (input.holdings?.length) body.holdings = input.holdings;
  if (input.history?.length) body.history = input.history;

  const response = await fetch(`${baseUrl()}/market-daily/chat/stream`, {
    method: "POST",
    headers: agentHeaders({
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    }),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return response;
}

export type StockReportChatHistoryItem = {
  role: "user" | "assistant";
  content: string;
};

export type StockReportChatStreamInput = {
  stockId: string;
  message: string;
  tradeDate?: string | null;
  facts?: Record<string, unknown> | null;
  summary?: Record<string, unknown> | null;
  markdown?: string | null;
  positionFacts?: Record<string, unknown> | null;
  positionMarkdown?: string | null;
  holdings?: Array<Record<string, unknown>>;
  history?: StockReportChatHistoryItem[];
  useLlm?: boolean;
};

export async function chatStockReportStream(
  input: StockReportChatStreamInput,
): Promise<Response> {
  const body: Record<string, unknown> = {
    message: input.message,
    stock_id: input.stockId,
    use_llm: input.useLlm !== false,
  };
  if (input.tradeDate) body.trade_date = input.tradeDate;
  if (input.facts) body.facts = input.facts;
  if (input.summary) body.summary = input.summary;
  if (input.markdown) body.markdown = input.markdown;
  if (input.positionFacts) body.position_facts = input.positionFacts;
  if (input.positionMarkdown) body.position_markdown = input.positionMarkdown;
  if (input.holdings?.length) body.holdings = input.holdings;
  if (input.history?.length) body.history = input.history;

  const response = await fetch(
    `${baseUrl()}/stock/${encodeURIComponent(input.stockId)}/chat/stream`,
    {
      method: "POST",
      headers: agentHeaders({
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      }),
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );
  return response;
}

