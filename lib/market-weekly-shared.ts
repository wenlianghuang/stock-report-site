import type {
  MarketWeekFacts,
  MarketWeekSummary,
  MarketWeeklyJob,
  MarketWeeklyRecord,
} from "@/lib/types";

export const SHARED_USER_ID = "shared";

export type SharedMarketWeeklyItem = {
  week_end: string;
  week_start?: string | null;
  summary?: MarketWeekSummary | null;
  facts?: MarketWeekFacts | null;
  markdown?: string | null;
  has_report?: boolean;
  shared?: boolean;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isWeekEndId(id: string): boolean {
  return DATE_RE.test(id);
}

function jobStatus(status: string): MarketWeeklyRecord["status"] {
  if (status === "done" || status === "failed" || status === "gating" || status === "queued") {
    return status;
  }
  if (status === "fetching") return "gating";
  return "gating";
}

export function briefItemToRecord(item: SharedMarketWeeklyItem): MarketWeeklyRecord {
  const hasReport = Boolean(item.has_report || item.markdown);
  const weekStart =
    item.week_start ?? item.facts?.week_start ?? item.summary?.week_start ?? undefined;
  return {
    id: item.week_end,
    userId: SHARED_USER_ID,
    agentJobId: "canonical",
    status: hasReport ? "done" : "queued",
    weekStart,
    weekEnd: item.week_end,
    markdown: item.markdown ?? undefined,
    factsJson: item.facts ?? undefined,
    summaryJson: item.summary ?? undefined,
    createdAt: "",
    updatedAt: "",
  };
}

export function jobToRecord(job: MarketWeeklyJob): MarketWeeklyRecord {
  const weekEnd = job.week_end ?? undefined;
  const id = job.status === "done" && weekEnd ? weekEnd : job.id;
  return {
    id,
    userId: SHARED_USER_ID,
    agentJobId: job.id,
    status: jobStatus(job.status),
    weekStart: job.week_start ?? undefined,
    weekEnd,
    error: job.error ?? undefined,
    markdown: job.markdown ?? undefined,
    factsJson: job.facts ?? undefined,
    summaryJson: job.summary ?? undefined,
    createdAt: job.created_at ?? "",
    updatedAt: job.updated_at ?? "",
  };
}
