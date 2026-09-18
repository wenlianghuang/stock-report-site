"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ReportStatusBadge } from "@/components/ReportStatusBadge";
import { VoiceReportModal } from "@/components/VoiceReportModal";
import type { VoiceReportFields } from "@/lib/voice-parse";
import type { ReportRecord } from "@/lib/types";
import {
  formatMarginQuantity,
  sharesToLots,
} from "@/lib/holding-legs";

const CHIP_READY_MINUTES = 21 * 60 + 30;
const MAX_STOCK_SLOTS = 20;

type SlotHolding = {
  cashShareCount: string;
  cashAvgCost: string;
  marginLotCount: string;
  marginAvgCost: string;
};

function emptySlotHolding(): SlotHolding {
  return {
    cashShareCount: "",
    cashAvgCost: "",
    marginLotCount: "",
    marginAvgCost: "",
  };
}

function padSlots<T>(items: T[], length: number, factory: () => T): T[] {
  if (items.length >= length) {
    return items;
  }
  const next = [...items];
  while (next.length < length) {
    next.push(factory());
  }
  return next;
}

function slotHoldingHasAnyInput(holding: SlotHolding): boolean {
  return Boolean(
    holding.cashShareCount ||
      holding.cashAvgCost ||
      holding.marginLotCount ||
      holding.marginAvgCost,
  );
}

function holdingRecordToSlot(holding: {
  shareCount?: number;
  avgCost?: number;
  usesMargin?: boolean;
  cashShareCount?: number;
  cashAvgCost?: number;
  marginShareCount?: number;
  marginAvgCost?: number;
}): SlotHolding {
  const slot = emptySlotHolding();
  if (holding.cashShareCount || holding.marginShareCount) {
    if (holding.cashShareCount) {
      slot.cashShareCount = String(holding.cashShareCount);
      slot.cashAvgCost = String(holding.cashAvgCost ?? "");
    }
    if (holding.marginShareCount) {
      const lots = sharesToLots(holding.marginShareCount);
      slot.marginLotCount =
        lots != null
          ? String(lots)
          : String(Math.round(holding.marginShareCount / 1000));
      slot.marginAvgCost = String(holding.marginAvgCost ?? "");
    }
    return slot;
  }
  if (holding.shareCount && holding.avgCost) {
    if (holding.usesMargin) {
      const lots = sharesToLots(holding.shareCount);
      slot.marginLotCount =
        lots != null
          ? String(lots)
          : String(Math.round(holding.shareCount / 1000));
      slot.marginAvgCost = String(holding.avgCost);
    } else {
      slot.cashShareCount = String(holding.shareCount);
      slot.cashAvgCost = String(holding.avgCost);
    }
  }
  return slot;
}

function parseSlotHolding(holding: SlotHolding) {
  const cashShares = holding.cashShareCount ? Number(holding.cashShareCount) : 0;
  const cashCost = holding.cashAvgCost ? Number(holding.cashAvgCost) : undefined;
  const marginLots = holding.marginLotCount ? Number(holding.marginLotCount) : 0;
  const marginCost = holding.marginAvgCost
    ? Number(holding.marginAvgCost)
    : undefined;
  const cashOk =
    cashShares > 0 &&
    cashCost !== undefined &&
    Number.isFinite(cashCost) &&
    cashCost > 0;
  const marginOk =
    marginLots > 0 &&
    Number.isInteger(marginLots) &&
    marginCost !== undefined &&
    Number.isFinite(marginCost) &&
    marginCost > 0;
  return { cashOk, marginOk, cashShares, cashCost, marginLots, marginCost };
}

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

