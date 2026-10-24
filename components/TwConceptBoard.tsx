"use client";

import { useEffect, useMemo, useState } from "react";
import { StockChartModal } from "@/components/StockChartModal";
import type { ConceptBoard, ConceptBoardRow, ConceptGroup, ConceptGroupBrief } from "@/lib/agent-client";

type HoldingChip = {
  stockId: string;
  shareCount: number;
  avgCost: number;
};

type Section = {
  themeId: string;
  label: string;
  riskHint?: string;
  rows: ConceptBoardRow[];
};

function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

function formatLots(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${Math.round(value).toLocaleString("zh-TW")}`;
}

function formatPrice(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return value.toLocaleString("zh-TW", { maximumFractionDigits: 2 });
}

function toneClass(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value) || value === 0) {
    return "text-zinc-800 dark:text-zinc-100";
  }
  return value > 0
    ? "text-rose-600 dark:text-rose-400"
    : "text-emerald-700 dark:text-emerald-400";
}

function sortRows(rows: ConceptBoardRow[], holdingIds: Set<string>): ConceptBoardRow[] {
  return [...rows].sort((a, b) => {
    const aHeld = holdingIds.has(a.stockId) ? 0 : 1;
    const bHeld = holdingIds.has(b.stockId) ? 0 : 1;
    if (aHeld !== bHeld) {
      return aHeld - bHeld;
    }
    if (a.todayChangePct == null && b.todayChangePct == null) {
      return a.stockId.localeCompare(b.stockId);
    }
    if (a.todayChangePct == null) {
      return 1;
    }
    if (b.todayChangePct == null) {
      return -1;
    }
    return b.todayChangePct - a.todayChangePct;
  });
}

function preferredTheme(themes: ConceptGroup[], holdingIds: Set<string>): string | null {
  let best: { themeId: string; count: number } | null = null;
  for (const theme of themes) {
    const count = theme.members.filter((member) => holdingIds.has(member.stockId)).length;
    if (count > 0 && (best == null || count > best.count)) {
      best = { themeId: theme.themeId, count };
    }
  }
  return best?.themeId ?? themes[0]?.themeId ?? null;
}

export function TwConceptBoard() {
  const [themes, setThemes] = useState<ConceptGroup[]>([]);
  const [holdings, setHoldings] = useState<HoldingChip[]>([]);
  const [tradeDate, setTradeDate] = useState("");
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [holdingsOnly, setHoldingsOnly] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [narrow, setNarrow] = useState(false);
  const [board, setBoard] = useState<ConceptBoard | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [boardError, setBoardError] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [boardLoading, setBoardLoading] = useState(false);
  const [brief, setBrief] = useState<ConceptGroupBrief | null>(null);
  const [briefFor, setBriefFor] = useState("");
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefError, setBriefError] = useState("");
  const [chartStock, setChartStock] = useState<{ stockId: string; stockName: string } | null>(
    null,
  );

  const holdingIds = useMemo(
    () => new Set(holdings.map((holding) => holding.stockId)),
    [holdings],
  );
  const holdingKey = holdings.map((holding) => holding.stockId).join(",");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCatalogLoading(true);
      setCatalogError("");
      try {
        const [themeResponse, holdingResponse, dateResponse] = await Promise.all([
          fetch("/api/concept-groups"),
          fetch("/api/holdings/list"),
          fetch("/api/trading-date"),
        ]);
        const themePayload = (await themeResponse.json()) as {
          themes?: ConceptGroup[];
          error?: string;
        };
        const holdingPayload = (await holdingResponse.json()) as {
          holdings?: HoldingChip[];
          error?: string;
        };
        if (!themeResponse.ok) {
          throw new Error(themePayload.error || "無法載入族群");
        }
        if (!holdingResponse.ok) {
          throw new Error(holdingPayload.error || "無法載入持股");
        }
        let nextDate = "";
        if (dateResponse.ok) {
          const datePayload = (await dateResponse.json()) as { tradeDate?: string };
          nextDate = datePayload.tradeDate ?? "";
        }
        if (cancelled) {
          return;
        }
        const nextThemes = themePayload.themes ?? [];
        const nextHoldings = holdingPayload.holdings ?? [];
        setThemes(nextThemes);
        setHoldings(nextHoldings);
        setTradeDate(nextDate);
        setSelectedTheme(
          preferredTheme(nextThemes, new Set(nextHoldings.map((item) => item.stockId))),
        );
      } catch (error) {
        if (!cancelled) {
          setCatalogError(error instanceof Error ? error.message : "無法載入族群");
        }
      } finally {
        if (!cancelled) {
          setCatalogLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const themeForFetch = holdingsOnly ? "" : (selectedTheme ?? "");

  useEffect(() => {
    if (catalogLoading || catalogError) {
      return;
    }
    if (!holdingsOnly && !themeForFetch) {
      return;
    }
    if (holdingsOnly && holdings.length === 0) {
      queueMicrotask(() => {
        setBoard(null);
        setBoardLoading(false);
        setBoardError("");
      });
      return;
    }

    let cancelled = false;
    const params = new URLSearchParams();
    if (tradeDate) {
      params.set("date", tradeDate);
    }
    params.set("fetch", "true");
    if (holdingsOnly) {
      params.set("ids", holdingKey);
    } else if (themeForFetch) {
      params.set("theme", themeForFetch);
    }

    (async () => {
      setBoard(null);
      setBoardLoading(true);
      setBoardError("");
      try {
        const response = await fetch(`/api/concept-board?${params.toString()}`);
        const payload = (await response.json()) as { board?: ConceptBoard; error?: string };
        if (!response.ok || !payload.board) {
          throw new Error(payload.error || "無法載入族群狀態");
        }
        if (!cancelled) {
          setBoard(payload.board);
        }
      } catch (error) {
        if (!cancelled) {
          setBoard(null);
          setBoardError(error instanceof Error ? error.message : "無法載入族群狀態");
        }
      } finally {
        if (!cancelled) {
          setBoardLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [catalogLoading, catalogError, holdingsOnly, themeForFetch, tradeDate, holdingKey, holdings.length]);

  const narrowed = narrow && checked.size >= 2;
  const boardRows = useMemo(() => {
    if (holdingsOnly && holdings.length === 0) {
      return [];
    }
    return board?.rows ?? [];
  }, [board, holdingsOnly, holdings.length]);

  const picked = useMemo(() => {
    const rows = boardRows.filter((row) => checked.has(row.stockId));
    return sortRows(rows, holdingIds);
  }, [boardRows, checked, holdingIds]);
  const pickedKey = [...picked.map((row) => row.stockId)].sort().join(",");
  const visibleBrief = brief && briefFor === pickedKey ? brief : null;
  const briefRows = visibleBrief?.rows ?? [];
  const briefSections = (visibleBrief?.sections ?? []).filter((section) =>
    section.id === "observe" || section.id === "reason" || section.id === "conclusion",
  );
  const briefParagraphs = visibleBrief?.paragraphs ?? [];

  async function writeBrief() {
    if (picked.length < 2) {
      return;
    }
    const ids = picked.map((row) => row.stockId);
    const key = [...ids].sort().join(",");
    setBriefLoading(true);
    setBriefError("");
    try {
      const params = new URLSearchParams();
      params.set("ids", ids.join(","));
      const held = ids.filter((stockId) => holdingIds.has(stockId));
      if (held.length > 0) {
        params.set("held", held.join(","));
      }
      if (tradeDate) {
        params.set("date", tradeDate);
      }
      const response = await fetch(`/api/concept-board/brief?${params.toString()}`);
      const payload = (await response.json()) as { brief?: ConceptGroupBrief; error?: string };
      if (!response.ok || !payload.brief) {
        throw new Error(payload.error || "無法產生對照");
      }
      setBrief({
        ...payload.brief,
        paragraphs: payload.brief.paragraphs ?? [],
        sections: payload.brief.sections ?? [],
        rows: payload.brief.rows ?? [],
        missing: payload.brief.missing ?? [],
      });
      setBriefFor(key);
    } catch (error) {
      setBrief(null);
      setBriefFor("");
      setBriefError(error instanceof Error ? error.message : "無法產生對照");
    } finally {
      setBriefLoading(false);
    }
  }

  const sections = useMemo<Section[]>(() => {
    const source = narrowed ? picked : boardRows;
    if (!holdingsOnly) {
      const theme = themes.find((item) => item.themeId === selectedTheme);
      return [
        {
          themeId: selectedTheme ?? "theme",
          label: theme?.label ?? "族群",
          riskHint: theme?.riskHint,
          rows: sortRows(source, holdingIds),
        },
      ];
    }

    const grouped = new Map<string, ConceptBoardRow[]>();
    for (const row of source) {
      const ids = row.themeIds.length > 0 ? row.themeIds : ["_other"];
      for (const themeId of ids) {
        if (selectedTheme && themeId !== selectedTheme) {
          continue;
        }
        const list = grouped.get(themeId) ?? [];
        list.push(row);
        grouped.set(themeId, list);
      }
    }
    const ordered: Section[] = themes
      .filter((theme) => grouped.has(theme.themeId))
      .map((theme) => ({
        themeId: theme.themeId,
        label: theme.label,
        riskHint: theme.riskHint,
        rows: sortRows(grouped.get(theme.themeId) ?? [], holdingIds),
      }));
    if (grouped.has("_other")) {
      ordered.push({
        themeId: "_other",
        label: "未列入主題",
        rows: sortRows(grouped.get("_other") ?? [], holdingIds),
      });
    }
    return ordered;
  }, [boardRows, holdingsOnly, holdingIds, narrowed, picked, selectedTheme, themes]);

  function resetSelection() {
    setChecked(new Set());
    setNarrow(false);
  }

  function onSelectTheme(themeId: string) {
    resetSelection();
    if (holdingsOnly && selectedTheme === themeId) {
      setSelectedTheme(null);
      return;
    }
    setSelectedTheme(themeId);
  }

  function onToggleHoldings() {
    resetSelection();
    setHoldingsOnly((current) => {
      const next = !current;
      if (next) {
        setSelectedTheme(null);
      } else if (!selectedTheme) {
        setSelectedTheme(preferredTheme(themes, holdingIds));
      }
      return next;
    });
  }

  function toggleChecked(stockId: string) {
    const next = new Set(checked);
    if (next.has(stockId)) {
      next.delete(stockId);
    } else {
      next.add(stockId);
    }
    if (next.size < 2) {
      setNarrow(false);
    }
    setChecked(next);
  }

  async function refillMissing() {
    const params = new URLSearchParams();
    if (tradeDate) {
      params.set("date", tradeDate);
    }
    params.set("fetch", "true");
    if (holdingsOnly) {
      if (!holdingKey) {
        return;
      }
      params.set("ids", holdingKey);
    } else if (selectedTheme) {
      params.set("theme", selectedTheme);
    } else {
      return;
    }
    setBoardLoading(true);
    setBoardError("");
    try {
      const response = await fetch(`/api/concept-board?${params.toString()}`);
      const payload = (await response.json()) as { board?: ConceptBoard; error?: string };
      if (!response.ok || !payload.board) {
        throw new Error(payload.error || "補齊失敗");
      }
      setBoard(payload.board);
    } catch (error) {
      setBoardError(error instanceof Error ? error.message : "補齊失敗");
    } finally {
      setBoardLoading(false);
    }
  }

  if (catalogLoading) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">載入族群目錄…</p>;
  }

  if (catalogError) {
    return <p className="text-sm text-red-600">{catalogError}</p>;
  }

  const boardDate = board?.tradeDate || tradeDate;
  const missingCount = board?.missing.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <h2 className="text-lg font-medium">族群比較</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          先選一個主題，看同日收盤、漲跌、區間報酬、外資、籌碼與相對大盤。缺的列會向 Yahoo 股市補。勾選兩檔以上可依近五個交易日判斷觀察入場，或對持股判斷換檔、續抱。比較信與部位仍在個股報告裡，一次對一檔。
        </p>
        {boardDate ? (
          <p className="text-xs text-zinc-500">交易日 {boardDate}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggleHoldings}
          className={`rounded-lg border px-3 py-1.5 text-sm ${
            holdingsOnly
              ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
              : "border-zinc-200 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          }`}
        >
          只看持股
        </button>
        {themes.map((theme) => {
          const active = selectedTheme === theme.themeId;
          const held = theme.members.some((member) => holdingIds.has(member.stockId));
          return (
            <button
              key={theme.themeId}
              type="button"
              onClick={() => onSelectTheme(theme.themeId)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                active
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
              }`}
            >
              {theme.label}
              {held ? <span className="ml-1.5 text-xs opacity-70">持股</span> : null}
            </button>
          );
        })}
      </div>

      {board?.warnings && board.warnings.length > 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <ul className="list-disc pl-5">
            {board.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {boardError ? <p className="text-sm text-red-600">{boardError}</p> : null}

      {picked.length >= 2 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-sm">
            <span className="font-medium">這一小群：</span>
            {picked.map((row) => row.stockName).join("、")}
            <span className="ml-2 text-zinc-500">
              當日{" "}
              {picked
                .map((row) => `${row.stockName} ${formatPct(row.todayChangePct)}`)
                .join("、")}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void writeBrief()}
              disabled={briefLoading || picked.length > 12}
              className="rounded-lg border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-800 disabled:opacity-60 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {briefLoading ? "正在整理近五個交易日…" : "產生一週對照"}
            </button>
            <button
              type="button"
              onClick={() => setNarrow((value) => !value)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              {narrowed ? "顯示全部" : "只看勾選"}
            </button>
          </div>
        </div>
      ) : null}

      {briefError ? <p className="text-sm text-red-600">{briefError}</p> : null}

      {visibleBrief ? (
        <article className="space-y-2 rounded-xl border border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="text-sm font-semibold">{visibleBrief.title}</h3>
          {briefRows.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-zinc-500">
                <tr>
                  <th className="py-1 pr-3 font-medium">股票</th>
                  <th className="py-1 pr-3 text-right font-medium">五日報酬</th>
                  <th className="py-1 pr-3 text-right font-medium">五日外資</th>
                  <th className="py-1 pr-3 text-right font-medium">五日投信</th>
                  <th className="py-1 text-right font-medium">五日自營</th>
                </tr>
              </thead>
              <tbody>
                {briefRows.map((row) => (
                  <tr key={row.stockId} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="py-1.5 pr-3">
                      {row.stockName}
                      <span className="ml-1 text-xs text-zinc-500">{row.stockId}</span>
                      {row.held ? <span className="ml-1.5 text-xs">持股</span> : null}
                    </td>
                    <td className={`py-1.5 pr-3 text-right tabular-nums ${toneClass(row.weekReturnPct)}`}>
                      {formatPct(row.weekReturnPct)}
                    </td>
                    <td className={`py-1.5 pr-3 text-right tabular-nums ${toneClass(row.weekForeignNetLots)}`}>
                      {formatLots(row.weekForeignNetLots)}
                    </td>
                    <td className={`py-1.5 pr-3 text-right tabular-nums ${toneClass(row.weekTrustNetLots)}`}>
                      {formatLots(row.weekTrustNetLots)}
                    </td>
                    <td className={`py-1.5 text-right tabular-nums ${toneClass(row.weekDealerNetLots)}`}>
                      {formatLots(row.weekDealerNetLots)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          {(briefSections.length > 0 ? briefSections : [{ id: "body", paragraphs: briefParagraphs }]).map(
            (section) =>
              (section.paragraphs ?? []).map((paragraph, index) => (
                <p key={`${section.id}-${index}`} className="text-sm leading-6">
                  {paragraph}
                </p>
              )),
          )}
          <p className="text-xs text-zinc-500">
            勾選的股票平等比較。近五個交易日的報酬，對上外資、投信、自營是否同向。有持股才寫換檔或續抱；沒有持股只寫是否值得觀察入場。不寫張數。
          </p>
        </article>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {boardLoading ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">正在向 Yahoo 股市對齊同日狀態…</p>
        ) : null}
        {missingCount > 0 ? (
          <button
            type="button"
            onClick={() => void refillMissing()}
            disabled={boardLoading}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            再向 Yahoo 補一次（{missingCount}）
          </button>
        ) : null}
      </div>

      {holdingsOnly && holdings.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          尚未登錄持股。可先點一個主題看同業今日狀態，或到台股籌碼報告填寫持股。
        </p>
      ) : null}

      {!boardLoading && sections.length === 0 && !(holdingsOnly && holdings.length === 0) ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">這個範圍沒有可顯示的標的。</p>
      ) : null}

      {!boardLoading
        ? sections.map((section) => (
        <section key={section.themeId} className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="text-sm font-semibold">{section.label}</h3>
            {section.riskHint ? (
              <span className="text-xs text-zinc-500">{section.riskHint}</span>
            ) : null}
          </div>
          <BoardTable
            rows={section.rows}
            holdingIds={holdingIds}
            checked={checked}
            onToggle={toggleChecked}
            onOpen={(row) => setChartStock({ stockId: row.stockId, stockName: row.stockName })}
          />
        </section>
      ))
        : null}

      {chartStock ? (
        <StockChartModal
          stockId={chartStock.stockId}
          stockName={chartStock.stockName}
          tradeDate={boardDate || undefined}
          onClose={() => setChartStock(null)}
        />
      ) : null}
    </div>
  );
}

function BoardTable({
  rows,
  holdingIds,
  checked,
  onToggle,
  onOpen,
}: {
  rows: ConceptBoardRow[];
  holdingIds: Set<string>;
  checked: Set<string>;
  onToggle: (stockId: string) => void;
  onOpen: (row: ConceptBoardRow) => void;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">此主題尚無標的。</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900">
          <tr>
            <th className="px-3 py-2 font-medium">比較</th>
            <th className="px-3 py-2 font-medium">股票</th>
            <th className="px-3 py-2 text-right font-medium">收盤</th>
            <th className="px-3 py-2 text-right font-medium">當日漲跌</th>
            <th className="px-3 py-2 text-right font-medium">區間報酬</th>
            <th className="px-3 py-2 text-right font-medium">外資（張）</th>
            <th className="px-3 py-2 font-medium">籌碼</th>
            <th className="px-3 py-2 font-medium">相對大盤</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {rows.map((row) => {
            const held = holdingIds.has(row.stockId);
            const active = checked.has(row.stockId);
            return (
              <tr
                key={row.stockId}
                className={active ? "bg-zinc-50 dark:bg-zinc-900" : undefined}
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={active}
                    aria-label={`勾選${row.stockName}`}
                    onChange={() => onToggle(row.stockId)}
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onOpen(row)}
                    className="text-left hover:underline"
                  >
                    <span className="font-medium">{row.stockName}</span>
                    <span className="ml-1.5 text-xs text-zinc-500">{row.stockId}</span>
                  </button>
                  {held ? (
                    <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                      持股
                    </span>
                  ) : null}
                  {row.available && !row.aligned ? (
                    <span className="ml-2 text-xs text-zinc-500">{row.tradeDate}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatPrice(row.close)}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${toneClass(row.todayChangePct)}`}>
                  {formatPct(row.todayChangePct)}
                </td>
                <td className={`px-3 py-2 text-right tabular-nums ${toneClass(row.periodReturnPct)}`}>
                  {formatPct(row.periodReturnPct)}
                </td>
                <td className={`px-3 py-2 text-right tabular-nums ${toneClass(row.foreignNetLots)}`}>
                  {formatLots(row.foreignNetLots)}
                </td>
                <td className="px-3 py-2">{row.chipRegimeLabel}</td>
                <td className="px-3 py-2">{row.rsTodayLabel}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
