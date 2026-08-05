import { createClient } from "@/lib/supabase/server";
import type {
  ChipFacts,
  HistoryDay,
  HoldingRecord,
  HoldingRow,
  MarketDayFacts,
  MarketDaySummary,
  MarketDailyRecord,
  MarketDailyRow,
  MarketWeekFacts,
  MarketWeekSummary,
  MarketWeeklyRecord,
  MarketWeeklyRow,
  PortfolioFacts,
  PortfolioRecord,
  PortfolioRow,
  ReportRecord,
  ReportRow,
  ReportSummaryJson,
} from "./types";
import {
  rowToHolding,
  rowToMarketDaily,
  rowToMarketWeekly,
  rowToPortfolio,
  rowToReport,
} from "./types";

export async function createReport(input: {
  userId: string;
  stockId: string;
  agentJobId: string;
  tradeDate?: string;
  isHolding?: boolean;
  shareCount?: number;
  avgCost?: number;
  usesMargin?: boolean;
  cashShareCount?: number;
  cashAvgCost?: number;
  marginShareCount?: number;
  marginAvgCost?: number;
}): Promise<ReportRecord> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .insert({
      user_id: input.userId,
      stock_id: input.stockId,
      agent_job_id: input.agentJobId,
      status: "queued",
      is_holding: input.isHolding ?? false,
      uses_margin: input.isHolding ? Boolean(input.usesMargin) : false,
      ...(input.tradeDate ? { trade_date: input.tradeDate } : {}),
      ...(input.isHolding && input.shareCount !== undefined
        ? { share_count: input.shareCount }
        : {}),
      ...(input.isHolding && input.avgCost !== undefined
        ? { avg_cost: input.avgCost }
        : {}),
      ...(input.isHolding
        ? {
            cash_share_count: input.cashShareCount ?? null,
            cash_avg_cost: input.cashAvgCost ?? null,
            margin_share_count: input.marginShareCount ?? null,
            margin_avg_cost: input.marginAvgCost ?? null,
          }
        : {}),
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "無法建立報告紀錄");
  }

  return rowToReport(data as ReportRow);
}

export async function updateReport(
  id: string,
  patch: Partial<
    Pick<
      ReportRecord,
      | "status"
      | "tradeDate"
      | "error"
      | "markdown"
      | "positionMarkdown"
      | "stockName"
      | "factsJson"
      | "historyJson"
      | "summaryJson"
    >
  >,
): Promise<ReportRecord | undefined> {
  const supabase = await createClient();
  const payload: Record<
    string,
    string | null | undefined | ChipFacts | HistoryDay[] | ReportSummaryJson
  > = {};

  if (patch.status !== undefined) {
    payload.status = patch.status;
  }
  if (patch.tradeDate !== undefined) {
    payload.trade_date = patch.tradeDate;
  }
  if (patch.error !== undefined) {
    payload.error = patch.error;
  }
  if (patch.markdown !== undefined) {
    payload.markdown = patch.markdown;
  }
  if (patch.positionMarkdown !== undefined) {
    payload.position_markdown = patch.positionMarkdown;
  }
  if (patch.stockName !== undefined) {
    payload.stock_name = patch.stockName;
  }
  if (patch.factsJson !== undefined) {
    payload.facts_json = patch.factsJson;
  }
  if (patch.historyJson !== undefined) {
    payload.history_json = patch.historyJson;
  }
  if (patch.summaryJson !== undefined) {
    payload.summary_json = patch.summaryJson;
  }

  const { data, error } = await supabase
    .from("reports")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    return undefined;
  }

  return rowToReport(data as ReportRow);
}

export async function findReportById(id: string): Promise<ReportRecord | undefined> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return undefined;
  }

  return rowToReport(data as ReportRow);
}

export async function deleteReport(
  id: string,
  userId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reports")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  return !error;
}