export function TwStockDashboard() {
  const [stockSlotCount, setStockSlotCount] = useState(1);
  const [slotCountInput, setSlotCountInput] = useState("1");
  const [stockIds, setStockIds] = useState<string[]>([""]);
  const [tradeDate, setTradeDate] = useState(computeDefaultTradeDate);
  const [isHolding, setIsHolding] = useState(false);
  const [slotHoldings, setSlotHoldings] = useState<SlotHolding[]>([
    emptySlotHolding(),
  ]);
  const [holdingLoadedFor, setHoldingLoadedFor] = useState<(string | null)[]>([
    null,
  ]);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingDate, setSendingDate] = useState<string | null>(null);
  const [sentNotice, setSentNotice] = useState<string>("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openYears, setOpenYears] = useState<Record<string, boolean>>({});
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({});
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
  const [inputMode, setInputMode] = useState<"text" | "voice">("text");
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);

  function normalizedStockId(value: string) {
    const id = value.trim();
    return /^\d{4,6}$/.test(id) ? id : "";
  }

  function ensureSlotCapacity(count: number) {
    setStockIds((prev) => padSlots(prev, count, () => ""));
    setSlotHoldings((prev) => padSlots(prev, count, emptySlotHolding));
    setHoldingLoadedFor((prev) => padSlots(prev, count, () => null));
  }

  function setStockIdAt(index: number, value: string) {
    const prevId = normalizedStockId(stockIds[index] ?? "");
    const nextId = normalizedStockId(value);
    setStockIds((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
    if (prevId !== nextId) {
      setSlotHoldings((prev) => {
        const next = [...prev];
        next[index] = emptySlotHolding();
        return next;
      });
      setHoldingLoadedFor((prev) => {
        const next = [...prev];
        next[index] = null;
        return next;
      });
    }
  }

  function setSlotHoldingAt(index: number, patch: Partial<SlotHolding>) {
    setSlotHoldings((prev) => {
      const next = [...prev];
      next[index] = { ...(next[index] ?? emptySlotHolding()), ...patch };
      return next;
    });
  }

  function changeStockSlotCount(nextCount: number) {
    if (!Number.isFinite(nextCount)) {
      setSlotCountInput(String(stockSlotCount));
      return;
    }
    const count = Math.min(MAX_STOCK_SLOTS, Math.max(1, Math.trunc(nextCount)));
    setStockSlotCount(count);
    setSlotCountInput(String(count));
    ensureSlotCapacity(count);
  }

  function resetStockSlots() {
    setStockIds([""]);
    setSlotHoldings([emptySlotHolding()]);
    setHoldingLoadedFor([null]);
    setStockSlotCount(1);
    setSlotCountInput("1");
  }

  async function loadReports() {
    try {
      const response = await fetch("/api/reports");
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as { reports: ReportRecord[] };
      setReports(payload.reports);
    } finally {
      setInitialLoading(false);
    }
  }

  useEffect(() => {
    // Schedule outside the effect body to satisfy react-hooks/set-state-in-effect.
    queueMicrotask(() => {
      void loadReports();
    });
  }, []);

  // While any report is still running, poll each one so the list updates live
  // (status / stockName / tradeDate) without leaving the dashboard.
  const pendingReportIds = reports
    .filter(
      (r) =>
        r.status === "queued" ||
        r.status === "fetching" ||
        r.status === "gating" ||
        r.status === "positioning",
    )
    .map((r) => r.id)
    .sort()
    .join(",");

  useEffect(() => {
    if (!pendingReportIds) {
      return;
    }
    const pendingIds = pendingReportIds.split(",");
    let cancelled = false;

    async function syncPending() {
      const updates = await Promise.all(
        pendingIds.map(async (id) => {
          try {
            const response = await fetch(`/api/reports/${id}`);
            if (!response.ok) {
              return null;
            }
            const data = (await response.json()) as { report?: ReportRecord };
            return data.report ?? null;
          } catch {
            return null;
          }
        }),
      );
      if (cancelled) {
        return;
      }
      setReports((prev) => {
        const byId = new Map(prev.map((item) => [item.id, item]));
        let changed = false;
        for (const updated of updates) {
          if (!updated) continue;
          const existing = byId.get(updated.id);
          if (
            !existing ||
            existing.status !== updated.status ||
            existing.stockName !== updated.stockName ||
            existing.tradeDate !== updated.tradeDate ||
            existing.error !== updated.error ||
            Boolean(existing.markdown) !== Boolean(updated.markdown) ||
            Boolean(existing.positionMarkdown) !==
              Boolean(updated.positionMarkdown)
          ) {
            byId.set(updated.id, updated);
            changed = true;
          }
        }
        if (!changed) {
          return prev;
        }
        return Array.from(byId.values()).sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
      });
    }

    const timer = window.setInterval(() => {
      void syncPending();
    }, 3000);
    void syncPending();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pendingReportIds]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/trading-date");
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as { tradeDate?: string };
        if (!cancelled && data.tradeDate) {
          setTradeDate(data.tradeDate);
        }
      } catch {
        // keep fallback default
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isHolding) return;
    const targets = stockIds
      .slice(0, stockSlotCount)
      .map((raw, index) => ({ index, id: normalizedStockId(raw) }))
      .filter(({ index, id }) => Boolean(id) && holdingLoadedFor[index] !== id);
    if (targets.length === 0) return;

    let cancelled = false;
    void (async () => {
      await Promise.all(
        targets.map(async ({ index, id }) => {
          try {
            const response = await fetch(
              `/api/holdings?stockId=${encodeURIComponent(id)}`,
            );
            const data = (await response.json()) as {
              holding?: {
                shareCount?: number;
                avgCost?: number;
                usesMargin?: boolean;
                cashShareCount?: number;
                cashAvgCost?: number;
                marginShareCount?: number;
                marginAvgCost?: number;
              } | null;
            };
            if (!response.ok || cancelled) {
              return;
            }
            setSlotHoldings((prev) => {
              const next = [...prev];
              const current = next[index] ?? emptySlotHolding();
              if (slotHoldingHasAnyInput(current)) {
                return prev;
              }
              next[index] = data.holding
                ? holdingRecordToSlot(data.holding)
                : emptySlotHolding();
              return next;
            });
            setHoldingLoadedFor((prev) => {
              const next = [...prev];
              next[index] = id;
              return next;
            });
          } catch {
            // ignore
          }
        }),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [isHolding, stockIds, stockSlotCount, holdingLoadedFor]);

  useEffect(() => {
    if (!isHolding) return;

    const handle = window.setTimeout(() => {
      for (let index = 0; index < stockSlotCount; index += 1) {
        const id = normalizedStockId(stockIds[index] ?? "");
        if (!id) continue;
        const parsed = parseSlotHolding(
          slotHoldings[index] ?? emptySlotHolding(),
        );
        if (!parsed.cashOk && !parsed.marginOk) continue;
        void fetch("/api/holdings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            stockId: id,
            ...(parsed.cashOk
              ? {
                  cashShareCount: parsed.cashShares,
                  cashAvgCost: parsed.cashCost,
                }
              : {}),
            ...(parsed.marginOk
              ? {
                  marginLotCount: parsed.marginLots,
                  marginAvgCost: parsed.marginCost,
                }
              : {}),
          }),
        });
      }
    }, 400);

    return () => {
      window.clearTimeout(handle);
    };
  }, [isHolding, stockIds, stockSlotCount, slotHoldings]);

  useEffect(() => {
    if (reports.length === 0) return;
    const seedDate = tradeDate || reportDateKey(reports[0]);
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
  }, [reports, tradeDate]);

  /** 語音：融資數量若 <1000 或非整千，視為張數。 */
  function voiceMarginToLots(raw: string): string {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return "";
    if (n < 1000 || n % 1000 !== 0) return String(Math.round(n));
    const lots = sharesToLots(n);
    return lots != null ? String(lots) : String(Math.round(n / 1000));
  }

  function applyVoiceFields(fields: VoiceReportFields) {
    const holding = emptySlotHolding();
    if (fields.isHolding && fields.usesMargin) {
      holding.marginLotCount = voiceMarginToLots(fields.shareCount);
      holding.marginAvgCost = fields.avgCost;
    } else if (fields.isHolding) {
      holding.cashShareCount = fields.shareCount;
      holding.cashAvgCost = fields.avgCost;
    }
    setStockSlotCount(1);
    setStockIds([fields.stockId.trim()]);
    setIsHolding(fields.isHolding);
    setSlotHoldings([holding]);
    setHoldingLoadedFor([fields.stockId.trim() || null]);
  }

  function closeVoiceModal() {
    setVoiceModalOpen(false);
    setInputMode("text");
  }

  function selectInputMode(mode: "text" | "voice") {
    setInputMode(mode);
    if (mode === "voice") {
      setVoiceModalOpen(true);
    } else {
      setVoiceModalOpen(false);
    }
  }

  function handleVoiceFillForm(fields: VoiceReportFields) {
    applyVoiceFields(fields);
    setSentNotice("已從語音填入，請確認欄位後再按「開始分析」");
    closeVoiceModal();
  }

  async function handleVoiceConfirmAndAnalyze(fields: VoiceReportFields) {
    applyVoiceFields(fields);
    setSentNotice("");
    closeVoiceModal();
    const holding = emptySlotHolding();
    if (fields.isHolding && fields.usesMargin) {
      holding.marginLotCount = voiceMarginToLots(fields.shareCount);
      holding.marginAvgCost = fields.avgCost;
    } else if (fields.isHolding) {
      holding.cashShareCount = fields.shareCount;
      holding.cashAvgCost = fields.avgCost;
    }
    await createReportFromFields({
      stocks: [{ stockId: fields.stockId.trim(), holding }],
      isHolding: fields.isHolding,
    });
  }

  async function createReportFromFields(fields: {
    stocks: Array<{ stockId: string; holding: SlotHolding }>;
    isHolding: boolean;
  }) {
    setError("");
    setLoading(true);

    const seen = new Set<string>();
    const jobs: Array<{ id: string; holding: SlotHolding }> = [];
    for (const stock of fields.stocks) {
      const id = stock.stockId.trim();
      if (!/^\d{4,6}$/.test(id) || seen.has(id)) continue;
      seen.add(id);
      jobs.push({ id, holding: stock.holding });
    }

    if (jobs.length === 0) {
      setError("請至少填一個 4～6 碼台股代號");
      setLoading(false);
      return;
    }

    try {
      const results = await Promise.all(
        jobs.map(async ({ id, holding }) => {
          const parsed = parseSlotHolding(holding);
          const holdingBody = fields.isHolding
            ? {
                isHolding: true as const,
                ...(parsed.cashOk
                  ? {
                      cashShareCount: parsed.cashShares,
                      cashAvgCost: parsed.cashCost,
                    }
                  : {}),
                ...(parsed.marginOk
                  ? {
                      marginLotCount: parsed.marginLots,
                      marginAvgCost: parsed.marginCost,
                    }
                  : {}),
              }
            : {};
          const response = await fetch("/api/reports", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              stockId: id,
              ...(tradeDate ? { tradeDate } : {}),
              ...holdingBody,
            }),
          });
          const payload = (await response.json()) as {
            error?: string;
            report?: ReportRecord;
          };
          return { id, ok: response.ok, payload };
        }),
      );

      const created: ReportRecord[] = [];
      const failures: string[] = [];
      for (const result of results) {
        if (result.ok && result.payload.report) {
          created.push(result.payload.report);
        } else {
          failures.push(
            `${result.id}: ${result.payload.error ?? "無法建立報告"}`,
          );
        }
      }

      if (created.length > 0) {
        setReports((prev) => {
          const existing = new Set(created.map((r) => r.id));
          return [
            ...created,
            ...prev.filter((r) => !existing.has(r.id)),
          ];
        });
        const dateKey = created[0]?.tradeDate || tradeDate || reportDateKey(created[0]!);
        const [year, month, day] = dateKey.split("-");
        if (year && month && day) {
          setOpenYears((prev) => ({ ...prev, [year]: true }));
          setOpenMonths((prev) => ({ ...prev, [`${year}-${month}`]: true }));
          setOpenDays((prev) => ({ ...prev, [dateKey]: true }));
        }
        if (jobs.length === 1 && created.length === 1) {
          setSentNotice(
            `已開始分析 ${created[0]!.stockId}，可在下方列表查看進度，或開啟報告頁。`,
          );
        } else {
          setSentNotice(
            `已送出 ${created.length} 檔分析（含持股／融資可並行；超出後端同時執行上限的會排隊），可在下方列表同時追蹤進度。`,
          );
        }
        resetStockSlots();
      }

      if (failures.length > 0) {
        setError(failures.join("；"));
      }
    } catch {
      setError("網路錯誤，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await createReportFromFields({
      stocks: stockIds.slice(0, stockSlotCount).map((stockId, index) => ({
        stockId,
        holding: slotHoldings[index] ?? emptySlotHolding(),
      })),
      isHolding,
    });
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
    <div className="flex w-full flex-col gap-8">
      <div>
        <h2 className="text-xl font-semibold">台股籌碼報告</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          輸入股號後會執行 tw-stock-report → report-gate；若有持股則額外執行 position-gate
        </p>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <h2 className="text-lg font-medium">產生新報告</h2>
          <fieldset className="flex flex-wrap items-center gap-4 border-0 p-0 text-sm">
            <legend className="sr-only">填寫方式</legend>
            <label className="flex cursor-pointer items-center gap-2 text-zinc-700 dark:text-zinc-300">
              <input
                type="radio"
                name="report-input-mode"
                checked={inputMode === "text"}
                onChange={() => selectInputMode("text")}
                className="h-4 w-4 border-zinc-300"
              />
              文字填寫
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-zinc-700 dark:text-zinc-300">
              <input
                type="radio"
                name="report-input-mode"
                checked={inputMode === "voice"}
                onChange={() => selectInputMode("voice")}
                className="h-4 w-4 border-zinc-300"
              />
              語音填寫
            </label>
          </fieldset>
        </div>

        <VoiceReportModal
          open={voiceModalOpen}
          disabled={loading}
          onClose={closeVoiceModal}
          onConfirmAndAnalyze={handleVoiceConfirmAndAnalyze}
          onFillForm={handleVoiceFillForm}
        />

        <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <span className="whitespace-nowrap">分析檔數</span>
                <input
                  type="number"
                  min={1}
                  max={MAX_STOCK_SLOTS}
                  value={slotCountInput}
                  onChange={(event) => {
                    const raw = event.target.value;
                    setSlotCountInput(raw);
                    const parsed = Number(raw);
                    if (
                      Number.isInteger(parsed) &&
                      parsed >= 1 &&
                      parsed <= MAX_STOCK_SLOTS
                    ) {
                      setStockSlotCount(parsed);
                      ensureSlotCapacity(parsed);
                    }
                  }}
                  onBlur={() => changeStockSlotCount(Number(slotCountInput))}
                  disabled={loading}
                  className="w-16 rounded-lg border border-zinc-300 bg-white px-2 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-black"
                />
                <span className="text-xs text-zinc-500">檔（1～{MAX_STOCK_SLOTS}）</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={isHolding}
                  onChange={(event) => {
                    const next = event.target.checked;
                    setIsHolding(next);
                    if (!next) {
                      setSlotHoldings((prev) => prev.map(() => emptySlotHolding()));
                      setHoldingLoadedFor((prev) => prev.map(() => null));
                    }
                  }}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                有持股
              </label>
            </div>

            {isHolding ? (
              <div className="flex flex-col gap-2">
                {stockIds.slice(0, stockSlotCount).map((value, index) => {
                  const holding = slotHoldings[index] ?? emptySlotHolding();
                  return (
                    <div
                      key={`stock-slot-${index}`}
                      className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800 sm:flex-row sm:flex-wrap sm:items-center"
                    >
                      <input
                        value={value}
                        onChange={(event) =>
                          setStockIdAt(index, event.target.value)
                        }
                        placeholder={`股號 ${index + 1}（如 2330）`}
                        inputMode="numeric"
                        required={index === 0}
                        title="4～6 碼台股代號"
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 sm:max-w-[9rem] dark:border-zinc-700 dark:bg-black"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-zinc-500">
                          現股
                        </span>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={holding.cashShareCount}
                          onChange={(event) =>
                            setSlotHoldingAt(index, {
                              cashShareCount: event.target.value,
                            })
                          }
                          placeholder="現股股數"
                          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 sm:max-w-[8rem] dark:border-zinc-700 dark:bg-black"
                        />
                        <input
                          type="number"
                          min={0.01}
                          step={0.01}
                          value={holding.cashAvgCost}
                          onChange={(event) =>
                            setSlotHoldingAt(index, {
                              cashAvgCost: event.target.value,
                            })
                          }
                          placeholder="現股均價"
                          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 sm:max-w-[8rem] dark:border-zinc-700 dark:bg-black"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-zinc-500">
                          融資
                        </span>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={holding.marginLotCount}
                          onChange={(event) =>
                            setSlotHoldingAt(index, {
                              marginLotCount: event.target.value,
                            })
                          }
                          placeholder="融資張數"
                          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 sm:max-w-[8rem] dark:border-zinc-700 dark:bg-black"
                        />
                        <input
                          type="number"
                          min={0.01}
                          step={0.01}
                          value={holding.marginAvgCost}
                          onChange={(event) =>
                            setSlotHoldingAt(index, {
                              marginAvgCost: event.target.value,
                            })
                          }
                          placeholder="融資均價"
                          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 sm:max-w-[8rem] dark:border-zinc-700 dark:bg-black"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                {stockIds.slice(0, stockSlotCount).map((value, index) => (
                  <input
                    key={`stock-slot-${index}`}
                    value={value}
                    onChange={(event) => setStockIdAt(index, event.target.value)}
                    placeholder={`股號 ${index + 1}（如 2330）`}
                    inputMode="numeric"
                    required={index === 0}
                    title="4～6 碼台股代號"
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 sm:max-w-[9rem] dark:border-zinc-700 dark:bg-black"
                  />
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
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
          </div>
          <p className="text-xs text-zinc-500">
            交易日期已依證交所開休市日期表自動帶入，並以加權指數成交確認臨時休市（21:30 前用前一交易日、之後用當日；休市日順延至最近交易日），可自行調整；清空則由系統使用最近交易日。有持股時請為每一檔至少填現股（股）或融資（張，1 張＝1000 股）一組；可同時填兩組，系統會分開分析並給綜合結論。已儲存的持股會依股號自動帶入。多檔分析請用上方「分析檔數」決定要展開幾個輸入框（1～{MAX_STOCK_SLOTS} 檔），含融資也可一次送出並行。
          </p>
        </form>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        {sentNotice ? <p className="mt-3 text-sm text-emerald-700">{sentNotice}</p> : null}
      </section>

      <section>
        <h2 className="text-lg font-medium">我的報告</h2>
        {initialLoading ? (
          <div className="mt-4 animate-pulse rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <ul className="flex flex-col gap-3">
              {[0, 1, 2].map((row) => (
                <li
                  key={row}
                  className="h-10 rounded-lg bg-zinc-100 dark:bg-zinc-900"
                />
              ))}
            </ul>
          </div>
        ) : reports.length === 0 ? (
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
                                                        {report.cashShareCount
                                                          ? ` · 現股 ${report.cashShareCount.toLocaleString("zh-TW")} 股`
                                                          : ""}
                                                        {report.marginShareCount
                                                          ? ` · 融資 ${formatMarginQuantity(report.marginShareCount)}`
                                                          : report.usesMargin
                                                            ? " · 融資"
                                                            : ""}
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
                                                  <ReportStatusBadge
                                                    status={report.status}
                                                    isHolding={report.isHolding}
                                                    hasMarketMarkdown={Boolean(
                                                      report.markdown,
                                                    )}
                                                    hasPositionMarkdown={Boolean(
                                                      report.positionMarkdown,
                                                    )}
                                                  />
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
