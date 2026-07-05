import type { AgentJob } from "./types";

const DEFAULT_BASE_URL = "http://127.0.0.1:8765";

function baseUrl(): string {
  return process.env.ANTIGRAVITY_API_URL ?? DEFAULT_BASE_URL;
}

type AgentJobResponse = {
  job: AgentJob;
};

export async function createAgentJob(stockId: string): Promise<AgentJob> {
  const response = await fetch(`${baseUrl()}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
    const response = await fetch(`${baseUrl()}/health`, { cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}
