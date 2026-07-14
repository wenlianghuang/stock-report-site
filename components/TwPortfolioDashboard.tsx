"use client";

import { FormEvent, useState } from "react";
import { MarkdownReport } from "@/components/MarkdownReport";
import type {
  PortfolioFacts,
  PortfolioProfile,
  PortfolioResult,
} from "@/lib/types";

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

function PortfolioResultView({ result }: { result: PortfolioResult }) {
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
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700">
          白話說明尚未產生。可於後端執行
          <code className="mx-1 rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">
            python main.py portfolio-gate {facts.profile}
          </code>
          產生 AI 說明後再回來查看；上方配置為系統規則即時計算，可直接參考。
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

export function TwPortfolioDashboard() {
  const [profile, setProfile] = useState<PortfolioProfile>("conservative");
  const [amount, setAmount] = useState("300000");
  const [result, setResult] = useState<PortfolioResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

    setLoading(true);
    try {
      const params = new URLSearchParams({
        profile,
        amount: String(amountNum),
      });
      const response = await fetch(`/api/portfolio?${params.toString()}`);
      const payload = (await response.json()) as {
        portfolio?: PortfolioResult;
        error?: string;
      };
      if (!response.ok || !payload.portfolio) {
        setError(payload.error ?? "無法產生投資組合建議");
        setResult(null);
        return;
      }
      setResult(payload.portfolio);
    } catch {
      setError("網路錯誤，請稍後再試");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <div>
        <h2 className="text-xl font-semibold">選股組合建議</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          輸入你的投入金額、選擇風險型態，系統會依當日籌碼即時算出一組以 ETF
          為核心的新手投資組合，並附上白話說明。
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
              {loading ? "產生中…" : "產生投資組合建議"}
            </button>
          </div>
        </form>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
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
          <PortfolioResultView result={result} />
        </section>
      ) : null}
    </div>
  );
}