export async function listReportsForUser(userId: string): Promise<ReportRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return (data as ReportRow[]).map(rowToReport);
}

export async function listDoneReportsForUserByTradeDate(
  userId: string,
  tradeDate: string,
): Promise<ReportRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "done")
    .eq("trade_date", tradeDate)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  return (data as ReportRow[]).map(rowToReport);
}

export async function findHoldingForUserStock(
  userId: string,
  stockId: string,
): Promise<HoldingRecord | undefined> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("holdings")
    .select("*")
    .eq("user_id", userId)
    .eq("stock_id", stockId)
    .maybeSingle();

  if (error || !data) {
    return undefined;
  }

  return rowToHolding(data as HoldingRow);
}

export async function userHasAnyHoldings(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("holdings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) {
    return false;
  }
  return (count ?? 0) > 0;
}

export async function listHoldingsForUser(
  userId: string,
  options?: { limit?: number },
): Promise<HoldingRecord[]> {
  const limit = options?.limit ?? 20;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("holdings")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }
  return (data as HoldingRow[]).map(rowToHolding);
}

export async function upsertHoldingForUserStock(input: {
  userId: string;
  stockId: string;
  shareCount: number;
  avgCost: number;
  usesMargin?: boolean;
  cashShareCount?: number;
  cashAvgCost?: number;
  marginShareCount?: number;
  marginAvgCost?: number;
}): Promise<HoldingRecord> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("holdings")
    .upsert(
      {
        user_id: input.userId,
        stock_id: input.stockId,
        share_count: input.shareCount,
        avg_cost: input.avgCost,
        uses_margin: Boolean(input.usesMargin),
        cash_share_count: input.cashShareCount ?? null,
        cash_avg_cost: input.cashAvgCost ?? null,
        margin_share_count: input.marginShareCount ?? null,
        margin_avg_cost: input.marginAvgCost ?? null,
      },
      { onConflict: "user_id,stock_id" },
    )
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "無法儲存持股資料");
  }

  return rowToHolding(data as HoldingRow);
}

export function isValidStockId(value: string): boolean {
  return /^\d{4,6}$/.test(value.trim());
}

export function isValidTradeDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export function isValidReportStatus(value: string): value is ReportRecord["status"] {
  return ["queued", "fetching", "gating", "positioning", "done", "failed"].includes(
    value,
  );
}

export function isValidShareCount(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

export function isValidAvgCost(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export async function createPortfolio(input: {
  userId: string;
  agentJobId: string;
  profile: string;
  amount: number;
  mode?: PortfolioRecord["mode"];
  themes?: string[];
  tradeDate?: string;
  status?: PortfolioRecord["status"];
  narrative?: string | null;
  factsJson?: PortfolioFacts | null;
  generatedVia?: "agy" | "rules" | null;
}): Promise<PortfolioRecord> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("portfolios")
    .insert({
      user_id: input.userId,
      agent_job_id: input.agentJobId,
      profile: input.profile,
      amount: input.amount,
      status: input.status ?? "queued",
      mode: input.mode ?? "beginner",
      themes: input.themes ?? [],
      ...(input.tradeDate ? { trade_date: input.tradeDate } : {}),
      ...(input.narrative !== undefined ? { narrative: input.narrative } : {}),
      ...(input.factsJson !== undefined ? { facts_json: input.factsJson } : {}),
      ...(input.generatedVia !== undefined
        ? { generated_via: input.generatedVia }
        : {}),
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "無法建立組合紀錄");
  }

  return rowToPortfolio(data as PortfolioRow);
}

export async function updatePortfolio(
  id: string,
  patch: Partial<
    Pick<
      PortfolioRecord,
      | "status"
      | "tradeDate"
      | "error"
      | "narrative"
      | "factsJson"
      | "generatedVia"
    >
  >,
): Promise<PortfolioRecord | undefined> {
  const supabase = await createClient();
  const payload: Record<
    string,
    string | number | null | undefined | PortfolioFacts
  > = {};

  if (patch.status !== undefined) {
    payload.status = patch.status;
  }
  if (patch.tradeDate !== undefined) {
    payload.trade_date = patch.tradeDate;
  }
  if (patch.error !== undefined) {
    payload.error = patch.error;
  }
  if (patch.narrative !== undefined) {
    payload.narrative = patch.narrative;
  }
  if (patch.factsJson !== undefined) {
    payload.facts_json = patch.factsJson;
  }
  if (patch.generatedVia !== undefined) {
    payload.generated_via = patch.generatedVia;
  }

  const { data, error } = await supabase
    .from("portfolios")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    return undefined;
  }

  return rowToPortfolio(data as PortfolioRow);
}

