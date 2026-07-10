"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MarkdownReport } from "@/components/MarkdownReport";
import { ReportChartsPanel } from "@/components/ReportChartsPanel";
import {
  ReportStatusBadge,
  statusHint,
} from "@/components/ReportStatusBadge";
import type { ReportRecord, ReportStatus } from "@/lib/types";

type ReportTab = "chart" | "market" | "position";

type ReportPayload = {
  report: ReportRecord;
  markdown: string | null;
  positionMarkdown?: string | null;
  error?: string;
};

function tabClass(active: boolean): string {
  return active
    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900";
}

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const reportId = params.id;
  const [payload, setPayload] = useState<ReportPayload | null>(null);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<ReportTab>("chart");
  const [tabPinned, setTabPinned] = useState(false);

  useEffect(() => {
    if (!reportId) {
      return;
    }

    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch(`/api/reports/${reportId}`);
        const data = (await response.json()) as ReportPayload & { error?: string };

        if (!response.ok) {
          if (!cancelled) {
            setError(data.error ?? "讀取失敗");
          }
          return;
        }

        if (!cancelled) {
          setPayload(data);
          setError("");
        }

        const status = data.report.status as ReportStatus;
        if (status !== "done" && status !== "failed") {
          window.setTimeout(() => {
            void poll();
          }, 3000);
        }
      } catch {
        if (!cancelled) {
          setError("無法連線到 API");
        }
      }
    }

    void poll();

    return () => {
      cancelled = true;
    };
  }, [reportId]);

  useEffect(() => {
    if (tabPinned || !payload?.report) {
      return;
    }
    queueMicrotask(() => {
      setActiveTab(payload.report.isHolding ? "position" : "chart");
    });
  }, [payload?.report, tabPinned]);

  const report = payload?.report;
  const status = report?.status;
  const hasPositionReport = Boolean(report?.isHolding);
  const hasChartData = Boolean(report?.factsJson && report?.historyJson?.length);
  const marketMarkdown = payload?.markdown ?? report?.markdown ?? null;
  const positionMarkdown =
    payload?.positionMarkdown ?? report?.positionMarkdown ?? null;

  function selectTab(tab: ReportTab) {
    setTabPinned(true);
    setActiveTab(tab);
  }

  async function onDelete() {
    if (!report) {
      return;
    }

    const label = report.tradeDate
      ? `${report.stockId}（${report.tradeDate}）`
      : report.stockId;
    if (!window.confirm(`確定要刪除 ${label} 的報告嗎？`)) {
      return;
    }

    setDeleting(true);
    setError("");

    try {
      const response = await fetch(`/api/reports/${report.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "無法刪除報告");
        setDeleting(false);
        return;
      }

      window.location.href = "/";
    } catch {
      setError("網路錯誤，請稍後再試");
      setDeleting(false);
    }
  }

  function renderTabContent() {
    if (activeTab === "chart") {
      if (!hasChartData) {
        return (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {status === "fetching"
              ? "籌碼資料抓取中，圖表將在資料就緒後顯示…"
              : status === "gating" || status === "positioning"
                ? "報告產生中，圖表資料同步中…"
                : "圖表資料尚未就緒。"}
          </p>
        );
      }

      return (
        <ReportChartsPanel
          facts={report!.factsJson!}
          history={report!.historyJson!}
          avgCost={report?.isHolding ? report.avgCost : undefined}
        />
      );
    }

    if (activeTab === "position") {
      if (!positionMarkdown) {
        return (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {status === "positioning"
              ? "部位決策報告產生中…"
              : status === "gating"
                ? "市場報告完成後將接續產出部位決策報告…"
                : "部位決策報告尚未就緒。"}
          </p>
        );
      }
      return <MarkdownReport markdown={positionMarkdown} />;
    }

    if (!marketMarkdown) {
      return (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {status === "gating" || status === "fetching"
            ? "市場報告產生中…"
            : "市場報告尚未就緒。"}
        </p>
      );
    }

    return <MarkdownReport markdown={marketMarkdown} />;
  }

  const showContentPanel =
    Boolean(payload) ||
    Boolean(marketMarkdown) ||
    Boolean(positionMarkdown) ||
    Boolean(report?.isHolding) ||
    status === "fetching" ||
    status === "gating" ||
    status === "positioning";

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            href="/"
            className="text-sm text-zinc-600 underline dark:text-zinc-400"
          >
            ← 返回
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">
            {report
              ? `台股 ${report.stockName ? `${report.stockId} — ${report.stockName}` : report.stockId}${
                  report.tradeDate ? ` · ${report.tradeDate}` : ""
                }${
                  report.isHolding && report.shareCount
                    ? ` · 持股 ${report.shareCount.toLocaleString("zh-TW")} 股`
                    : ""
                }`
              : "載入中…"}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {status ? <ReportStatusBadge status={status} /> : null}
          {report ? (
            <button
              type="button"
              onClick={() => void onDelete()}
              disabled={deleting}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
            >
              {deleting ? "刪除中…" : "刪除"}
            </button>
          ) : null}
        </div>
      </div>

      {status ? (
        <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          {statusHint(status)}
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {report?.error ? (
        <pre className="overflow-x-auto rounded-xl bg-red-50 p-4 text-sm text-red-800">
          {report.error}
        </pre>
      ) : null}

      {showContentPanel ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mb-4 flex flex-wrap gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => selectTab("chart")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tabClass(activeTab === "chart")}`}
            >
              圖表
            </button>
            <button
              type="button"
              onClick={() => selectTab("market")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tabClass(activeTab === "market")}`}
            >
              市場報告
            </button>
            {hasPositionReport ? (
              <button
                type="button"
                onClick={() => selectTab("position")}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tabClass(activeTab === "position")}`}
              >
                部位報告
              </button>
            ) : null}
          </div>
          {renderTabContent()}
        </div>
      ) : null}

      {status && status !== "done" && status !== "failed" ? (
        <p className="text-sm text-zinc-500">每 3 秒自動更新狀態…</p>
      ) : null}
    </div>
  );
}
