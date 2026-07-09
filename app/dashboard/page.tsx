"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ReportStatusBadge } from "@/components/ReportStatusBadge";
import type { ReportRecord } from "@/lib/types";

const CHIP_READY_MINUTES = 21 * 60 + 30;

type ReportGroup = {
  year: string;
  months: Array<{
    month: string;
    days: Array<{
      day: string;
      date: string;
      reports: ReportRecord[];
    }>;
  }>;
};

function computeDefaultTradeDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  const base = new Date(
    Date.UTC(get("year"), get("month") - 1, get("day")),
  );
  if (get("hour") * 60 + get("minute") < CHIP_READY_MINUTES) {
    base.setUTCDate(base.getUTCDate() - 1);
  }
  while (base.getUTCDay() === 0 || base.getUTCDay() === 6) {
    base.setUTCDate(base.getUTCDate() - 1);
  }
  return base.toISOString().slice(0, 10);
}

function reportDateKey(report: ReportRecord): string {
  if (report.tradeDate) {
    return report.tradeDate;
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(report.createdAt));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function groupReportsByDate(reports: ReportRecord[]): ReportGroup[] {
  const byDate = new Map<string, ReportRecord[]>();
  for (const report of reports) {
    const key = reportDateKey(report);
    const list = byDate.get(key);
    if (list) {
      list.push(report);
    } else {
      byDate.set(key, [report]);
    }
  }

  const dates = Array.from(byDate.keys()).sort((a, b) => b.localeCompare(a)); // newest first
  const byYear = new Map<string, Map<string, Map<string, ReportRecord[]>>>();

  for (const date of dates) {
    const [year, month, day] = date.split("-");
    if (!year || !month || !day) continue;
    if (!byYear.has(year)) byYear.set(year, new Map());
    const months = byYear.get(year)!;
    if (!months.has(month)) months.set(month, new Map());
    const days = months.get(month)!;
    days.set(day, byDate.get(date)!);
  }

  return Array.from(byYear.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([year, months]) => ({
      year,
      months: Array.from(months.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([month, days]) => ({
          month,
          days: Array.from(days.entries())
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([day, reports]) => ({
              day,
              date: `${year}-${month}-${day}`,
              reports,
            })),
        })),
    }));
}

