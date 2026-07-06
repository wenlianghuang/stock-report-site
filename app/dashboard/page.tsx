"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ReportStatusBadge } from "@/components/ReportStatusBadge";
import type { ReportRecord } from "@/lib/types";

export default function DashboardPage() {
  const [stockId, setStockId] = useState("");
  const [tradeDate, setTradeDate] = useState("");
  const [isHolding, setIsHolding] = useState(false);
  const [shareCount, setShareCount] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadReports() {
    const response = await fetch("/api/reports");
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as { reports: ReportRecord[] };
    setReports(payload.reports);
  }

  useEffect(() => {
    void loadReports();
  }, []);

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
            交易日期選填；留空則使用最近交易日。有持股時會額外產出部位決策報告。
          </p>
        </form>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </section>

      <section>
        <h2 className="text-lg font-medium">我的報告</h2>
        {reports.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            尚無報告，請先輸入股號開始分析。
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
            {reports.map((report) => (
              <li key={report.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="font-medium">
                    {report.stockName
                      ? `${report.stockId} — ${report.stockName}`
                      : report.stockId}
                    {report.isHolding && report.shareCount ? (
                      <span className="ml-2 text-sm font-normal text-zinc-500">
                        持股 {report.shareCount.toLocaleString("zh-TW")} 股
                      </span>
                    ) : null}
                    {report.tradeDate ? (
                      <span className="ml-2 text-sm font-normal text-zinc-500">
                        {report.tradeDate}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {new Date(report.createdAt).toLocaleString("zh-TW")}
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
                    {deletingId === report.id ? "刪除中…" : "刪除"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
