"use client";

import { useEffect, useState } from "react";
import type {
  ConceptCompareResult,
  ConceptPeersResult,
} from "@/lib/agent-client";

type Props = {
  stockId: string;
  stockName?: string;
  tradeDate?: string;
};

function formatCell(
  value: string | number | null | undefined,
  kind: string,
): string {
  if (value == null || value === "") {
    return "—";
  }
  if (kind === "label") {
    return String(value);
  }
  if (typeof value !== "number" || Number.isNaN(value)) {
    return String(value);
  }
  if (kind === "pct") {
    const prefix = value > 0 ? "+" : "";
    return `${prefix}${value.toFixed(2)}%`;
  }
  if (kind === "lots") {
    const prefix = value > 0 ? "+" : "";
    return `${prefix}${Math.round(value).toLocaleString("zh-TW")}`;
  }
  if (kind === "ratio") {
    return value.toFixed(2);
  }
  return value.toLocaleString("zh-TW", {
    maximumFractionDigits: 2,
  });
}

function toneClass(
  value: string | number | null | undefined,
  kind: string,
): string {
  if (kind === "label" || value == null || typeof value !== "number") {
    return "text-zinc-800 dark:text-zinc-100";
  }
  if (value > 0) {
    return "text-rose-600 dark:text-rose-400";
  }
  if (value < 0) {
    return "text-emerald-700 dark:text-emerald-400";
  }
  return "text-zinc-800 dark:text-zinc-100";
}

