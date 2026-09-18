import type { ReportStatus } from "@/lib/types";

const LABELS: Record<ReportStatus, string> = {
  queued: "排隊中",
  fetching: "抓取籌碼",
  gating: "市場報告",
  positioning: "部位產生中",
  done: "完成",
  failed: "失敗",
};

const STYLES: Record<ReportStatus, string> = {
  queued: "bg-zinc-100 text-zinc-700",
  fetching: "bg-blue-100 text-blue-800",
  gating: "bg-amber-100 text-amber-900",
  positioning: "bg-purple-100 text-purple-900",
  done: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
};

type BadgeProps = {
  status: ReportStatus;
  /** Holding jobs: market ready but position markdown still missing. */
  isHolding?: boolean;
  hasMarketMarkdown?: boolean;
  hasPositionMarkdown?: boolean;
};

export function ReportStatusBadge({
  status,
  isHolding,
  hasMarketMarkdown,
  hasPositionMarkdown,
}: BadgeProps) {
  const awaitingPosition =
    Boolean(isHolding) &&
    Boolean(hasMarketMarkdown) &&
    !hasPositionMarkdown &&
    (status === "done" || status === "positioning" || status === "failed");

  if (awaitingPosition && status === "positioning") {
    return (
      <span className="inline-flex rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-900">
        部位產生中
      </span>
    );
  }

  if (awaitingPosition && status === "done") {
    return (
      <span className="inline-flex rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-900">
        部位未產出
      </span>
    );
  }

  if (awaitingPosition && status === "failed") {
    return (
      <span className="inline-flex rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-900">
        市場完成・部位失敗
      </span>
    );
  }

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}

export function statusHint(
  status: ReportStatus,
  opts?: {
    isHolding?: boolean;
    hasMarketMarkdown?: boolean;
    hasPositionMarkdown?: boolean;
  },
): string {
  const awaitingPosition =
    Boolean(opts?.isHolding) &&
    Boolean(opts?.hasMarketMarkdown) &&
    !opts?.hasPositionMarkdown;

  if (awaitingPosition && status === "positioning") {
    return "市場報告已完成，正在產出持股部位決策報告…";
  }
  if (awaitingPosition && status === "done") {
    return "市場報告已完成，但部位報告尚未產出。可重新分析持股，或查看市場報告分頁。";
  }
  if (awaitingPosition && status === "failed") {
    return "市場報告已完成，但部位報告產生失敗。請查看錯誤訊息後重試。";
  }

  switch (status) {
    case "queued":
      return "任務已建立，等待 worker 開始…";
    case "fetching":
      return "正在從 FinMind / Yahoo 拉取籌碼 CSV…";
    case "gating":
      return "agy 產出市場觀察報告，report-gate 驗證閉環…";
    case "positioning":
      return "agy 產出持股部位決策報告，position-gate 驗證閉環…";
    case "done":
      return "報告已完成。";
    case "failed":
      return "分析失敗，請查看錯誤訊息。";
  }
}
