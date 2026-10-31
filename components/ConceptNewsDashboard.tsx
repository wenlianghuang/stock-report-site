"use client";

import { useCallback, useEffect, useState } from "react";
import { MarkdownReport } from "@/components/MarkdownReport";
import type {
  ConceptNewsAnswer,
  ConceptNewsEvent,
  ConceptNewsJob,
  ConceptNewsReport,
  ConceptNewsReportMeta,
  ConceptNewsTheme,
} from "@/lib/types";

const SUGGESTIONS = ["有哪些事件", "誰被點名", "這份事件表有沒有寫產能"];

function taipeiParts(now = new Date()): { day: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "0";
  const hourText = get("hour") === "24" ? "0" : get("hour");
  return {
    day: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(hourText) * 60 + Number(get("minute")),
  };
}

/** Matches the server: 18:00 Taipei opens today's concept-news date. Chips stay at 21:30. */
function newsReportDate(now = new Date()): string {
  const clock = taipeiParts(now);
  if (clock.minutes >= 18 * 60) return clock.day;
  const base = new Date(`${clock.day}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() - 1);
  return base.toISOString().slice(0, 10);
}

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  found?: boolean;
};

function namedLabel(event: ConceptNewsEvent): string {
  const ids = (event.mentioned_ids ?? []).filter(Boolean);
  if (ids.length === 0) return "未點名個股";
  return ids.join("、");
}

/** Turn "標題｜媒體｜https://..." into a title link. The address stays in the href. */
function linkSourceTitles(markdown: string): string {
  return markdown.replace(
    /^(\s*[-*]\s+)(.+)｜([^｜\n]+)｜(https?:\/\/\S+)\s*$/gm,
    (_match, bullet: string, title: string, publisher: string, url: string) => {
      const label = title.trim().replaceAll("[", "\\[").replaceAll("]", "\\]");
      const href = url.trim().replaceAll("(", "%28").replaceAll(")", "%29");
      return `${bullet}[${label}](${href})｜${publisher.trim()}`;
    },
  );
}

export function ConceptNewsDashboard({
  themeId: controlledThemeId,
  embedded = false,
}: {
  themeId?: string;
  embedded?: boolean;
} = {}) {
  const [themes, setThemes] = useState<ConceptNewsTheme[]>([]);
  const [themeId, setThemeId] = useState("");
  const [reports, setReports] = useState<ConceptNewsReportMeta[]>([]);
  const [newsAsOf, setNewsAsOf] = useState("");
  const [date, setDate] = useState("");
  const [report, setReport] = useState<ConceptNewsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const loadReport = useCallback(async (theme: string, day: string) => {
    const response = await fetch(
      `/api/concept-news/reports/${encodeURIComponent(theme)}/${encodeURIComponent(day)}`,
    );
    const payload = (await response.json()) as {
      report?: ConceptNewsReport;
      error?: string;
    };
    if (!response.ok || !payload.report) {
      throw new Error(payload.error || "無法讀取題材新聞");
    }
    setReport(payload.report);
    setDate(day);
  }, []);

  const loadReports = useCallback(
    async (theme: string, preferredDate?: string) => {
      const response = await fetch(
        `/api/concept-news/reports?theme=${encodeURIComponent(theme)}`,
      );
      const payload = (await response.json()) as {
        items?: ConceptNewsReportMeta[];
        news_as_of?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "無法載入已寫好的報告");
      }
      const items = payload.items ?? [];
      setReports(items);
      setNewsAsOf(payload.news_as_of || newsReportDate());
      const nextDate =
        (preferredDate && items.some((item) => item.date === preferredDate)
          ? preferredDate
          : items[0]?.date) ?? "";
      if (!nextDate) {
        setDate("");
        setReport(null);
        return;
      }
      await loadReport(theme, nextDate);
    },
    [loadReport],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/concept-news/themes");
        const payload = (await response.json()) as {
          themes?: ConceptNewsTheme[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error || "無法載入題材");
        }
        if (cancelled) return;
        const list = payload.themes ?? [];
        setThemes(list);
        const initial =
          controlledThemeId ||
          list.find((item) => item.theme_id === "panel")?.theme_id ||
          list[0]?.theme_id ||
          "";
        setThemeId(initial);
        if (initial) {
          await loadReports(initial);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "載入失敗");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [loadReports, controlledThemeId]);

  useEffect(() => {
    setMessages([]);
    setQuestion("");
    setNotice(null);
  }, [themeId, date]);

  async function changeTheme(next: string) {
    setThemeId(next);
    setError(null);
    setReport(null);
    setDate("");
    try {
      await loadReports(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入失敗");
    }
  }

  async function changeDate(next: string) {
    if (!themeId || !next) return;
    setError(null);
    if (!reports.some((item) => item.date === next)) {
      setDate(next);
      setReport(null);
      return;
    }
    try {
      await loadReport(themeId, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "載入失敗");
    }
  }

  async function pollJob(jobId: string): Promise<ConceptNewsJob | null> {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 4000));
      }
      const response = await fetch(`/api/concept-news/jobs/${jobId}`);
      const payload = (await response.json()) as {
        job?: ConceptNewsJob;
        error?: string;
      };
      if (!response.ok || !payload.job) continue;
      if (payload.job.status === "done" || payload.job.status === "failed") {
        return payload.job;
      }
    }
    return null;
  }

  async function generate(force: boolean, day = date) {
    if (!themeId || generating) return;
    setGenerating(true);
    setError(null);
    setNotice(day ? `正在蒐集 ${day}…` : null);
    try {
      const response = await fetch("/api/concept-news/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: themeId,
          date: day || undefined,
          force,
        }),
      });
      const payload = (await response.json()) as {
        job?: ConceptNewsJob;
        error?: string;
      };
      if (!response.ok || !payload.job) {
        throw new Error(payload.error || "無法建立任務");
      }
      const finished =
        payload.job.status === "done" || payload.job.status === "failed"
          ? payload.job
          : await pollJob(payload.job.id);
      if (!finished) {
        throw new Error("任務仍在跑，請稍後重新整理這頁。");
      }
      if (finished.status === "failed") {
        throw new Error(finished.error || "題材新聞沒有寫成");
      }
      const writtenDay = finished.as_of || day;
      if (writtenDay) {
        await loadReports(themeId, writtenDay);
      }
      setNotice(
        finished.searched
          ? "已重新蒐集並寫入事件表。"
          : "沿用已寫好的檔案，這次沒有重新搜尋。",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "產生失敗");
    } finally {
      setGenerating(false);
    }
  }

  async function ask(text: string) {
    const message = text.trim();
    if (!message || !themeId || !date || !report?.has_events || asking) return;
    const userMessage: ChatMessage = {
      id: `${Date.now()}-q`,
      role: "user",
      content: message,
    };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");
    setAsking(true);
    setError(null);
    try {
      const response = await fetch("/api/concept-news/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: themeId, date, message }),
      });
      const payload = (await response.json()) as ConceptNewsAnswer & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "無法回答");
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-a`,
          role: "assistant",
          content: payload.answer,
          found: payload.found,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "無法回答");
    } finally {
      setAsking(false);
    }
  }

  const events = report?.events?.events ?? [];
  const selectedTheme = themes.find((item) => item.theme_id === themeId);
  const calendarToday = taipeiParts().day;
  const openDay =
    newsAsOf && !reports.some((item) => item.date === newsAsOf) ? newsAsOf : "";
  const waitingForToday = Boolean(newsAsOf) && newsAsOf < calendarToday;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              題材新聞
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-zinc-500">
              開頭是看法，依照新聞寫判斷和結論，不重抄張數。收盤後只列事實，不寫解釋。當天的題材新聞 18:00 以後才能產生，其他報告仍是 21:30。事件表預設收合。打開這頁不會搜尋。提問只根據該日事件表。第一版不寄信、不排程。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {openDay ? (
              <button
                type="button"
                onClick={() => void generate(false, openDay)}
                disabled={generating || !themeId}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {generating ? "產生中…" : `產生 ${openDay}`}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void generate(false)}
              disabled={generating || !themeId}
              className={
                openDay
                  ? "rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200"
                  : "rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
              }
            >
              {generating ? "產生中…" : "產生這一天"}
            </button>
            <button
              type="button"
              onClick={() => void generate(true)}
              disabled={generating || !themeId}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200"
            >
              強制重跑
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          {embedded ? null : (
            <label className="flex flex-1 flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-300">
              題材
              <select
                value={themeId}
                onChange={(event) => void changeTheme(event.target.value)}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              >
                {themes.map((item) => (
                  <option key={item.theme_id} value={item.theme_id}>
                    {item.label}（{item.theme_id}，{item.member_count} 檔）
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-1 flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-300">
            日期
            <select
              value={date}
              onChange={(event) => void changeDate(event.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            >
              {openDay ? (
                <option value={openDay}>{openDay} · 尚未產生</option>
              ) : null}
              {reports.map((item) => (
                <option key={item.date} value={item.date}>
                  {item.date} · {item.event_count} 件事件
                  {item.has_summary ? "" : " · 尚無摘要"}
                </option>
              ))}
            </select>
          </label>
        </div>
        {waitingForToday ? (
          <p className="mt-3 text-sm text-zinc-500">
            今天的題材新聞要到 18:00 以後才能產生。其他報告仍是 21:30。
          </p>
        ) : null}
        {selectedTheme ? (
          <p className="mt-3 text-sm text-zinc-500">
            {selectedTheme.label}
            {date ? ` · ${date}` : ""}
            {report ? ` · ${report.event_count} 件事件` : ""}
          </p>
        ) : null}
        {notice ? (
          <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">{notice}</p>
        ) : null}
        {error ? (
          <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>
        ) : null}
      </section>

      {loading ? (
        <p className="text-sm text-zinc-500">載入中…</p>
      ) : !report ? (
        <section className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
          {date === openDay
            ? `${openDay} 還沒有寫好。按「產生 ${openDay}」才會蒐集這一天的新聞。`
            : "這個題材還沒有寫好的摘要或事件表。按「產生這一天」才會蒐集新聞。"}
        </section>
      ) : (
        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="text-sm font-semibold">摘要</h3>
            {report.summary ? (
              <div className="mt-3 [&_a]:break-words [&_a]:underline [&_a]:underline-offset-2">
                <MarkdownReport
                  markdown={linkSourceTitles(report.summary)}
                  externalLinks
                />
              </div>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">這一天有事件表，摘要還沒寫好。</p>
            )}
          </section>

          <details className="rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <summary className="cursor-pointer select-none px-5 py-4 text-sm font-semibold">
              事件表（{events.length} 件）
              <span className="ml-2 text-xs font-normal text-zinc-500">
                摘要已涵蓋這些新聞，點開才看逐則內容
              </span>
            </summary>
            {events.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-zinc-500">沒有通過篩選的新聞。</p>
            ) : (
              <ul className="space-y-3 px-5 pb-5">
                {events.map((event) => {
                  const source = event.sources?.[0];
                  return (
                    <li
                      key={event.event_id || event.title}
                      className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"
                    >
                      {source?.url ? (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-zinc-900 underline underline-offset-2 dark:text-zinc-100"
                        >
                          {event.title}
                        </a>
                      ) : (
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {event.title}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-zinc-500">
                        {namedLabel(event)}
                        {source?.publisher ? ` · ${source.publisher}` : ""}
                      </p>
                      {source?.summary ? (
                        <p className="mt-2 line-clamp-4 text-sm text-zinc-600 dark:text-zinc-300">
                          {source.summary}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </details>
        </div>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-sm font-semibold">問這份事件表</h3>
        <p className="mt-1 text-sm text-zinc-500">
          答案只來自 {date || "所選日期"} 的事件表。問不到就會明說，不會另外搜尋。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((item) => (
            <button
              key={item}
              type="button"
              disabled={!report?.has_events || asking}
              onClick={() => void ask(item)}
              className="rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200"
            >
              {item}
            </button>
          ))}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void ask(question);
          }}
        >
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            disabled={!report?.has_events || asking}
            placeholder={report?.has_events ? "例如：友達被點名了嗎" : "要有事件表才能提問"}
            className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="submit"
            disabled={!report?.has_events || asking || !question.trim()}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {asking ? "查閱中…" : "提問"}
          </button>
        </form>
        <div className="mt-4 space-y-3">
          {messages.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                item.role === "user"
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  : item.found === false
                    ? "border border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
                    : "border border-zinc-200 text-zinc-800 dark:border-zinc-800 dark:text-zinc-200"
              }`}
            >
              {item.content}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