export async function findPortfolioById(
  id: string,
): Promise<PortfolioRecord | undefined> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("portfolios")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return undefined;
  }

  return rowToPortfolio(data as PortfolioRow);
}

export async function deletePortfolio(
  id: string,
  userId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("portfolios")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  return !error;
}

export async function listPortfoliosForUser(
  userId: string,
): Promise<PortfolioRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("portfolios")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return (data as PortfolioRow[]).map(rowToPortfolio);
}

export function isValidPortfolioStatus(
  value: string,
): value is PortfolioRecord["status"] {
  return ["queued", "gating", "done", "failed"].includes(value);
}

export function isValidPortfolioProfile(
  value: string,
): value is PortfolioRecord["profile"] {
  return (
    ["conservative", "balanced", "aggressive"].includes(value) ||
    /^theme_[a-z0-9_]+$/.test(value)
  );
}

export function isValidPortfolioMode(
  value: string,
): value is PortfolioRecord["mode"] {
  return value === "beginner" || value === "theme";
}

export function isValidPortfolioThemes(values: unknown): values is string[] {
  if (!Array.isArray(values) || values.length === 0 || values.length > 3) {
    return false;
  }
  return values.every(
    (item) => typeof item === "string" && /^[a-z][a-z0-9_]*$/.test(item),
  );
}

export function isValidPortfolioAmount(value: number): boolean {
  return Number.isInteger(value) && value >= 50_000;
}

export async function createMarketWeekly(input: {
  userId: string;
  agentJobId: string;
  weekStart?: string;
  weekEnd?: string;
  status?: MarketWeeklyRecord["status"];
  markdown?: string | null;
  factsJson?: MarketWeekFacts | null;
  summaryJson?: MarketWeekSummary | null;
}): Promise<MarketWeeklyRecord> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("market_weeklies")
    .insert({
      user_id: input.userId,
      agent_job_id: input.agentJobId,
      status: input.status ?? "queued",
      ...(input.weekStart ? { week_start: input.weekStart } : {}),
      ...(input.weekEnd ? { week_end: input.weekEnd } : {}),
      ...(input.markdown !== undefined ? { markdown: input.markdown } : {}),
      ...(input.factsJson !== undefined ? { facts_json: input.factsJson } : {}),
      ...(input.summaryJson !== undefined
        ? { summary_json: input.summaryJson }
        : {}),
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "無法建立市場週報紀錄");
  }

  return rowToMarketWeekly(data as MarketWeeklyRow);
}

export async function updateMarketWeekly(
  id: string,
  patch: Partial<
    Pick<
      MarketWeeklyRecord,
      | "status"
      | "weekStart"
      | "weekEnd"
      | "error"
      | "markdown"
      | "factsJson"
      | "summaryJson"
    >
  >,
): Promise<MarketWeeklyRecord | undefined> {
  const supabase = await createClient();
  const payload: Record<string, unknown> = {};
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.weekStart !== undefined) payload.week_start = patch.weekStart;
  if (patch.weekEnd !== undefined) payload.week_end = patch.weekEnd;
  if (patch.error !== undefined) payload.error = patch.error;
  if (patch.markdown !== undefined) payload.markdown = patch.markdown;
  if (patch.factsJson !== undefined) payload.facts_json = patch.factsJson;
  if (patch.summaryJson !== undefined) payload.summary_json = patch.summaryJson;

  const { data, error } = await supabase
    .from("market_weeklies")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    return undefined;
  }
  return rowToMarketWeekly(data as MarketWeeklyRow);
}

