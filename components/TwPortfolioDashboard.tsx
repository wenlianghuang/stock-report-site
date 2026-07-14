"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { MarkdownReport } from "@/components/MarkdownReport";
import type {
  PortfolioFacts,
  PortfolioProfile,
  PortfolioRecord,
  PortfolioResult,
} from "@/lib/types";
import { portfolioRecordToResult } from "@/lib/types";

type ProfileMeta = {
  id: PortfolioProfile;
  label: string;
  risk: string;
  blurb: string;
};

const PROFILES: ProfileMeta[] = [
  {
    id: "conservative",
    label: "保守型",
    risk: "低風險",
    blurb: "以 ETF 為主，波動小、求穩不求快，適合第一次投資。",
  },
  {
    id: "balanced",
    label: "穩健型",
    risk: "中風險",
    blurb: "ETF 打底搭配少量龍頭權值股，兼顧穩定與成長。",
  },
  {
    id: "aggressive",
    label: "積極型",
    risk: "中高風險",
    blurb: "提高個股比重、納入成長型產業，追求較高報酬。",
  },
];

const AMOUNT_PRESETS = [100_000, 300_000, 500_000, 1_000_000];
const MIN_AMOUNT = 50_000;

const VOLATILITY_LABEL: Record<string, string> = {
  low: "低",
  medium: "中",
  normal: "中",
  high: "高",
};

function formatTwd(value?: number | null): string {
  if (value === undefined || value === null) return "—";
  return `${Math.round(value).toLocaleString("zh-TW")} 元`;
}