export function ConceptPeersPanel({ stockId, stockName, tradeDate }: Props) {
  const [peers, setPeers] = useState<ConceptPeersResult | null>(null);
  const [peersError, setPeersError] = useState("");
  const [peersLoading, setPeersLoading] = useState(true);
  const [selectedPeerId, setSelectedPeerId] = useState<string | null>(null);
  const [comparison, setComparison] = useState<ConceptCompareResult | null>(
    null,
  );
  const [compareError, setCompareError] = useState("");
  const [compareLoading, setCompareLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPeersLoading(true);
    setPeersError("");
    setPeers(null);
    setSelectedPeerId(null);
    setComparison(null);

    async function load() {
      try {
        const response = await fetch(
          `/api/stocks/${encodeURIComponent(stockId)}/concept-peers`,
        );
        const data = (await response.json()) as {
          peers?: ConceptPeersResult;
          error?: string;
        };
        if (!response.ok) {
          if (!cancelled) {
            setPeersError(data.error ?? "無法載入概念股");
          }
          return;
        }
        if (!cancelled) {
          setPeers(data.peers ?? null);
        }
      } catch {
        if (!cancelled) {
          setPeersError("無法連線到 API");
        }
      } finally {
        if (!cancelled) {
          setPeersLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [stockId]);

  async function onSelectPeer(peerId: string) {
    setSelectedPeerId(peerId);
    setCompareLoading(true);
    setCompareError("");
    setComparison(null);

    try {
      const params = new URLSearchParams();
      if (tradeDate) {
        params.set("date", tradeDate);
      }
      const query = params.toString();
      const response = await fetch(
        `/api/stocks/${encodeURIComponent(stockId)}/compare/${encodeURIComponent(peerId)}${
          query ? `?${query}` : ""
        }`,
      );
      const data = (await response.json()) as {
        comparison?: ConceptCompareResult;
        error?: string;
      };
      if (!response.ok) {
        setCompareError(data.error ?? "比較失敗");
        return;
      }
      setComparison(data.comparison ?? null);
    } catch {
      setCompareError("無法連線到 API");
    } finally {
      setCompareLoading(false);
    }
  }

  if (peersLoading) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        載入同主題概念股…
      </p>
    );
  }

  if (peersError) {
    return <p className="text-sm text-red-600">{peersError}</p>;
  }

  if (!peers?.inUniverse || peers.groups.length === 0) {
    return (
      <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
        <p>
          {stockName ? `${stockName}（${stockId}）` : stockId}{" "}
          尚未列入概念股比較池，因此沒有可點選的概念股。
        </p>
        <p>
          若要補上，請在{" "}
          <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">
            concept_peers_universe.json
          </code>{" "}
          掛上對應 themes（與投組池分開，不會進入預設回補）。
        </p>
      </div>
    );
  }

  const selectedPeer = selectedPeerId
    ? peers.groups
        .flatMap((g) => g.peers)
        .find((p) => p.stockId === selectedPeerId)
    : undefined;

  const baseName =
    comparison?.base.stockName ||
    stockName ||
    peers.stockName ||
    stockId;
  const peerName =
    comparison?.peer.stockName ||
    selectedPeer?.stockName ||
    comparison?.peerId ||
    selectedPeerId ||
    "對照檔";
  const baseId = comparison?.base.stockId || stockId;
  const peerId = comparison?.peer.stockId || selectedPeerId || "";
  /** VS 標題與欄位優先顯示中文名（友達 vs 群創） */
  const baseLabel = baseName;
  const peerLabel = peerName;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          依主題候選池列出同主題標的。點選後對齊{" "}
          {tradeDate ? `${tradeDate} ` : ""}
          籌碼 facts 做並列比較（不重跑完整報告）。
        </p>
      </div>

      <div className="space-y-5">
        {peers.groups.map((group) => (
          <section key={group.themeId}>
            <div className="mb-2 flex flex-wrap items-baseline gap-2">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {group.label}
              </h3>
              {group.riskHint ? (
                <span className="text-xs text-zinc-500">{group.riskHint}</span>
              ) : null}
            </div>
            {group.peers.length === 0 ? (
              <p className="text-sm text-zinc-500">此主題尚無其他標的。</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {group.peers.map((peer) => {
                  const active = selectedPeerId === peer.stockId;
                  return (
                    <button
                      key={`${group.themeId}-${peer.stockId}`}
                      type="button"
                      onClick={() => void onSelectPeer(peer.stockId)}
                      disabled={compareLoading && active}
                      className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                        active
                          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                          : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
                      }`}
                    >
                      <span className="font-medium">{peer.stockName}</span>
                      <span className="ml-1.5 opacity-70">{peer.stockId}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>

      {compareLoading ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          正在抓取／對齊對照檔籌碼資料…
        </p>
      ) : null}

      {compareError ? (
        <p className="text-sm text-red-600">{compareError}</p>
      ) : null}

      {comparison ? (
        <div className="space-y-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                {baseLabel} vs {peerLabel}
              </h3>
              <p className="mt-1 text-xs text-zinc-500">
                {baseId}
                {peerId ? ` · ${peerId}` : ""}
                {" · "}
                交易日 {comparison.tradeDate ?? tradeDate ?? "—"}
                {comparison.sharedThemes.length > 0
                  ? ` · 共同主題：${comparison.sharedThemes
                      .map((t) => t.label)
                      .join("、")}`
                  : ""}
              </p>
            </div>
            <div className="flex gap-4 text-sm tabular-nums">
              <div>
                <div className="text-xs text-zinc-500">{baseLabel}</div>
                <div
                  className={`font-semibold ${toneClass(
                    comparison.base.today_change_pct,
                    "pct",
                  )}`}
                >
                  {comparison.base.close != null
                    ? comparison.base.close.toLocaleString("zh-TW")
                    : "—"}{" "}
                  <span className="text-xs font-normal">
                    {formatCell(comparison.base.today_change_pct, "pct")}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-500">{peerLabel}</div>
                <div
                  className={`font-semibold ${toneClass(
                    comparison.peer.today_change_pct,
                    "pct",
                  )}`}
                >
                  {comparison.peer.close != null
                    ? comparison.peer.close.toLocaleString("zh-TW")
                    : "—"}{" "}
                  <span className="text-xs font-normal">
                    {formatCell(comparison.peer.today_change_pct, "pct")}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {comparison.highlights.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
              {comparison.highlights.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
                  <th className="py-2 pr-3 font-medium">項目</th>
                  <th className="py-2 pr-3 font-medium">{baseLabel}</th>
                  <th className="py-2 font-medium">{peerLabel}</th>
                </tr>
              </thead>
              <tbody>
                {comparison.rows.map((row) => (
                  <tr
                    key={row.key}
                    className="border-b border-zinc-100 dark:border-zinc-900"
                  >
                    <td className="py-2 pr-3 text-zinc-600 dark:text-zinc-400">
                      {row.label}
                    </td>
                    <td
                      className={`py-2 pr-3 tabular-nums ${toneClass(
                        row.base_raw ?? row.base,
                        row.kind,
                      )}`}
                    >
                      {formatCell(row.base, row.kind)}
                    </td>
                    <td
                      className={`py-2 tabular-nums ${toneClass(
                        row.peer_raw ?? row.peer,
                        row.kind,
                      )}`}
                    >
                      {formatCell(row.peer, row.kind)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-zinc-500">
            僅供參考，不構成投資建議。數字來自同日 facts，非模型推估。
          </p>
        </div>
      ) : null}
    </div>
  );
}
