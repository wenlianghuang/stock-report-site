/**
 * 規則對不上時，請本機 Ollama 選目錄裡的連結。模型不寫 SQL，也不讀帳。
 */

import {
  linkFromModelDraft,
  parseModelLinkDraft,
  type PaperLinkResult,
  type StockIdResolver,
} from "@/lib/paper-link";

const DEFAULT_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "llama3.1";
const DEFAULT_TIMEOUT_MS = 60_000;

export type PaperLinkCompleter = (prompt: string) => Promise<string | null>;

export function taipeiToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function paperLinkPrompt(question: string, today: string): string {
  const [year, month] = today.split("-");
  const monthNumber = String(Number(month));
  return `你是模擬帳的連結器。只輸出一個 JSON 物件，不要寫 SQL，不要回答問題。

今天是 ${today}（台北）。「這個月」用今天的年與月。

metric 只能是 fill_price、limit_price、avg_cost、month_fills、latest_fill 或 null。
- fill_price：某一檔在某一天，或該檔最近，的成交價
- limit_price：某一檔在某一天，或該檔最近，的限價
- avg_cost：某一檔目前已交割均價，不帶日期
- month_fills：某一個月的買進或賣出成交。沒有指定股票時 stockName 為 null
- latest_fill：沒有指定股票，問最近一筆買進或賣出是哪一檔
- null：對不上，或是籌碼、現金、真實持股

side 是 buy、sell 或 null。買進是 buy，賣出是 sell。兩邊都有或都沒有就 null。
stockName 是問句裡的股票名稱或代號；沒有指定就 null。不要猜代號。
sessionDate 是 YYYY-MM-DD 或 null。
year 是四位數或 null。month 是 1 到 12 或 null。
when 是 latest、session 或 null。問最新、最近、剛才、上回、上一筆，而且沒有寫日期，when 用 latest。

範例：
問：那最新買的股票是哪一檔
{"metric":"latest_fill","side":"buy","stockName":null,"sessionDate":null,"year":null,"month":null,"when":"latest"}
問：這個月有沒有買任何股票
{"metric":"month_fills","side":"buy","stockName":null,"sessionDate":null,"year":${year},"month":${monthNumber},"when":null}
問：2026-10-30 台積電買進成交價
{"metric":"fill_price","side":"buy","stockName":"台積電","sessionDate":"2026-10-30","year":null,"month":null,"when":"session"}

問句：${question.trim().slice(0, 500)}`;
}

export async function linkUnparsedQuestion(
  question: string,
  resolveStockId: StockIdResolver,
  today = taipeiToday(),
  complete: PaperLinkCompleter = completePaperLink,
): Promise<PaperLinkResult | null> {
  const raw = await complete(paperLinkPrompt(question, today));
  if (!raw) return null;
  const draft = parseModelLinkDraft(raw);
  if (!draft) return null;
  const metric = draft.metric;
  if (metric == null || metric === "" || metric === "null") return null;
  return linkFromModelDraft(draft, resolveStockId);
}

export async function completePaperLink(prompt: string): Promise<string | null> {
  const base = (process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
  const timeout = timeoutMs();
  try {
    const model = await resolveModel(base);
    const response = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        stream: false,
        format: "json",
        options: { temperature: 0 },
      }),
      signal: AbortSignal.timeout(timeout),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { message?: { content?: unknown } };
    const content = data.message?.content;
    return typeof content === "string" && content.trim() ? content : null;
  } catch {
    return null;
  }
}

async function resolveModel(base: string): Promise<string> {
  const preferred = (process.env.OLLAMA_MODEL || DEFAULT_MODEL).trim();
  const installed = await listModels(base);
  if (installed.length === 0) return preferred;
  if (installed.includes(preferred)) return preferred;
  const prefBase = preferred.split(":")[0];
  const tagged = installed.find(
    (name) => name.startsWith(`${preferred}:`) || name.split(":")[0] === prefBase,
  );
  if (tagged) return tagged;
  return installed.find((name) => name.startsWith("llama3")) ?? installed[0];
}

async function listModels(base: string): Promise<string[]> {
  try {
    const response = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(1500) });
    if (!response.ok) return [];
    const data = (await response.json()) as { models?: Array<{ name?: unknown; model?: unknown }> };
    if (!Array.isArray(data.models)) return [];
    return data.models
      .map((item) => String(item.name || item.model || "").trim())
      .filter((name) => name !== "");
  } catch {
    return [];
  }
}

function timeoutMs(): number {
  const parsed = Number(process.env.PAPER_OLLAMA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}
