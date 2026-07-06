"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MarkdownReport } from "@/components/MarkdownReport";
import {
  ReportStatusBadge,
  statusHint,
} from "@/components/ReportStatusBadge";
import type { ReportRecord, ReportStatus } from "@/lib/types";

type ReportPayload = {
  report: ReportRecord;
  markdown: string | null;
  error?: string;
};

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const reportId = params.id;
  const [payload, setPayload] = useState<ReportPayload | null>(null);
  const [error, setError] = useState("");

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

  const report = payload?.report;
  const status = report?.status;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-zinc-600 underline dark:text-zinc-400"
          >
            ← 返回
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">
            {report
              ? `台股 ${report.stockId}${report.tradeDate ? ` · ${report.tradeDate}` : ""}`
              : "載入中…"}
          </h1>
        </div>
        {status ? <ReportStatusBadge status={status} /> : null}
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

      {payload?.markdown ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <MarkdownReport markdown={payload.markdown} />
        </div>
      ) : null}

      {status && status !== "done" && status !== "failed" ? (
        <p className="text-sm text-zinc-500">每 3 秒自動更新狀態…</p>
      ) : null}
    </div>
  );
}
