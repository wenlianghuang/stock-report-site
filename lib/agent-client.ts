import type {
  AgentJob,
  ChipFacts,
  HistoryDay,
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
