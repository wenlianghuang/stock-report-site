"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StockChartModal } from "@/components/StockChartModal";
import type { ConceptGroup, TriageResult, TriageRow } from "@/lib/agent-client";

type HoldingChip = {
  stockId: string;
  shareCount: number;
  avgCost: number;
  usesMargin?: boolean;
};

type Source = "holdings" | "theme" | "custom";

const MAX_STOCKS = 60;

const REGIME_LABEL: Record<string, string> = {
  accumulation: "偏多",
  distribution: "偏空",
  mixed: "中性",
  unknown: "資料不足",
};

function regimeTone(regime: string): string {
  if (regime === "accumulation") {
    return "text-rose-600 dark:text-rose-400";
  }
  if (regime === "distribution") {
    return "text-emerald-700 dark:text-emerald-400";
  }
  return "text-zinc-700 dark:text-zinc-300";
}

function choiceClass(active: boolean): string {
  return active
    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
    : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900";
}

function parseCustomIds(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\s,，、]+/)
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ];
}

export function TwTriageBoard({
  themeId: controlledThemeId,
  source: controlledSource,
  embedded = false,
}: {
  themeId?: string;
  source?: Source;
  embedded?: boolean;
} = {}) {
  const router = useRouter();
  const [holdings, setHoldings] = useState<HoldingChip[]>([]);
  const [themes, setThemes] = useState<ConceptGroup[]>([]);
  const [tradeDate, setTradeDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [source, setSource] = useState<Source>(controlledSource ?? "holdings");
  const [themeId, setThemeId] = useState(controlledThemeId ?? "");
  const [customText, setCustomText] = useState("");
  const [topK, setTopK] = useState(3);
  const [fetchMissing, setFetchMissing] = useState(false);

  const [result, setResult] = useState<TriageResult | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [creating, setCreating] = useState("");
  const [createError, setCreateError] = useState("");
  const [chartStock, setChartStock] = useState<{ stockId: string; stockName: string } | null>(
    null,
  );
  if (controlledThemeId && themeId !== controlledThemeId) {
    setThemeId(controlledThemeId);
    setResult(null);
    setRunError("");
  }
  if (controlledSource && source !== controlledSource) {
    setSource(controlledSource);
    setResult(null);
    setRunError("");
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [holdingResponse, themeResponse, dateResponse] = await Promise.all([
          fetch("/api/holdings/list"),
          fetch("/api/concept-groups"),
          fetch("/api/trading-date"),
        ]);
        const holdingPayload = (await holdingResponse.json()) as {
          holdings?: HoldingChip[];
          error?: string;
        };
        if (!holdingResponse.ok) {
          throw new Error(holdingPayload.error || "無法載入持股");
        }
        let nextThemes: ConceptGroup[] = [];
        if (themeResponse.ok) {
          const themePayload = (await themeResponse.json()) as { themes?: ConceptGroup[] };
          nextThemes = themePayload.themes ?? [];
        }
        let nextDate = "";
        if (dateResponse.ok) {
          const datePayload = (await dateResponse.json()) as { tradeDate?: string };
          nextDate = datePayload.tradeDate ?? "";
        }
        if (cancelled) {
          return;
        }
        const nextHoldings = holdingPayload.holdings ?? [];
        setHoldings(nextHoldings);
        setThemes(nextThemes);
        setThemeId((current) => current || nextThemes[0]?.themeId || "");
        setTradeDate(nextDate);
        setSource((current) => {
          if (current !== "holdings" || nextHoldings.length > 0) return current;
          return nextThemes.length > 0 ? "theme" : "custom";
        });
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "無法載入");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const holdingById = useMemo(
    () => new Map(holdings.map((holding) => [holding.stockId, holding])),
    [holdings],
  );

  const scopeIds = useMemo(() => {
    if (source === "holdings") {
      return holdings.map((holding) => holding.stockId);
    }
    if (source === "theme") {
      const theme = themes.find((item) => item.themeId === themeId);
      return theme ? theme.members.map((member) => member.stockId) : [];
    }
    return parseCustomIds(customText);
  }, [source, holdings, themes, themeId, customText]);

  const invalidCustom =
    source === "custom" && scopeIds.some((stockId) => !/^\d{4,6}$/.test(stockId));
  const tooMany = scopeIds.length > MAX_STOCKS;
  const canRun = !running && scopeIds.length > 0 && !invalidCustom && !tooMany;

  async function runTriage() {
    if (!canRun) {
      return;
    }
    setRunning(true);
    setRunError("");
    setCreateError("");
    try {
      const params = new URLSearchParams();
      if (source !== "holdings") {
        params.set("ids", scopeIds.join(","));
      }
      if (tradeDate) {
        params.set("date", tradeDate);
      }
      params.set("topK", String(topK));
      if (fetchMissing) {
        params.set("fetch", "true");
      }
      const response = await fetch(`/api/triage?${params.toString()}`);
      const payload = (await response.json()) as { triage?: TriageResult; error?: string };
      if (!response.ok || !payload.triage) {
        throw new Error(payload.error || "無法分流");
      }
      setResult(payload.triage);
    } catch (error) {
      setResult(null);
      setRunError(error instanceof Error ? error.message : "無法分流");
    } finally {
      setRunning(false);
    }
  }

  async function createReport(row: TriageRow) {
    if (creating) {
      return;
    }
    setCreating(row.stockId);
    setCreateError("");
    const holding = holdingById.get(row.stockId);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockId: row.stockId,
          tradeDate: result?.tradeDate || tradeDate || undefined,
          isHolding: Boolean(holding),
          shareCount: holding?.shareCount,
          avgCost: holding?.avgCost,
          usesMargin: holding?.usesMargin ?? false,
        }),
      });
      const payload = (await response.json()) as { report?: { id: string }; error?: string };
      if (!response.ok || !payload.report) {
        throw new Error(payload.error || "無法建立報告");
      }
      router.push(`/reports/${payload.report.id}`);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "無法建立報告");
      setCreating("");
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">載入持股與主題…</p>;
  }

  if (loadError) {
    return <p className="text-sm text-red-600">{loadError}</p>;
  }

  const rows = result?.rows ?? [];
  const pickedCount = result?.picks.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <h2 className="text-lg font-medium">今日分流</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          深度報告每檔要跑 agy 一到兩分鐘。這裡先用籌碼數字掃一遍，和更早一份資料比，列出今天狀態有變化的股票：型態翻轉、突破或跌破 20 日、新出現的背離、外資連買賣中斷、持有中且偏空。分數代表「值得看」，不是漲跌預測。要不要產報告由你決定。
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        {embedded ? null : (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-zinc-500">範圍</span>
            <button
              type="button"
              onClick={() => setSource("holdings")}
              disabled={holdings.length === 0}
              className={`rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50 ${choiceClass(source === "holdings")}`}
            >
              我的持股（{holdings.length}）
            </button>
            <button
              type="button"
              onClick={() => setSource("theme")}
              disabled={themes.length === 0}
              className={`rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50 ${choiceClass(source === "theme")}`}
            >
              主題池
            </button>
            <button
              type="button"
              onClick={() => setSource("custom")}
              className={`rounded-lg border px-3 py-1.5 text-sm ${choiceClass(source === "custom")}`}
            >
              自訂代號
            </button>
          </div>
        )}

        {!embedded && source === "theme" ? (
          <div className="flex flex-wrap gap-2">
            {themes.map((theme) => (
              <button
                key={theme.themeId}
                type="button"
                onClick={() => setThemeId(theme.themeId)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${choiceClass(themeId === theme.themeId)}`}
              >
                {theme.label}
                <span className="ml-1.5 text-xs opacity-70">{theme.members.length}</span>
              </button>
            ))}
          </div>
        ) : null}

        {source === "custom" ? (
          <div className="flex flex-col gap-1">
            <textarea
              value={customText}
              onChange={(event) => setCustomText(event.target.value)}
              rows={2}
              placeholder="例如：2330 2454 3037 2317（空白、逗號或頓號分隔）"
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            {invalidCustom ? (
              <p className="text-xs text-red-600">代號須為 4～6 位數</p>
            ) : null}
          </div>
        ) : null}

        {source === "holdings" && holdings.length > 0 ? (
          <p className="text-xs text-zinc-500">
            {holdings.map((holding) => holding.stockId).join("、")}
          </p>
        ) : null}

        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-500">交易日</span>
            <input
              type="date"
              value={tradeDate}
              onChange={(event) => setTradeDate(event.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-500">最多建議深挖</span>
            <select
              value={topK}
              onChange={(event) => setTopK(Number(event.target.value))}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((value) => (
                <option key={value} value={value}>
                  {value} 檔
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={fetchMissing}
              onChange={(event) => setFetchMissing(event.target.checked)}
            />
            <span>先補抓缺的籌碼資料（較慢）</span>
          </label>
          <button
            type="button"
            onClick={() => void runTriage()}
            disabled={!canRun}
            className="ml-auto rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {running ? "分流中…" : `開始分流（${scopeIds.length} 檔）`}
          </button>
        </div>
        {tooMany ? (
          <p className="text-xs text-red-600">一次最多 {MAX_STOCKS} 檔</p>
        ) : null}
      </div>

      {runError ? <p className="text-sm text-red-600">{runError}</p> : null}
      {createError ? <p className="text-sm text-red-600">{createError}</p> : null}

      {result ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            <span className="font-medium">交易日 {result.tradeDate ?? "—"}</span>
            <span className="ml-2 text-zinc-500">
              掃描 {rows.length} 檔，建議深挖 {pickedCount} 檔
              {result.missing.length > 0 ? `，缺資料 ${result.missing.length} 檔` : ""}
            </span>
          </p>

          {result.notes.length > 0 ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <ul className="list-disc pl-5">
                {result.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {pickedCount === 0 ? (
            <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
              今天沒有需要深挖的標的。下表每檔都和更早一份資料比過，沒有觸發條件。
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
                <tr>
                  <th className="px-3 py-2 font-medium">建議</th>
                  <th className="px-3 py-2 font-medium">分數</th>
                  <th className="px-3 py-2 font-medium">股票</th>
                  <th className="px-3 py-2 font-medium">籌碼型態</th>
                  <th className="px-3 py-2 font-medium">觸發條件</th>
                  <th className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.stockId}
                    className={`border-b border-zinc-100 align-top last:border-0 dark:border-zinc-900 ${
                      row.picked ? "bg-amber-50/60 dark:bg-amber-950/20" : ""
                    }`}
                  >
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${
                          row.picked
                            ? "bg-amber-500 text-white"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        {row.picked ? "深挖" : "略過"}
                      </span>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{row.score}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">
                        {row.stockName || row.stockId}
                        <span className="ml-1 text-xs text-zinc-500">{row.stockId}</span>
                      </div>
                      {row.held ? (
                        <span className="text-xs text-sky-700 dark:text-sky-400">持有</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      {row.hasCsv ? (
                        <>
                          <span className={regimeTone(row.chipRegime)}>
                            {REGIME_LABEL[row.chipRegime] ?? row.chipRegime}
                          </span>
                          {row.prevChipRegime && row.prevChipRegime !== row.chipRegime ? (
                            <span className="ml-1 text-xs text-zinc-500">
                              （前：{REGIME_LABEL[row.prevChipRegime] ?? row.prevChipRegime}）
                            </span>
                          ) : null}
                          <div className="text-xs text-zinc-500">
                            {row.prevTradeDate ? `對照 ${row.prevTradeDate}` : "沒有更早資料"}
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-zinc-500">當日沒有 CSV</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.flags.filter((flag) => flag.code !== "no_baseline").length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {row.flags
                            .filter((flag) => flag.code !== "no_baseline")
                            .map((flag) => (
                              <span
                                key={flag.code}
                                className="rounded-md border border-zinc-200 px-1.5 py-0.5 text-xs dark:border-zinc-700"
                              >
                                {flag.label}
                                <span className="ml-1 text-zinc-400">+{flag.weight}</span>
                              </span>
                            ))}
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-500">沒有新條件</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col items-end gap-1">
                        <button
                          type="button"
                          onClick={() => void createReport(row)}
                          disabled={Boolean(creating)}
                          className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-xs disabled:opacity-50 ${
                            row.picked
                              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                              : "border border-zinc-300 dark:border-zinc-700"
                          }`}
                        >
                          {creating === row.stockId
                            ? "建立中…"
                            : row.held
                              ? "產生報告＋部位"
                              : "產生深度報告"}
                        </button>
                        {row.hasCsv ? (
                          <button
                            type="button"
                            onClick={() =>
                              setChartStock({
                                stockId: row.stockId,
                                stockName: row.stockName || row.stockId,
                              })
                            }
                            className="text-xs text-zinc-500 underline-offset-2 hover:underline"
                          >
                            K 線
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {chartStock ? (
        <StockChartModal
          stockId={chartStock.stockId}
          stockName={chartStock.stockName}
          tradeDate={result?.tradeDate || tradeDate || undefined}
          onClose={() => setChartStock(null)}
        />
      ) : null}
    </div>
  );
}
