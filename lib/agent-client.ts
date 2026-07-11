import type { AgentJob } from "./types";

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
