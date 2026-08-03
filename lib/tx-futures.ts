/** Taiwan Index Futures (TX) daily OHLC from TAIFEX — no FinMind quota. */

export type TxFuturesBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  contract: string;
  changePct: number | null;
};

export type TxFuturesSnapshot = {
  asOf: string | null;
  contract: string | null;
  close: number | null;
  changePct: number | null;
  bars: TxFuturesBar[];
  source: "taifex";
  session: "regular";
};

const TAIFEX_CSV_URL = "https://www.taifex.com.tw/cht/3/futDataDown";
const USER_AGENT = "Mozilla/5.0 (compatible; stock-report-site/tx-futures)";
const MAX_RANGE_DAYS = 28;
const DEFAULT_LOOKBACK_CALENDAR_DAYS = 75;

type RawRow = {
  date: string;
  contract: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number;
  changePct: number | null;
  session: string;
};

function formatSlashDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

function toIsoDate(slash: string): string {
  return slash.replaceAll("/", "-");
}

function parseNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.trim().replaceAll(",", "");
  if (!cleaned || cleaned === "-") return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function decodeCsv(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("big5").decode(bytes);
  }
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      if (row.some((value) => value.trim().length > 0)) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }
    if (ch === "\r") continue;
    cell += ch;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value.trim().length > 0)) {
      rows.push(row);
    }
  }
  return rows;
}

function mapHeaderIndex(header: string[]): Record<string, number> {
  const index: Record<string, number> = {};
  header.forEach((name, i) => {
    index[name.trim()] = i;
  });
  return index;
}

function parseRawRows(text: string): RawRow[] {
  const table = parseCsvRows(text);
  if (table.length < 2) return [];
  const col = mapHeaderIndex(table[0]);
  const required = ["交易日期", "契約", "到期月份(週別)", "收盤價", "成交量", "交易時段"];
  for (const key of required) {
    if (col[key] == null) {
      throw new Error(`期交所 CSV 缺少欄位：${key}`);
    }
  }

  const out: RawRow[] = [];
  for (const cells of table.slice(1)) {
    const get = (key: string) => cells[col[key]]?.trim() ?? "";
    if (get("契約") !== "TX") continue;
    out.push({
      date: get("交易日期"),
      contract: get("到期月份(週別)"),
      open: parseNumber(get("開盤價")),
      high: parseNumber(get("最高價")),
      low: parseNumber(get("最低價")),
      close: parseNumber(get("收盤價")),
      volume: parseNumber(get("成交量")) ?? 0,
      changePct: parseNumber(get("漲跌%").replace("%", "")),
      session: get("交易時段"),
    });
  }
  return out;
}

async function downloadRange(start: Date, end: Date): Promise<RawRow[]> {
  const body = new URLSearchParams({
    down_type: "1",
    commodity_id: "TX",
    queryStartDate: formatSlashDate(start),
    queryEndDate: formatSlashDate(end),
  });

  const response = await fetch(TAIFEX_CSV_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`期交所下載失敗（HTTP ${response.status}）`);
  }

  const text = decodeCsv(await response.arrayBuffer());
  if (text.includes("查無資料") || text.trim().length === 0) {
    return [];
  }
  return parseRawRows(text);
}

function chunkDateRanges(end: Date, lookbackCalendarDays: number): Array<[Date, Date]> {
  const ranges: Array<[Date, Date]> = [];
  let cursorEnd = new Date(end);
  const earliest = new Date(end);
  earliest.setDate(earliest.getDate() - lookbackCalendarDays);

  while (cursorEnd >= earliest) {
    const cursorStart = new Date(cursorEnd);
    cursorStart.setDate(cursorStart.getDate() - (MAX_RANGE_DAYS - 1));
    if (cursorStart < earliest) {
      cursorStart.setTime(earliest.getTime());
    }
    ranges.push([new Date(cursorStart), new Date(cursorEnd)]);
    cursorEnd = new Date(cursorStart);
    cursorEnd.setDate(cursorEnd.getDate() - 1);
  }

  return ranges.reverse();
}

/** Near-month continuous: each day keep the TX regular-session row with max volume. */
function buildNearMonthBars(rows: RawRow[]): TxFuturesBar[] {
  const byDate = new Map<string, RawRow[]>();
  for (const row of rows) {
    if (row.session !== "一般") continue;
    if (row.close == null) continue;
    const list = byDate.get(row.date) ?? [];
    list.push(row);
    byDate.set(row.date, list);
  }

  const dates = [...byDate.keys()].sort();
  const bars: TxFuturesBar[] = [];

  for (const date of dates) {
    const candidates = byDate.get(date) ?? [];
    let best = candidates[0];
    for (const row of candidates.slice(1)) {
      if (row.volume > best.volume) best = row;
    }
    if (!best || best.close == null) continue;

    const open = best.open ?? best.close;
    const high = best.high ?? Math.max(open, best.close);
    const low = best.low ?? Math.min(open, best.close);

    bars.push({
      date: toIsoDate(date),
      open,
      high,
      low,
      close: best.close,
      volume: best.volume,
      contract: best.contract,
      changePct: best.changePct,
    });
  }

  return bars;
}

export async function fetchTxFuturesDaily(
  options?: { lookbackCalendarDays?: number; asOf?: Date },
): Promise<TxFuturesSnapshot> {
  const asOf = options?.asOf ?? new Date();
  const lookback =
    options?.lookbackCalendarDays ?? DEFAULT_LOOKBACK_CALENDAR_DAYS;
  const ranges = chunkDateRanges(asOf, lookback);

  const chunks = await Promise.all(
    ranges.map(([start, end]) => downloadRange(start, end)),
  );
  const merged = chunks.flat();
  const bars = buildNearMonthBars(merged);
  const last = bars.at(-1) ?? null;

  return {
    asOf: last?.date ?? null,
    contract: last?.contract ?? null,
    close: last?.close ?? null,
    changePct: last?.changePct ?? null,
    bars,
    source: "taifex",
    session: "regular",
  };
}

/** Soft in-process cache so login / API bursts do not hammer TAIFEX. */
let memoryCache: { expiresAt: number; snapshot: TxFuturesSnapshot } | null =
  null;
const MEMORY_TTL_MS = 30 * 60 * 1000;

export async function getTxFuturesDailyCached(): Promise<TxFuturesSnapshot> {
  const now = Date.now();
  if (memoryCache && memoryCache.expiresAt > now) {
    return memoryCache.snapshot;
  }
  const snapshot = await fetchTxFuturesDaily();
  memoryCache = { expiresAt: now + MEMORY_TTL_MS, snapshot };
  return snapshot;
}
