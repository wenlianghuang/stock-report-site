"use client";

import { FormEvent, useState } from "react";

type AskPayload = {
  ok?: boolean;
  answer?: string;
  sql?: string;
  note?: string | null;
  error?: string;
  link?: {
    stockId: string | null;
    sessionDate: string | null;
    side: string | null;
    metric: string;
    when?: string | null;
    fromDate?: string;
    toDate?: string;
  };
};

const METRIC_LABEL: Record<string, string> = {
  fill_price: "成交價",
  limit_price: "限價",
  avg_cost: "均價",
  month_fills: "成交",
  latest_fill: "最近成交",
};

export function PaperLedgerAsk() {
  const [question, setQuestion] = useState("這個月有沒有買任何股票？");
  const [asking, setAsking] = useState(false);
  const [result, setResult] = useState<AskPayload | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (asking) return;
    setAsking(true);
    setResult(null);
    try {
      const response = await fetch("/api/paper/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const payload = (await response.json()) as AskPayload;
      if (!response.ok) {
        setResult({ ok: false, answer: payload.error ?? "查詢失敗" });
        return;
      }
      setResult(payload);
    } catch {
      setResult({ ok: false, answer: "查詢失敗" });
    } finally {
      setAsking(false);
    }
  }

  const link = result?.link;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h3 className="text-lg font-semibold">查這本帳</h3>
      <p className="mt-1 text-sm text-zinc-500">
        只讀模擬帳的成交價、限價、已交割均價、某個月的成交，或最近一筆買進與賣出。規則對不上時，改由本機模型選擇目錄。問句不會拼進 SQL，也不能下單。
      </p>
      <form onSubmit={(event) => void onSubmit(event)} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="paper-ledger-question">
          問模擬帳
        </label>
        <input
          id="paper-ledger-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={asking || question.trim() === ""}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {asking ? "查詢中…" : "查詢"}
        </button>
      </form>
      {result?.answer ? (
        <div className="mt-3 space-y-2 text-sm">
          <p>{result.answer}</p>
          {link ? (
            <p className="text-xs text-zinc-500">
              {METRIC_LABEL[link.metric] ?? link.metric}
              {" · "}
              {link.stockId ?? "全部股票"}
              {link.metric === "latest_fill"
                ? " · 最近一筆"
                : link.when === "latest"
                  ? " · 最近一個交易日"
                  : ""}
              {link.fromDate && link.toDate ? ` · ${link.fromDate} 至 ${link.toDate}` : ""}
              {link.sessionDate ? ` · ${link.sessionDate}` : ""}
              {link.side === "buy" ? " · 買進" : link.side === "sell" ? " · 賣出" : ""}
            </p>
          ) : null}
          {result.note ? <p className="text-xs text-amber-700 dark:text-amber-300">{result.note}</p> : null}
          {result.sql ? (
            <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-3 text-xs leading-relaxed text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              {result.sql}
            </pre>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