export async function findMarketWeeklyById(
  id: string,
): Promise<MarketWeeklyRecord | undefined> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("market_weeklies")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    return undefined;
  }
  return rowToMarketWeekly(data as MarketWeeklyRow);
}

export async function listMarketWeekliesForUser(
  userId: string,
): Promise<MarketWeeklyRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("market_weeklies")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) {
    return [];
  }
  return (data as MarketWeeklyRow[]).map(rowToMarketWeekly);
}

export async function deleteMarketWeekly(
  id: string,
  userId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("market_weeklies")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  return !error;
}

export function isValidMarketWeeklyStatus(
  value: string,
): value is MarketWeeklyRecord["status"] {
  return ["queued", "gating", "done", "failed"].includes(value);
}

export async function createMarketDaily(input: {
  userId: string;
  agentJobId: string;
  tradeDate?: string;
  forSession?: string;
  status?: MarketDailyRecord["status"];
  markdown?: string | null;
  factsJson?: MarketDayFacts | null;
  summaryJson?: MarketDaySummary | null;
}): Promise<MarketDailyRecord> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("market_dailies")
    .insert({
      user_id: input.userId,
      agent_job_id: input.agentJobId,
      status: input.status ?? "queued",
      ...(input.tradeDate ? { trade_date: input.tradeDate } : {}),
      ...(input.forSession ? { for_session: input.forSession } : {}),
      ...(input.markdown !== undefined ? { markdown: input.markdown } : {}),
      ...(input.factsJson !== undefined ? { facts_json: input.factsJson } : {}),
      ...(input.summaryJson !== undefined
        ? { summary_json: input.summaryJson }
        : {}),
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "無法建立市場日報紀錄");
  }

  return rowToMarketDaily(data as MarketDailyRow);
}

export async function updateMarketDaily(
  id: string,
  patch: Partial<
    Pick<
      MarketDailyRecord,
      | "status"
      | "tradeDate"
      | "forSession"
      | "error"
      | "markdown"
      | "factsJson"
      | "summaryJson"
    >
  >,
): Promise<MarketDailyRecord | undefined> {
  const supabase = await createClient();
  const payload: Record<string, unknown> = {};
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.tradeDate !== undefined) payload.trade_date = patch.tradeDate;
  if (patch.forSession !== undefined) payload.for_session = patch.forSession;
  if (patch.error !== undefined) payload.error = patch.error;
  if (patch.markdown !== undefined) payload.markdown = patch.markdown;
  if (patch.factsJson !== undefined) payload.facts_json = patch.factsJson;
  if (patch.summaryJson !== undefined) payload.summary_json = patch.summaryJson;

  const { data, error } = await supabase
    .from("market_dailies")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error || !data) {
    return undefined;
  }
  return rowToMarketDaily(data as MarketDailyRow);
}

export async function findMarketDailyById(
  id: string,
): Promise<MarketDailyRecord | undefined> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("market_dailies")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    return undefined;
  }
  return rowToMarketDaily(data as MarketDailyRow);
}

export async function listMarketDailiesForUser(
  userId: string,
): Promise<MarketDailyRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("market_dailies")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error || !data) {
    return [];
  }
  return (data as MarketDailyRow[]).map(rowToMarketDaily);
}

export async function deleteMarketDaily(
  id: string,
  userId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("market_dailies")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  return !error;
}

export function isValidMarketDailyStatus(
  value: string,
): value is MarketDailyRecord["status"] {
  return ["queued", "gating", "done", "failed"].includes(value);
}
