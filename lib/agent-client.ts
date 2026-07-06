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

export async function createAgentJob(stockId: string): Promise<AgentJob> {
  const response = await fetch(`${baseUrl()}/jobs`, {
    method: "POST",
    headers: agentHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ stock_id: stockId, skip_pdf: true }),
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
