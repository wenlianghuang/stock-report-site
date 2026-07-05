import type { ReportStatus } from "@/lib/types";

const LABELS: Record<ReportStatus, string> = {
  queued: "排隊中",
  fetching: "抓取籌碼",
  gating: "agy 分析中",
  done: "完成",
  failed: "失敗",
};

const STYLES: Record<ReportStatus, string> = {
  queued: "bg-zinc-100 text-zinc-700",
  fetching: "bg-blue-100 text-blue-800",
  gating: "bg-amber-100 text-amber-900",
  done: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
};

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}

export function statusHint(status: ReportStatus): string {
  switch (status) {
    case "queued":
      return "任務已建立，等待 worker 開始…";
    case "fetching":
      return "正在從 FinMind / Yahoo 拉取籌碼 CSV…";
    case "gating":
      return "agy 產報中，report-gate 驗證閉環（最多 3 輪）…";
    case "done":
      return "報告已完成。";
    case "failed":
      return "分析失敗，請查看錯誤訊息。";
  }
}
