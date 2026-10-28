"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { PaperRecordOutcome, PaperSnapshot } from "@/lib/paper-view";
import type { PaperOrderType, PaperSide } from "@/lib/paper-trade";

type StockHit = { stockId: string; stockName: string };

const OUTCOME_LABEL: Record<PaperRecordOutcome, string> = {
  filled: "已成交",
  expired: "已到期",
  cancelled: "已取消",
  rejected: "已拒絕",
};

function pnlClass(cents: number | null | undefined): string {
  if (cents == null || cents === 0) return "text-zinc-700 dark:text-zinc-200";
  return cents > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400";
}

function sideClass(side: PaperSide): string {
  return side === "buy"
    ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
    : "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300";
}

function choiceClass(active: boolean): string {
  return active
    ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
    : "text-zinc-600 hover:bg-white hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100";
}

function stockLabel(stockId: string, stockName: string | null): string {
  return stockName ? `${stockName} ${stockId}` : stockId;
}

function money(text: string | null | undefined): string {
  return text ? `${text} 元` : "—";
}

function groupPlainTwd(value: string | undefined): string {
  if (!value) return "—";
  const match = /^(-?)(\d+)(\.\d+)?$/.exec(value.trim());
  if (!match) return value;
  const grouped = match[2].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${match[1]}${grouped}${match[3] ?? ""}`;
}

export function PaperTradingDashboard() {
  const [snapshot, setSnapshot] = useState<PaperSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [closing, setClosing] = useState(false);

  async function reload() {
    setRefreshing(true);
    setLoadError("");
    try {
      const response = await fetch("/api/paper", { cache: "no-store" });
      const payload = (await response.json()) as PaperSnapshot & { error?: string };
      if (!response.ok) {
        setLoadError(payload.error ?? "無法讀取模擬帳戶");
        return;
      }
      setSnapshot(payload);
    } catch {
      setLoadError("無法讀取模擬帳戶");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let stopped = false;

    async function sync() {
      if (stopped || document.visibilityState === "hidden") return;
      try {
        const response = await fetch("/api/paper/tick", { method: "POST" });
        const payload = (await response.json()) as {
          cash?: string;
          expired?: number;
          filled?: number;
          settled?: number;
        };
        if (response.ok) {
          const filled = payload.filled ?? 0;
          const expired = payload.expired ?? 0;
          const settled = payload.settled ?? 0;
          if (filled + expired + settled > 0) {
            setNotice(
              `這次撮合：成交 ${filled} 筆、到期 ${expired} 筆、交割 ${settled} 筆。現金 ${groupPlainTwd(payload.cash)} 元。`,
            );
          }
        }
      } catch {
        // 行情暫時抓不到時，仍顯示上一筆帳戶快照。
      }
      if (!stopped) await reload();
    }

    void sync();
    const timer = window.setInterval(() => void sync(), 5_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  async function runClose() {
    if (closing) return;
    setClosing(true);
    setNotice("");
    try {
      const response = await fetch("/api/paper/close", { method: "POST" });
      const payload = (await response.json()) as {
        error?: string;
        cash?: string;
        expired?: number;
        filled?: number;
        settled?: number;
      };
      if (!response.ok) {
        setNotice(payload.error ?? "收盤結算失敗");
        return;
      }
      const filled = payload.filled ?? 0;
      const expired = payload.expired ?? 0;
      const settled = payload.settled ?? 0;
      setNotice(
        filled + expired + settled === 0
          ? `沒有新的成交、到期或交割。現金 ${groupPlainTwd(payload.cash)} 元。`
          : `這次收盤結算：成交 ${filled} 筆、到期 ${expired} 筆、交割 ${settled} 筆。現金 ${groupPlainTwd(payload.cash)} 元。`,
      );
      await reload();
    } catch {
      setNotice("收盤結算失敗");
    } finally {
      setClosing(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium tracking-wide">模擬帳戶</p>
            <h2 className="mt-1 text-2xl font-semibold">模擬交易</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed">
              這是個人模擬帳，不會改動真實持股，也不會送出真實委託。現股可以不滿一張。盤中用證交所當下的最新價、買價和賣價撮合，碰到就全部成交。
            </p>
          </div>
          <button
            type="button"
            onClick={() => void runClose()}
            disabled={closing || loading}
            className="rounded-lg bg-amber-900 px-4 py-2 text-sm font-medium text-amber-50 hover:bg-amber-800 disabled:opacity-60 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-100"
          >
            {closing ? "結算中…" : "收盤結算"}
          </button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-amber-800 dark:text-amber-200/80">
          {snapshot ? `現在是${snapshot.phaseLabel}。` : "讀取交易時段…"}
          買進成交後會立刻出現在部位。交割日之前不能賣，現金在交割日才入帳。13:30 後還沒碰到的限價單改看收盤價。兩次查價之間閃過的價格可能沒看到。
        </p>
        {notice ? <p className="mt-3 text-sm font-medium">{notice}</p> : null}
      </section>

      {loading ? (
        <p className="text-sm text-zinc-500">載入模擬帳戶…</p>
      ) : loadError ? (
        <div className="rounded-xl border border-red-200 bg-white p-4 text-sm text-red-700 dark:border-red-900 dark:bg-zinc-950 dark:text-red-300">
          <p>{loadError}</p>
          <button
            type="button"
            onClick={() => void reload()}
            className="mt-3 rounded-lg border border-red-200 px-3 py-1.5 text-sm hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40"
          >
            再試一次
          </button>
        </div>
      ) : snapshot ? (
        <>
          <BalanceBar snapshot={snapshot} refreshing={refreshing} />
          <OrderTicket
            snapshot={snapshot}
            onPlaced={async (message) => {
              let next = message;
              try {
                const response = await fetch("/api/paper/tick", { method: "POST" });
                const payload = (await response.json()) as {
                  cash?: string;
                  filled?: number;
                  expired?: number;
                  settled?: number;
                };
                if (response.ok && (payload.filled ?? 0) > 0) {
                  next = `已成交 ${payload.filled} 筆。現金 ${groupPlainTwd(payload.cash)} 元。`;
                }
              } catch {
                // 報價暫時抓不到時，單子繼續掛著。
              }
              setNotice(next);
              await reload();
            }}
          />
          <WorkingOrders
            snapshot={snapshot}
            onChanged={async (message) => {
              setNotice(message);
              await reload();
            }}
          />
          <Positions snapshot={snapshot} />
          <Records snapshot={snapshot} />
        </>
      ) : null}
    </div>
  );
}

function BalanceBar({ snapshot, refreshing }: { snapshot: PaperSnapshot; refreshing: boolean }) {
  const items = [
    {
      label: "現金",
      value: money(snapshot.cash.text),
      hint: "帳戶餘額。買單成交並交割後才扣款。",
    },
    {
      label: "可用",
      value: money(snapshot.available.text),
      hint: "扣掉掛單凍結和待交割買單之後，現在還能買的金額。",
    },
    {
      label: "凍結中",
      value: money(snapshot.reserved.text),
      hint: "掛著的買單，加上已成交但還沒交割的買單。",
    },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <p className="text-xs font-medium text-zinc-500">{item.label}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">{item.value}</p>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">{item.hint}</p>
        </div>
      ))}
      {refreshing ? <p className="sr-only">更新中</p> : null}
    </section>
  );
}

function OrderTicket({
  snapshot,
  onPlaced,
}: {
  snapshot: PaperSnapshot;
  onPlaced: (message: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [stockId, setStockId] = useState("");
  const [stockName, setStockName] = useState<string | null>(null);
  const [hits, setHits] = useState<StockHit[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [side, setSide] = useState<PaperSide>("buy");
  const [orderType, setOrderType] = useState<PaperOrderType>("limit");
  const [shares, setShares] = useState("1");
  const [limitPrice, setLimitPrice] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const selectedLabel = stockId ? stockLabel(stockId, stockName) : "";
  const held = snapshot.positions.find((position) => position.stockId === stockId);

  useEffect(() => {
    if (stockId && query === selectedLabel) {
      setHits([]);
      setSearchOpen(false);
      return;
    }
    const q = query.trim();
    if (q.length < 1) {
      setHits([]);
      setSearchOpen(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setSearching(true);
        try {
          const response = await fetch(`/api/voice/stock-search?q=${encodeURIComponent(q)}`, {
            cache: "no-store",
          });
          if (!response.ok) return;
          const payload = (await response.json()) as { results?: StockHit[] };
          if (cancelled) return;
          const results = payload.results ?? [];
          setHits(results);
          setSearchOpen(results.length > 0);
        } catch {
          if (!cancelled) {
            setHits([]);
            setSearchOpen(false);
          }
        } finally {
          if (!cancelled) setSearching(false);
        }
      })();
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, selectedLabel, stockId]);

  useEffect(() => {
    if (!searchOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [searchOpen]);

  function chooseStock(hit: StockHit) {
    setStockId(hit.stockId);
    setStockName(hit.stockName);
    setQuery(stockLabel(hit.stockId, hit.stockName));
    setSearchOpen(false);
    setError("");
  }

  async function resolveTypedStock(): Promise<{ stockId: string; stockName: string | null } | null> {
    if (stockId) return { stockId, stockName };
    const digits = query.trim();
    if (!/^\d{4,6}$/.test(digits)) return null;
    const response = await fetch(`/api/voice/stock-name?stockId=${encodeURIComponent(digits)}`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { stockName?: string | null };
    if (!payload.stockName) return null;
    return { stockId: digits, stockName: payload.stockName };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setError("");
    const shareCount = Number(shares);
    if (!Number.isInteger(shareCount) || shareCount < 1) {
      setError("股數必須是正整數");
      return;
    }
    if (orderType === "limit" && !limitPrice.trim()) {
      setError("請填限價");
      return;
    }

    setSubmitting(true);
    try {
      const stock = await resolveTypedStock();
      if (!stock) {
        setError("請選擇上市或上櫃普通股");
        return;
      }
      setStockId(stock.stockId);
      setStockName(stock.stockName);
      setQuery(stockLabel(stock.stockId, stock.stockName));

      const response = await fetch("/api/paper/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockId: stock.stockId,
          side,
          orderType,
          shares: shareCount,
          limitPrice: orderType === "limit" ? limitPrice.trim() : undefined,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        sessionDate?: string;
        reservedCash?: string;
        reservedShares?: number;
      };
      if (!response.ok) {
        setError(payload.error ?? "下單失敗");
        return;
      }
      const sideLabel = side === "buy" ? "買進" : "賣出";
      const typeLabel = orderType === "market" ? "市價" : `限價 ${limitPrice.trim()}`;
      const reserve =
        side === "buy"
          ? `凍結現金 ${groupPlainTwd(payload.reservedCash)} 元`
          : `凍結 ${payload.reservedShares ?? 0} 股`;
      await onPlaced(
        `已送出${sideLabel}${typeLabel} ${shareCount} 股，交易日 ${payload.sessionDate ?? "—"}，${reserve}。盤中會用證交所當下報價撮合。`,
      );
      if (orderType === "limit") setLimitPrice("");
    } catch {
      setError("下單失敗");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">下單</h3>
          <p className="mt-1 text-sm text-zinc-500">
            13:30 前送出算當日，之後算下一個交易日。限價要在漲跌停內，並符合升降單位。
          </p>
        </div>
      </div>

      <form onSubmit={(event) => void submit(event)} className="mt-4 space-y-4">
        <div ref={searchRef} className="relative">
          <label htmlFor="paper-stock" className="text-xs font-medium text-zinc-500">
            股票
          </label>
          <input
            id="paper-stock"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setStockId("");
              setStockName(null);
            }}
            onFocus={() => {
              if (hits.length > 0) setSearchOpen(true);
            }}
            placeholder="股號或公司名稱，例如 2330、台積電"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={searchOpen}
            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          {searching ? <p className="mt-1 text-xs text-zinc-500">搜尋中…</p> : null}
          {searchOpen ? (
            <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              {hits.map((hit) => (
                <li key={hit.stockId}>
                  <button
                    type="button"
                    onClick={() => chooseStock(hit)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <span>{hit.stockName}</span>
                    <span className="text-xs text-zinc-500">{hit.stockId}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3">
          <fieldset>
            <legend className="text-xs font-medium text-zinc-500">方向</legend>
            <div className="mt-1 inline-flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
              {(["buy", "sell"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setSide(value);
                    setError("");
                  }}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${choiceClass(side === value)}`}
                >
                  {value === "buy" ? "買進" : "賣出"}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-xs font-medium text-zinc-500">價格</legend>
            <div className="mt-1 inline-flex rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
              {(["limit", "market"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setOrderType(value);
                    setError("");
                  }}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${choiceClass(orderType === value)}`}
                >
                  {value === "limit" ? "限價" : "市價"}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-zinc-500">
            股數
            <input
              value={shares}
              onChange={(event) => setShares(event.target.value)}
              inputMode="numeric"
              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900"
            />
            <span className="mt-1 block font-normal">1 股起，不必湊滿 1000 股。手續費最低仍是 20 元。</span>
          </label>
          {orderType === "limit" ? (
            <label className="block text-xs font-medium text-zinc-500">
              限價（元）
              <input
                value={limitPrice}
                onChange={(event) => setLimitPrice(event.target.value)}
                placeholder="例如 2385 或 10.50"
                inputMode="decimal"
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900"
              />
              <span className="mt-1 block font-normal">超過前一日收盤約 10% 的漲跌停會被拒絕。</span>
            </label>
          ) : (
            <p className="self-end text-sm text-zinc-500">
              市價買單用當下賣價成交，市價賣單用當下買價成交。買單先用漲停價凍結現金，成交後退回差額。
            </p>
          )}
        </div>

        {side === "sell" ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {stockId && held
              ? `${stockLabel(stockId, stockName)} 已交割 ${held.shares} 股，可賣 ${held.availableShares} 股。成交後、交割前不能再賣那些股票。`
              : stockId
                ? "這檔還沒有已交割股數，不能賣。"
                : "賣出只能動用已經交割的股數。"}
          </p>
        ) : null}

        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {submitting ? "送出中…" : side === "buy" ? "送出買單" : "送出賣單"}
          </button>
          <p className="text-xs text-zinc-500">送出先凍結。盤中大約每 5 秒用證交所報價撮合一次。</p>
        </div>
      </form>

      <details className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        <summary className="cursor-pointer text-xs font-medium text-zinc-500">交易規則</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed">
          <li>起始資金 100 萬元。可以 1 股起買，不必湊成 1000 股。只接受名冊裡的上市、上櫃普通股。</li>
          <li>手續費是成交金額的 0.1425% 再打六折，最低 20 元。賣出另加證交稅 0.3%。</li>
          <li>限價先看最新價，沒碰到再看對向報價。買單看賣價，賣單看買價。13:30 後還沒碰到的，改看收盤價。</li>
          <li>掛著的單可以取消，凍結立刻釋放。</li>
          <li>買進成交後股票立刻出現在部位。交割日才扣現金，交割前不能賣。</li>
        </ul>
      </details>
    </section>
  );
}

function WorkingOrders({
  snapshot,
  onChanged,
}: {
  snapshot: PaperSnapshot;
  onChanged: (message: string) => Promise<void>;
}) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function cancel(orderId: string) {
    if (cancellingId) return;
    if (!window.confirm("取消這張委託？凍結會立刻釋放。")) return;
    setCancellingId(orderId);
    setError("");
    try {
      const response = await fetch(`/api/paper/orders/${orderId}/cancel`, { method: "POST" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "取消失敗");
        return;
      }
      await onChanged("已取消委託，凍結已釋放。");
    } catch {
      setError("取消失敗");
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold">掛著的單</h3>
        <p className="mt-1 text-sm text-zinc-500">還沒碰到當下報價，所以尚未成交。成交後會從這裡移到部位。</p>
      </div>
      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      {snapshot.working.length === 0 ? (
        <Empty>目前沒有掛著的單。</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-3 py-2 font-medium">股票</th>
                <th className="px-3 py-2 font-medium">方向</th>
                <th className="px-3 py-2 font-medium">委託</th>
                <th className="px-3 py-2 font-medium">股數</th>
                <th className="px-3 py-2 font-medium">現價</th>
                <th className="px-3 py-2 font-medium">狀態</th>
                <th className="px-3 py-2 font-medium">交易日</th>
                <th className="px-3 py-2 font-medium">凍結</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {snapshot.working.map((order) => (
                <tr key={order.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                  <td className="px-3 py-2">
                    <StockCell stockId={order.stockId} stockName={order.stockName} />
                    <div className="text-xs text-zinc-500">{order.submittedText}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${sideClass(order.side)}`}>
                      {order.side === "buy" ? "買進" : "賣出"}
                    </span>
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {order.orderType === "market" ? "市價" : order.priceText}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{order.shares}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {order.lastText ?? "—"}
                    {order.lastAtText ? <div className="text-xs text-zinc-500">{order.lastAtText}</div> : null}
                  </td>
                  <td className="px-3 py-2">尚未成交</td>
                  <td className="px-3 py-2 tabular-nums">{order.sessionDate}</td>
                  <td className="px-3 py-2">{order.reservedText}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => void cancel(order.id)}
                      disabled={cancellingId === order.id}
                      className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
                    >
                      {cancellingId === order.id ? "取消中…" : "取消"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Positions({ snapshot }: { snapshot: PaperSnapshot }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">部位</h3>
          <p className="mt-1 text-sm text-zinc-500">
            成交的買進列在這裡。待交割表示已經買到，交割日之前不能賣。未實現損益用現價減去含手續費的成本。
          </p>
        </div>
        {snapshot.positions.length > 0 ? (
          <p className={`text-sm tabular-nums ${pnlClass(snapshot.totals.unrealized?.cents)}`}>
            {snapshot.totals.complete && snapshot.totals.unrealized
              ? `未實現合計 ${signedMoney(snapshot.totals.unrealized.text, snapshot.totals.unrealized.cents)}`
              : "有部位還沒有收盤價，先不算合計。"}
          </p>
        ) : null}
      </div>
      {snapshot.positions.length === 0 ? (
        <Empty>還沒有成交的股票。撮合成功後，買進會出現在這裡。</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-3 py-2 font-medium">股票</th>
                <th className="px-3 py-2 font-medium">狀態</th>
                <th className="px-3 py-2 font-medium">持有</th>
                <th className="px-3 py-2 font-medium">可賣</th>
                <th className="px-3 py-2 font-medium">均價</th>
                <th className="px-3 py-2 font-medium">現價</th>
                <th className="px-3 py-2 font-medium">市值</th>
                <th className="px-3 py-2 font-medium">未實現</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.positions.map((position) => (
                <tr key={position.stockId} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                  <td className="px-3 py-2">
                    <StockCell stockId={position.stockId} stockName={position.stockName} />
                  </td>
                  <td className="px-3 py-2">{position.statusText}</td>
                  <td className="px-3 py-2 tabular-nums">{position.shares} 股</td>
                  <td className="px-3 py-2 tabular-nums">{position.availableShares} 股</td>
                  <td className="px-3 py-2 tabular-nums">{position.avgCostText}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {position.closeText ? (
                      <>
                        {position.closeText}
                        <div className="text-xs text-zinc-500">{position.closeDate}</div>
                      </>
                    ) : (
                      <span className="text-zinc-500">還沒有現價</span>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{money(position.marketValue?.text)}</td>
                  <td className={`px-3 py-2 tabular-nums ${pnlClass(position.unrealized?.cents)}`}>
                    {position.unrealized
                      ? signedMoney(position.unrealized.text, position.unrealized.cents)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Records({ snapshot }: { snapshot: PaperSnapshot }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold">成交與到期紀錄</h3>
        <p className="mt-1 text-sm text-zinc-500">
          成交價是碰到的當下報價，或收盤價。買進成交後也會出現在上方部位。
        </p>
      </div>
      {snapshot.records.length === 0 ? (
        <Empty>還沒有成交或到期紀錄。</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-3 py-2 font-medium">時間</th>
                <th className="px-3 py-2 font-medium">股票</th>
                <th className="px-3 py-2 font-medium">方向</th>
                <th className="px-3 py-2 font-medium">結果</th>
                <th className="px-3 py-2 font-medium">價格</th>
                <th className="px-3 py-2 font-medium">股數</th>
                <th className="px-3 py-2 font-medium">費用</th>
                <th className="px-3 py-2 font-medium">說明</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.records.map((record) => (
                <tr key={record.id} className="border-b border-zinc-100 align-top last:border-0 dark:border-zinc-900">
                  <td className="px-3 py-2 tabular-nums text-zinc-600 dark:text-zinc-300">{record.at}</td>
                  <td className="px-3 py-2">
                    <StockCell stockId={record.stockId} stockName={record.stockName} />
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${sideClass(record.side)}`}>
                      {record.side === "buy" ? "買進" : "賣出"}
                    </span>
                  </td>
                  <td className="px-3 py-2">{OUTCOME_LABEL[record.outcome]}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {record.priceText ?? "—"}
                    {record.orderType && record.priceText !== "市價" ? (
                      <div className="text-xs text-zinc-500">
                        {record.orderType === "market" ? "市價" : "限價"}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{record.shares}</td>
                  <td className="px-3 py-2 text-xs tabular-nums text-zinc-600 dark:text-zinc-300">
                    {record.feeText ? <div>手續費 {record.feeText}</div> : "—"}
                    {record.taxText ? <div>證交稅 {record.taxText}</div> : null}
                    {record.pnl ? (
                      <div className={pnlClass(record.pnl.cents)}>
                        已實現 {signedMoney(record.pnl.text, record.pnl.cents)}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-zinc-700 dark:text-zinc-200">{record.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StockCell({ stockId, stockName }: { stockId: string; stockName: string | null }) {
  return (
    <div className="font-medium">
      {stockName || stockId}
      {stockName ? <span className="ml-1 text-xs font-normal text-zinc-500">{stockId}</span> : null}
    </div>
  );
}

function Empty({ children }: { children: string }) {
  return (
    <p className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
      {children}
    </p>
  );
}

function signedMoney(text: string, cents: number): string {
  if (cents > 0) return `+${text} 元`;
  return `${text} 元`;
}