export default function DashboardPage() {
  const [stockId, setStockId] = useState("");
  const [tradeDate, setTradeDate] = useState(computeDefaultTradeDate);
  const [isHolding, setIsHolding] = useState(false);
  const [shareCount, setShareCount] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [holdingLoadedFor, setHoldingLoadedFor] = useState<string | null>(null);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingDate, setSendingDate] = useState<string | null>(null);
  const [sentNotice, setSentNotice] = useState<string>("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openYears, setOpenYears] = useState<Record<string, boolean>>({});
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({});
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});

  function normalizedStockId(value: string) {
    const id = value.trim();
    return /^\d{4,6}$/.test(id) ? id : "";
  }

  async function loadReports() {
    const response = await fetch("/api/reports");
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as { reports: ReportRecord[] };
    setReports(payload.reports);
  }

  useEffect(() => {
    // Schedule outside the effect body to satisfy react-hooks/set-state-in-effect.
    queueMicrotask(() => {
      void loadReports();
    });
  }, []);

  useEffect(() => {
    if (!isHolding) return;
    const id = normalizedStockId(stockId);
    if (!id) return;
    if (holdingLoadedFor === id) return;

    const shouldAutofill = !shareCount || !avgCost;
    if (!shouldAutofill) {
      setHoldingLoadedFor(id);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/holdings?stockId=${encodeURIComponent(id)}`);
        const data = (await response.json()) as {
          holding?: { shareCount?: number; avgCost?: number } | null;
          error?: string;
        };
        if (!response.ok) {
          return;
        }
        if (cancelled) return;
        if (!data.holding) {
          setHoldingLoadedFor(id);
          return;
        }
        setShareCount((prev) => (prev ? prev : String(data.holding?.shareCount ?? "")));
        setAvgCost((prev) => (prev ? prev : String(data.holding?.avgCost ?? "")));
        setHoldingLoadedFor(id);
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isHolding, stockId, holdingLoadedFor, shareCount, avgCost]);

  useEffect(() => {
    if (!isHolding) return;
    const id = normalizedStockId(stockId);
    if (!id) return;
    if (!shareCount || !avgCost) return;

    const nextShare = Number(shareCount);
    const nextAvg = Number(avgCost);
    if (!Number.isFinite(nextShare) || nextShare <= 0) return;
    if (!Number.isFinite(nextAvg) || nextAvg <= 0) return;

    const handle = window.setTimeout(() => {
      void fetch("/api/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockId: id,
          shareCount: nextShare,
          avgCost: nextAvg,
        }),
      });
    }, 400);

    return () => {
      window.clearTimeout(handle);
    };
  }, [isHolding, stockId, shareCount, avgCost]);

  useEffect(() => {
    if (reports.length === 0) return;
    const today = computeDefaultTradeDate();
    const grouped = groupReportsByDate(reports);
    const hasToday = grouped.some((year) =>
      year.months.some((month) => month.days.some((day) => day.date === today)),
    );
    const seedDate = hasToday ? today : reportDateKey(reports[0]);
    const [yy, mm, dd] = seedDate.split("-");
    if (!yy || !mm || !dd) return;
    // Schedule outside the effect body to satisfy react-hooks/set-state-in-effect.
    queueMicrotask(() => {
      setOpenYears((prev) => (prev[yy] ? prev : { ...prev, [yy]: true }));
      setOpenMonths((prev) => {
        const key = `${yy}-${mm}`;
        return prev[key] ? prev : { ...prev, [key]: true };
      });
      setOpenDays((prev) => (prev[seedDate] ? prev : { ...prev, [seedDate]: true }));
    });
  }, [reports]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockId,
          ...(tradeDate ? { tradeDate } : {}),
          ...(isHolding
            ? {
                isHolding: true,
                shareCount: Number(shareCount),
                avgCost: Number(avgCost),
              }
            : {}),
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        report?: ReportRecord;
      };

      if (!response.ok || !payload.report) {
        setError(payload.error ?? "無法建立報告");
        return;
      }

      window.location.href = `/reports/${payload.report.id}`;
    } catch {
      setError("網路錯誤，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(report: ReportRecord) {
    const label = report.tradeDate
      ? `${report.stockId}（${report.tradeDate}）`
      : report.stockId;
    if (!window.confirm(`確定要刪除 ${label} 的報告嗎？`)) {
      return;
    }

    setError("");
    setDeletingId(report.id);

    try {
      const response = await fetch(`/api/reports/${report.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "無法刪除報告");
        return;
      }

      setReports((prev) => prev.filter((item) => item.id !== report.id));
    } catch {
      setError("網路錯誤，請稍後再試");
    } finally {
      setDeletingId(null);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  async function sendDailyDigestEmail(date: string) {
    setError("");
    setSentNotice("");
    setSendingDate(date);
    try {
      const response = await fetch("/api/email/daily-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string; subject?: string };
      if (!response.ok) {
        setError(payload.error ?? "寄送失敗");
        return;
      }
      setSentNotice(payload.subject ? `已寄出：${payload.subject}` : "已寄出 Email");
    } catch {
      setError("網路錯誤，請稍後再試");
    } finally {
      setSendingDate(null);
    }
  }

  const groupedReports = groupReportsByDate(reports);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">台股籌碼報告</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            輸入股號後會執行 tw-stock-report → report-gate；若有持股則額外執行 position-gate
          </p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          登出
        </button>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-medium">產生新報告</h2>
        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <input
              value={stockId}
              onChange={(event) => setStockId(event.target.value)}
              placeholder="例如 2409"
              pattern="\d{4,6}"
              required
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 sm:max-w-[8rem] dark:border-zinc-700 dark:bg-black"
            />
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={isHolding}
                onChange={(event) => setIsHolding(event.target.checked)}
                className="h-4 w-4 rounded border-zinc-300"
              />
              有持股
            </label>
            {isHolding ? (
              <>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={shareCount}
                  onChange={(event) => setShareCount(event.target.value)}
                  placeholder="持股股數"
                  required
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 sm:max-w-[9rem] dark:border-zinc-700 dark:bg-black"
                />
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={avgCost}
                  onChange={(event) => setAvgCost(event.target.value)}
                  placeholder="持股均價"
                  required
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 sm:max-w-[9rem] dark:border-zinc-700 dark:bg-black"
                />
              </>
            ) : null}
            <input
              type="date"
              value={tradeDate}
              onChange={(event) => setTradeDate(event.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 sm:max-w-[11rem] dark:border-zinc-700 dark:bg-black"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {loading ? "建立中…" : "開始分析"}
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            交易日期已自動帶入（21:30 前用前一交易日、之後用當日，遇週末順延至上一交易日），可自行調整；清空則由系統使用最近交易日。有持股時會額外產出部位決策報告。
          </p>
        </form>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        {sentNotice ? <p className="mt-3 text-sm text-emerald-700">{sentNotice}</p> : null}
      </section>

      <section>
        <h2 className="text-lg font-medium">我的報告</h2>
        {reports.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            尚無報告，請先輸入股號開始分析。
          </p>
        ) : (
          <div className="mt-4 rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {groupedReports.map((yearGroup) => {
                const yearCount = yearGroup.months.reduce(
                  (sum, month) => sum + month.days.reduce((acc, day) => acc + day.reports.length, 0),
                  0,
                );
                const isYearOpen = openYears[yearGroup.year] ?? false;
                return (
                  <li key={yearGroup.year} className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenYears((prev) => ({
                          ...prev,
                          [yearGroup.year]: !(prev[yearGroup.year] ?? false),
                        }))
                      }
                      className="flex w-full items-center justify-between gap-3 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-zinc-500">
                          {isYearOpen ? "▾" : "▸"}
                        </span>
                        <span className="font-medium">{yearGroup.year}</span>
                      </div>
                      <span className="text-xs text-zinc-500">{yearCount} 份</span>
                    </button>

                    {isYearOpen ? (
                      <ul className="mt-2 space-y-2 pl-6">
                        {yearGroup.months.map((monthGroup) => {
                          const monthKey = `${yearGroup.year}-${monthGroup.month}`;
                          const monthCount = monthGroup.days.reduce(
                            (sum, day) => sum + day.reports.length,
                            0,
                          );
                          const isMonthOpen = openMonths[monthKey] ?? false;
                          return (
                            <li key={monthKey}>
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenMonths((prev) => ({
                                    ...prev,
                                    [monthKey]: !(prev[monthKey] ?? false),
                                  }))
                                }
                                className="flex w-full items-center justify-between gap-3 text-left"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-zinc-500">
                                    {isMonthOpen ? "▾" : "▸"}
                                  </span>
                                  <span className="text-sm font-medium">
                                    {monthGroup.month} 月
                                  </span>
                                </div>
                                <span className="text-xs text-zinc-500">{monthCount} 份</span>
                              </button>

                              {isMonthOpen ? (
                                <ul className="mt-2 space-y-2 pl-6">
                                  {monthGroup.days.map((dayGroup) => {
                                    const dayKey = dayGroup.date;
                                    const isDayOpen = openDays[dayKey] ?? false;
                                    return (
                                      <li key={dayKey}>
                                        <div
                                          role="button"
                                          tabIndex={0}
                                          aria-expanded={isDayOpen}
                                          onClick={() =>
                                            setOpenDays((prev) => ({
                                              ...prev,
                                              [dayKey]: !(prev[dayKey] ?? false),
                                            }))
                                          }
                                          onKeyDown={(event) => {
                                            if (event.key !== "Enter" && event.key !== " ") return;
                                            event.preventDefault();
                                            setOpenDays((prev) => ({
                                              ...prev,
                                              [dayKey]: !(prev[dayKey] ?? false),
                                            }));
                                          }}
                                          className="flex w-full cursor-pointer items-center justify-between gap-3 text-left"
                                        >
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm text-zinc-500">
                                              {isDayOpen ? "▾" : "▸"}
                                            </span>
                                            <span className="text-sm font-medium">
                                              {dayGroup.day} 日
                                            </span>
                                            <span className="text-xs text-zinc-500">
                                              {dayGroup.date}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-3">
                                            <span className="text-xs text-zinc-500">
                                              {dayGroup.reports.length} 份
                                            </span>
                                            <button
                                              type="button"
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                void sendDailyDigestEmail(dayGroup.date);
                                              }}
                                              disabled={sendingDate === dayGroup.date}
                                              className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                                            >
                                              {sendingDate === dayGroup.date ? "寄送中…" : "寄出彙整 Email"}
                                            </button>
                                          </div>
                                        </div>

                                        {isDayOpen ? (
                                          <ul className="mt-2 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
                                            {dayGroup.reports.map((report) => (
                                              <li
                                                key={report.id}
                                                className="flex items-center justify-between gap-4 px-4 py-3"
                                              >
                                                <div>
                                                  <p className="font-medium">
                                                    {report.stockName
                                                      ? `${report.stockId} — ${report.stockName}`
                                                      : report.stockId}
                                                    {report.isHolding && report.shareCount ? (
                                                      <span className="ml-2 text-sm font-normal text-zinc-500">
                                                        持股{" "}
                                                        {report.shareCount.toLocaleString("zh-TW")}{" "}
                                                        股
                                                      </span>
                                                    ) : null}
                                                    {report.tradeDate ? (
                                                      <span className="ml-2 text-sm font-normal text-zinc-500">
                                                        {report.tradeDate}
                                                      </span>
                                                    ) : null}
                                                  </p>
                                                  <p className="text-xs text-zinc-500">
                                                    {new Date(report.createdAt).toLocaleString(
                                                      "zh-TW",
                                                    )}
                                                  </p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                  <ReportStatusBadge status={report.status} />
                                                  <Link
                                                    href={`/reports/${report.id}`}
                                                    className="text-sm font-medium text-zinc-900 underline dark:text-zinc-100"
                                                  >
                                                    查看
                                                  </Link>
                                                  <button
                                                    type="button"
                                                    onClick={() => void onDelete(report)}
                                                    disabled={deletingId === report.id}
                                                    className="text-sm text-red-600 hover:text-red-700 disabled:opacity-60 dark:text-red-400 dark:hover:text-red-300"
                                                  >
                                                    {deletingId === report.id
                                                      ? "刪除中…"
                                                      : "刪除"}
                                                  </button>
                                                </div>
                                              </li>
                                            ))}
                                          </ul>
                                        ) : null}
                                      </li>
                                    );
                                  })}
                                </ul>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
