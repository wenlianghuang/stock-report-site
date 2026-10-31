import type { MarketCloseFacts, MarketCloseJob, MarketCloseRecord } from "@/lib/types";

export const SHARED_USER_ID = "shared";

export type SharedMarketCloseItem = {
  trade_date: string;
  summary?: MarketCloseFacts | null;
  facts?: MarketCloseFacts | null;
  markdown?: string | null;
  has_report?: boolean;
  ready?: boolean;
  shared?: boolean;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isTradeDateId(id: string): boolean {
  return DATE_RE.test(id);
}

function jobStatus(status: string): MarketCloseRecord["status"] {
  if (status === "done" || status === "failed" || status === "gating" || status === "queued") {
    return status;
  }
  if (status === "fetching") return "gating";
  return "gating";
}

export function briefItemToRecord(item: SharedMarketCloseItem): MarketCloseRecord {
  const hasReport = Boolean(item.has_report || item.markdown);
  return {
    id: item.trade_date,
    userId: SHARED_USER_ID,
    agentJobId: "canonical",
    status: hasReport ? "done" : "queued",
    tradeDate: item.trade_date,
    markdown: item.markdown ?? undefined,
    factsJson: item.facts ?? undefined,
    summaryJson: item.summary ?? undefined,
    createdAt: "",
    updatedAt: "",
  };
}

export function jobToRecord(job: MarketCloseJob): MarketCloseRecord {
  const tradeDate = job.trade_date ?? undefined;
  const id = job.status === "done" && tradeDate ? tradeDate : job.id;
  return {
    id,
    userId: SHARED_USER_ID,
    agentJobId: job.id,
    status: jobStatus(job.status),
    tradeDate,
    error: job.error ?? undefined,
    markdown: job.markdown ?? undefined,
    factsJson: job.facts ?? undefined,
    summaryJson: job.summary ?? undefined,
    createdAt: job.created_at ?? "",
    updatedAt: job.updated_at ?? "",
  };
}
