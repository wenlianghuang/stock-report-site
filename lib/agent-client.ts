import type {
  AgentJob,
  ChipFacts,
  HistoryDay,
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