function ProfileSelector({
  value,
  onChange,
  disabled,
}: {
  value: PortfolioProfile;
  onChange: (next: PortfolioProfile) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {PROFILES.map((profile) => {
        const active = profile.id === value;
        return (
          <button
            key={profile.id}
            type="button"
            onClick={() => onChange(profile.id)}
            disabled={disabled}
            className={`flex flex-col gap-1 rounded-xl border p-4 text-left transition disabled:opacity-60 ${
              active
                ? "border-zinc-900 bg-zinc-900 text-white shadow-sm dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold">{profile.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  active
                    ? "bg-white/20 text-white dark:bg-zinc-900/10 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {profile.risk}
              </span>
            </div>
            <p
              className={`text-xs leading-relaxed ${
                active
                  ? "text-white/80 dark:text-zinc-900/80"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {profile.blurb}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function SummaryCard({ facts }: { facts: PortfolioFacts }) {
  const stats: Array<{ label: string; value: string }> = [
    { label: "風險屬性", value: `${facts.profile_label}（${facts.risk_label}）` },
    { label: "持股檔數", value: `${facts.num_holdings} 檔` },
    { label: "ETF 核心", value: `${facts.etf_weight_pct}%` },
    {
      label: "預期波動",
      value: VOLATILITY_LABEL[facts.expected_volatility_level] ?? "中",
    },
    {
      label: "最大單一產業",
      value: `${facts.top_sector_label ?? facts.top_sector ?? "—"} ${facts.top_sector_weight_pct}%`,
    },
    {
      label: "分散程度",
      value: facts.diversification_ok ? "良好" : "偏集中",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <p className="text-xs text-zinc-500">{stat.label}</p>
          <p className="mt-1 text-sm font-semibold">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}

function HoldingsTable({ facts }: { facts: PortfolioFacts }) {
  const hasAmount = facts.amount_twd !== undefined && facts.amount_twd !== null;
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-900">
          <tr>
            <th className="px-3 py-2 font-medium">股票</th>
            <th className="px-3 py-2 font-medium">角色</th>
            <th className="px-3 py-2 font-medium">產業</th>
            <th className="px-3 py-2 font-medium">權重</th>
            {hasAmount ? (
              <>
                <th className="px-3 py-2 text-right font-medium">投入金額</th>
                <th className="px-3 py-2 text-right font-medium">約可買</th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {facts.holdings.map((holding) => (
            <tr key={holding.stock_id}>
              <td className="px-3 py-2">
                <div className="font-medium">{holding.name}</div>
                <div className="text-xs text-zinc-500">{holding.stock_id}</div>
              </td>
              <td className="px-3 py-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    holding.role === "core"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                  }`}
                >
                  {holding.role === "core" ? "核心 ETF" : "衛星個股"}
                </span>
              </td>
              <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">
                {holding.sector_label ?? holding.sector}
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100"
                      style={{ width: `${holding.weight_pct}%` }}
                    />
                  </div>
                  <span className="font-medium">{holding.weight_pct}%</span>
                </div>
              </td>
              {hasAmount ? (
                <>
                  <td className="px-3 py-2 text-right">
                    {formatTwd(holding.allocation_twd)}
                  </td>
                  <td className="px-3 py-2 text-right text-zinc-600 dark:text-zinc-300">
                    {holding.est_shares ? `約 ${holding.est_shares} 股` : "—"}
                  </td>
                </>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PortfolioResultView({
  result,
  narrativePending,
}: {
  result: PortfolioResult;
  narrativePending?: boolean;
}) {
  const { facts } = result;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-medium">
          {facts.profile_label}投資組合建議
        </h2>
        {facts.trade_date ? (
          <span className="text-xs text-zinc-500">資料日期 {facts.trade_date}</span>
        ) : null}
      </div>

      <SummaryCard facts={facts} />

      {facts.warnings.length > 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-medium">提醒</p>
          <ul className="mt-1 list-disc pl-5">
            {facts.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          持股配置
        </h3>
        <HoldingsTable facts={facts} />
      </div>

      {result.narrative ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <MarkdownReport markdown={result.narrative} />
        </div>
      ) : narrativePending ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700">
          白話說明產生中，請稍候…（配置已可先參考）
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700">
          白話說明尚未產生。
        </div>
      )}

      {facts.excluded.length > 0 ? (
        <details className="rounded-xl border border-zinc-200 dark:border-zinc-800">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
            未納入的股票（{facts.excluded.length}）
            <span className="ml-2 text-xs font-normal text-zinc-500">
              （點擊展開，了解為什麼沒選）
            </span>
          </summary>
          <ul className="divide-y divide-zinc-100 px-4 pb-3 text-sm dark:divide-zinc-800">
            {facts.excluded.map((item) => (
              <li key={item.stock_id} className="flex justify-between gap-3 py-2">
                <span className="text-zinc-700 dark:text-zinc-300">
                  {item.name}（{item.stock_id}）
                </span>
                <span className="text-right text-xs text-zinc-500">{item.reason}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <p className="text-xs text-zinc-400">
        本內容由系統規則與 AI 產生，僅供教育參考、非投資建議，投資有風險。
      </p>
    </div>
  );
}

type PortfolioGroup = {
  year: string;
  months: Array<{
    month: string;
    days: Array<{
      day: string;
      date: string;
      items: PortfolioRecord[];
    }>;
  }>;
};

function portfolioDateKey(record: PortfolioRecord): string {
  if (record.tradeDate) {
    return record.tradeDate;
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(record.createdAt));
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function groupPortfoliosByDate(records: PortfolioRecord[]): PortfolioGroup[] {
  const byDate = new Map<string, PortfolioRecord[]>();
  for (const record of records) {
    const key = portfolioDateKey(record);
    const list = byDate.get(key);
    if (list) {
      list.push(record);
    } else {
      byDate.set(key, [record]);
    }
  }

  const dates = Array.from(byDate.keys()).sort((a, b) => b.localeCompare(a));
  const byYear = new Map<string, Map<string, Map<string, PortfolioRecord[]>>>();

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
            .map(([day, items]) => ({
              day,
              date: `${year}-${month}-${day}`,
              items,
            })),
        })),
    }));
}

function profileLabel(profile: PortfolioProfile): string {
  return PROFILES.find((item) => item.id === profile)?.label ?? profile;
}

function statusLabel(status: PortfolioRecord["status"]): string {
  switch (status) {
    case "done":
      return "完成";
    case "failed":
      return "失敗";
    case "gating":
      return "產生中";
    default:
      return "排隊中";
  }
}

export function TwPortfolioDashboard() {
  const [profile, setProfile] = useState<PortfolioProfile>("conservative");
  const [amount, setAmount] = useState("300000");
  const [result, setResult] = useState<PortfolioResult | null>(null);
  const [records, setRecords] = useState<PortfolioRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [narrativePending, setNarrativePending] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [openYears, setOpenYears] = useState<Record<string, boolean>>({});
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({});
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({});
  const pollRef = useRef<number | null>(null);

  const grouped = groupPortfoliosByDate(records);

  async function loadRecords() {
    try {
      const response = await fetch("/api/portfolio");
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as { portfolios: PortfolioRecord[] };
      setRecords(payload.portfolios);
    } finally {
      setInitialLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void loadRecords();
    });
    return () => {
      if (pollRef.current !== null) {
        window.clearTimeout(pollRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (records.length === 0) {
      return;
    }
    const latest = records[0];
    const key = portfolioDateKey(latest);
    const [year, month] = key.split("-");
    if (!year || !month) {
      return;
    }
    queueMicrotask(() => {
      setOpenYears((prev) => ({ ...prev, [year]: true }));
      setOpenMonths((prev) => ({ ...prev, [`${year}-${month}`]: true }));
      setOpenDays((prev) => ({ ...prev, [key]: true }));
    });
  }, [records]);

  function applyRecord(record: PortfolioRecord) {
    setSelectedId(record.id);
    const converted = portfolioRecordToResult(record);
    if (converted) {
      setResult(converted);
    }
    if (record.status === "done") {
      setNarrativePending(false);
      setLoading(false);
      return;
    }
    if (record.status === "failed") {
      setNarrativePending(false);
      setLoading(false);
      setError(record.error ?? "白話說明產生失敗");
      return;
    }
    setNarrativePending(true);
    setLoading(true);
  }

  async function pollRecord(id: string) {
    try {
      const response = await fetch(`/api/portfolio/${id}`);
      const payload = (await response.json()) as {
        portfolio?: PortfolioRecord;
        error?: string;
      };
      if (!response.ok || !payload.portfolio) {
        setError(payload.error ?? "無法取得組合任務狀態");
        setLoading(false);
        setNarrativePending(false);
        return;
      }
      applyRecord(payload.portfolio);
      setRecords((prev) => {
        const others = prev.filter((item) => item.id !== payload.portfolio!.id);
        return [payload.portfolio!, ...others];
      });
      if (
        payload.portfolio.status !== "done" &&
        payload.portfolio.status !== "failed"
      ) {
        pollRef.current = window.setTimeout(() => {
          void pollRecord(id);
        }, 3000);
      } else {
        void loadRecords();
      }
    } catch {
      setError("網路錯誤，請稍後再試");
      setLoading(false);
      setNarrativePending(false);
    }
  }

  function selectHistory(record: PortfolioRecord) {
    if (pollRef.current !== null) {
      window.clearTimeout(pollRef.current);
      pollRef.current = null;
    }
    setError("");
    applyRecord(record);
    if (record.status !== "done" && record.status !== "failed") {
      pollRef.current = window.setTimeout(() => {
        void pollRecord(record.id);
      }, 3000);
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");

    const amountNum = Number(amount);
    if (
      !amount ||
      !Number.isFinite(amountNum) ||
      !Number.isInteger(amountNum) ||
      amountNum < MIN_AMOUNT
    ) {
      setError(`投入金額須為整數，且不得低於 ${MIN_AMOUNT.toLocaleString("zh-TW")} 元`);
      return;
    }

    if (pollRef.current !== null) {
      window.clearTimeout(pollRef.current);
      pollRef.current = null;
    }

    setLoading(true);
    setNarrativePending(false);
    setSelectedId(null);
    try {
      const response = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, amount: amountNum }),
      });
      const payload = (await response.json()) as {
        portfolio?: PortfolioRecord;
        error?: string;
      };
      if (!response.ok || !payload.portfolio) {
        setError(payload.error ?? "無法產生投資組合建議");
        setResult(null);
        setLoading(false);
        return;
      }

      applyRecord(payload.portfolio);
      setRecords((prev) => [payload.portfolio!, ...prev]);
      if (
        payload.portfolio.status !== "done" &&
        payload.portfolio.status !== "failed"
      ) {
        pollRef.current = window.setTimeout(() => {
          void pollRecord(payload.portfolio!.id);
        }, 3000);
      } else {
        setLoading(false);
        void loadRecords();
      }
    } catch {
      setError("網路錯誤，請稍後再試");
      setResult(null);
      setLoading(false);
      setNarrativePending(false);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("確定刪除此組合建議紀錄？")) {
      return;
    }
    setDeletingId(id);
    try {
      const response = await fetch(`/api/portfolio/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        setError(payload.error ?? "無法刪除紀錄");
        return;
      }
      setRecords((prev) => prev.filter((item) => item.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
        setResult(null);
        setNarrativePending(false);
      }
    } catch {
      setError("網路錯誤，請稍後再試");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex w-full flex-col gap-8 lg:flex-row lg:items-start">
      <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-72">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold">我的組合紀錄</h2>
          <p className="mt-1 text-xs text-zinc-500">依資料日期資料夾瀏覽，可直接回看，不必重跑。</p>

          {initialLoading ? (
            <div className="mt-4 animate-pulse space-y-2">
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-8 rounded bg-zinc-100 dark:bg-zinc-900" />
              ))}
            </div>
          ) : records.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">尚無紀錄，請先產生一組建議。</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm">
              {grouped.map((yearGroup) => {
                const yearCount = yearGroup.months.reduce(
                  (sum, month) =>
                    sum + month.days.reduce((acc, day) => acc + day.items.length, 0),
                  0,
                );
                const isYearOpen = openYears[yearGroup.year] ?? false;
                return (
                  <li key={yearGroup.year}>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenYears((prev) => ({
                          ...prev,
                          [yearGroup.year]: !(prev[yearGroup.year] ?? false),
                        }))
                      }
                      className="flex w-full items-center justify-between gap-2 text-left"
                    >
                      <span className="flex items-center gap-1.5 font-medium">
                        <span className="text-zinc-500">{isYearOpen ? "▾" : "▸"}</span>
                        {yearGroup.year}
                      </span>
                      <span className="text-xs text-zinc-500">{yearCount}</span>
                    </button>
                    {isYearOpen ? (
                      <ul className="mt-1 space-y-1 pl-4">
                        {yearGroup.months.map((monthGroup) => {
                          const monthKey = `${yearGroup.year}-${monthGroup.month}`;
                          const monthCount = monthGroup.days.reduce(
                            (sum, day) => sum + day.items.length,
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
                                className="flex w-full items-center justify-between gap-2 text-left"
                              >
                                <span className="flex items-center gap-1.5">
                                  <span className="text-zinc-500">
                                    {isMonthOpen ? "▾" : "▸"}
                                  </span>
                                  {monthGroup.month} 月
                                </span>
                                <span className="text-xs text-zinc-500">{monthCount}</span>
                              </button>
                              {isMonthOpen ? (
                                <ul className="mt-1 space-y-1 pl-4">
                                  {monthGroup.days.map((dayGroup) => {
                                    const isDayOpen = openDays[dayGroup.date] ?? false;
                                    return (
                                      <li key={dayGroup.date}>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setOpenDays((prev) => ({
                                              ...prev,
                                              [dayGroup.date]: !(
                                                prev[dayGroup.date] ?? false
                                              ),
                                            }))
                                          }
                                          className="flex w-full items-center justify-between gap-2 text-left"
                                        >
                                          <span className="flex items-center gap-1.5">
                                            <span className="text-zinc-500">
                                              {isDayOpen ? "▾" : "▸"}
                                            </span>
                                            {dayGroup.day} 日
                                          </span>
                                          <span className="text-xs text-zinc-500">
                                            {dayGroup.items.length}
                                          </span>
                                        </button>
                                        {isDayOpen ? (
                                          <ul className="mt-1 space-y-1 pl-3">
                                            {dayGroup.items.map((item) => {
                                              const active = selectedId === item.id;
                                              return (
                                                <li key={item.id}>
                                                  <div
                                                    className={`flex items-start gap-1 rounded-lg border px-2 py-1.5 ${
                                                      active
                                                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                                                        : "border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-900"
                                                    }`}
                                                  >
                                                    <button
                                                      type="button"
                                                      onClick={() => selectHistory(item)}
                                                      className="min-w-0 flex-1 text-left"
                                                    >
                                                      <p className="truncate text-xs font-medium">
                                                        {profileLabel(item.profile)}
                                                      </p>
                                                      <p
                                                        className={`truncate text-[11px] ${
                                                          active
                                                            ? "text-white/80 dark:text-zinc-900/70"
                                                            : "text-zinc-500"
                                                        }`}
                                                      >
                                                        {item.amount.toLocaleString("zh-TW")} 元 ·{" "}
                                                        {statusLabel(item.status)}
                                                      </p>
                                                    </button>
                                                    <button
                                                      type="button"
                                                      onClick={() => void onDelete(item.id)}
                                                      disabled={deletingId === item.id}
                                                      className={`shrink-0 text-[11px] ${
                                                        active
                                                          ? "text-white/80 hover:text-white dark:text-zinc-900/70"
                                                          : "text-red-500 hover:text-red-600"
                                                      }`}
                                                    >
                                                      {deletingId === item.id ? "…" : "刪"}
                                                    </button>
                                                  </div>
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
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-8">
        <div>
          <h2 className="text-xl font-semibold">選股組合建議</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            輸入投入金額、選擇風險型態後產生建議；完成的紀錄會依日期出現在左側，之後可直接回看。
          </p>
        </div>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <div>
              <label className="mb-2 block text-sm font-medium">投入金額（新台幣）</label>
              <input
                type="number"
                min={MIN_AMOUNT}
                step={1}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="例如 300000"
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 sm:max-w-[16rem] dark:border-zinc-700 dark:bg-black"
              />
              <p className="mt-1 text-xs text-zinc-500">
                最低 {MIN_AMOUNT.toLocaleString("zh-TW")} 元，可輸入任意整數金額
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {AMOUNT_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount(String(preset))}
                    className="rounded-full border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                  >
                    {preset.toLocaleString("zh-TW")}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">風險型態</label>
              <ProfileSelector value={profile} onChange={setProfile} disabled={loading} />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
              >
                {loading
                  ? narrativePending
                    ? "白話說明產生中…"
                    : "產生中…"
                  : "產生投資組合建議"}
              </button>
            </div>
          </form>
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          {narrativePending ? (
            <p className="mt-3 text-xs text-zinc-500">任務進行中，每 3 秒自動更新…</p>
          ) : null}
        </section>

        {loading && !result ? (
          <div className="animate-pulse rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="h-5 w-40 rounded bg-zinc-100 dark:bg-zinc-900" />
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[0, 1, 2, 3, 4, 5].map((cell) => (
                <div key={cell} className="h-14 rounded-lg bg-zinc-100 dark:bg-zinc-900" />
              ))}
            </div>
          </div>
        ) : result ? (
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <PortfolioResultView
              result={result}
              narrativePending={narrativePending}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
