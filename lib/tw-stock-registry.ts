import { toTraditionalChinese } from "@/lib/zh-convert";

type RegistryData = {
  idToName: Map<string, string>;
  sortedNameToId: Array<[name: string, stockId: string]>;
};

type CacheState = {
  data: RegistryData;
  expiresAt: number;
};

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h
let cache: CacheState | null = null;
let inflight: Promise<RegistryData> | null = null;

const SEED_NAME_TO_CODE: Record<string, string> = {
  台積電: "2330",
  台積: "2330",
  护国神山: "2330",
  護國神山: "2330",
  联电: "2303",
  聯電: "2303",
  鸿海: "2317",
  鴻海: "2317",
  联发科: "2454",
  聯發科: "2454",
  广达: "2382",
  廣達: "2382",
  仁宝: "2324",
  仁寶: "2324",
  纬创: "3231",
  緯創: "3231",
  和硕: "4938",
  和碩: "4938",
  日月光: "3711",
  中钢: "2002",
  中鋼: "2002",
  // Common STT near-misses for 中鋼
  隔剛: "2002",
  隔刚: "2002",
  忠鋼: "2002",
  忠钢: "2002",
  富采: "3714",
  富採: "3714",
  台塑: "1301",
  南亚: "1303",
  南亞: "1303",
  国泰金: "2882",
  國泰金: "2882",
  富邦金: "2881",
  兆丰金: "2886",
  兆豐金: "2886",
  友达: "2409",
  友達: "2409",
  群创: "3481",
  群創: "3481",
};

const TWSE_LISTED_URL = "https://openapi.twse.com.tw/v1/opendata/t187ap03_L";
const TPEX_OTC_URL = "https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O";

/**
 * Spoken / typed short names often drop these endings
 * (e.g. 萬潤科技 → 萬潤, 聯亞光電工業 → 聯亞光電 → 聯亞).
 * Longer suffixes first so 「半導體」wins over accidental short matches.
 * Aliases are built by peeling repeatedly until no suffix remains.
 */
const STRIPPABLE_SUFFIXES = [
  "半導體",
  "科技",
  "工業",
  "材料",
  "光電",
  "建設",
  "開發",
  "實業",
  "電子",
  "投控",
  "電",
  "金",
  "控",
] as const;

function addSpokenShortAliases(
  nameToId: Map<string, string>,
  normalizedBase: string,
  stockId: string,
) {
  // Keep peeling suffixes so 「聯亞光電工業」→「聯亞光電」→「聯亞」.
  let current = normalizedBase;
  while (current.length >= 2) {
    let stripped = false;
    for (const suffix of STRIPPABLE_SUFFIXES) {
      if (!current.endsWith(suffix)) continue;
      const trimmed = current.slice(0, -suffix.length);
      if (trimmed.length < 2) break;
      addNameVariant(nameToId, trimmed, stockId);
      current = trimmed;
      stripped = true;
      break;
    }
    if (!stripped) break;
  }
}

function normalizeName(name: string): string {
  return toTraditionalChinese(name)
    .trim()
    // TWSE/TPEx short names use 台 (not 臺); OpenCC tw often emits 臺.
    .replace(/臺/g, "台")
    .replace(/\s+/g, "")
    .replace(/[()（）【】\[\]「」『』]/g, "")
    .replace(/股份有限公司/g, "")
    .replace(/有限公司/g, "");
}

function addNameVariant(nameToId: Map<string, string>, name: string, stockId: string) {
  const n = normalizeName(name);
  if (!n || nameToId.has(n)) return;
  nameToId.set(n, stockId);
}

function createSeedData(): RegistryData {
  const idToName = new Map<string, string>();
  const nameToId = new Map<string, string>();
  for (const [name, stockId] of Object.entries(SEED_NAME_TO_CODE)) {
    addNameVariant(nameToId, name, stockId);
    if (!idToName.has(stockId)) idToName.set(stockId, name);
  }
  return freezeRegistry(idToName, nameToId);
}

function freezeRegistry(idToName: Map<string, string>, nameToId: Map<string, string>): RegistryData {
  const sortedNameToId = Array.from(nameToId.entries()).sort(
    ([a], [b]) => b.length - a.length,
  );
  return { idToName, sortedNameToId };
}

async function fetchJson(url: string): Promise<Array<Record<string, unknown>>> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${url} -> ${response.status}`);
  }
  const json = (await response.json()) as unknown;
  return Array.isArray(json) ? (json as Array<Record<string, unknown>>) : [];
}

function addRows(
  rows: Array<Record<string, unknown>>,
  idToName: Map<string, string>,
  nameToId: Map<string, string>,
) {
  for (const row of rows) {
    const stockIdRaw = String(row["公司代號"] ?? row["SecuritiesCompanyCode"] ?? "").trim();
    if (!/^\d{4,6}$/.test(stockIdRaw)) continue;
    const shortName = String(row["公司簡稱"] ?? row["CompanyName"] ?? "").trim();
    const fullName = String(row["公司名稱"] ?? "").trim();
    const baseName = shortName || fullName;
    if (!baseName) continue;

    if (!idToName.has(stockIdRaw)) {
      idToName.set(stockIdRaw, normalizeName(baseName));
    }

    addNameVariant(nameToId, shortName, stockIdRaw);
    addNameVariant(nameToId, fullName, stockIdRaw);
    addSpokenShortAliases(nameToId, normalizeName(baseName), stockIdRaw);
  }
}

async function buildRegistryData(): Promise<RegistryData> {
  const idToName = new Map<string, string>();
  const nameToId = new Map<string, string>();

  for (const [name, stockId] of Object.entries(SEED_NAME_TO_CODE)) {
    if (!idToName.has(stockId)) idToName.set(stockId, normalizeName(name));
    addNameVariant(nameToId, name, stockId);
  }

  const [listedRows, otcRows] = await Promise.all([
    fetchJson(TWSE_LISTED_URL),
    fetchJson(TPEX_OTC_URL),
  ]);

  addRows(listedRows, idToName, nameToId);
  addRows(otcRows, idToName, nameToId);
  return freezeRegistry(idToName, nameToId);
}

async function getRegistry(): Promise<RegistryData> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.data;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const data = await buildRegistryData();
      cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };
      return data;
    } catch {
      const fallback = cache?.data ?? createSeedData();
      cache = { data: fallback, expiresAt: Date.now() + 30 * 60 * 1000 };
      return fallback;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export async function resolveStockNameById(stockId: string): Promise<string | null> {
  const id = stockId.trim();
  if (!/^\d{4,6}$/.test(id)) return null;
  const registry = await getRegistry();
  return registry.idToName.get(id) ?? null;
}

export async function resolveStockIdFromText(text: string): Promise<string | null> {
  // Whisper `zh` often emits Simplified; dictionary is Traditional (TWSE/TPEx).
  const query = normalizeName(text);
  if (!query) return null;
  const registry = await getRegistry();
  for (const [name, stockId] of registry.sortedNameToId) {
    if (query.includes(name)) return stockId;
  }
  return null;
}

export type StockSearchHit = {
  stockId: string;
  stockName: string;
};

/**
 * Autocomplete against TWSE/TPEx registry by company name or stock-id prefix.
 * Returns unique tickers with canonical short names.
 */
export async function searchStocksByQuery(
  rawQuery: string,
  limit = 8,
): Promise<StockSearchHit[]> {
  const query = normalizeName(rawQuery);
  if (!query || limit <= 0) return [];

  const registry = await getRegistry();

  if (/^\d{1,6}$/.test(query)) {
    const hits: StockSearchHit[] = [];
    for (const [stockId, stockName] of registry.idToName) {
      if (!stockId.startsWith(query)) continue;
      hits.push({ stockId, stockName });
    }
    return hits
      .sort((a, b) => a.stockId.localeCompare(b.stockId))
      .slice(0, limit);
  }

  const scored = new Map<string, { stockName: string; score: number }>();
  for (const [name, stockId] of registry.sortedNameToId) {
    let score = -1;
    if (name === query) score = 300;
    else if (name.startsWith(query)) score = 200 + Math.min(name.length, 20);
    else if (name.includes(query)) score = 100;
    else continue;

    const canonical = registry.idToName.get(stockId) ?? name;
    const prev = scored.get(stockId);
    if (!prev || score > prev.score) {
      scored.set(stockId, { stockName: canonical, score });
    }
  }

  return Array.from(scored.entries())
    .sort(
      (a, b) =>
        b[1].score - a[1].score ||
        a[1].stockName.localeCompare(b[1].stockName, "zh-Hant") ||
        a[0].localeCompare(b[0]),
    )
    .slice(0, limit)
    .map(([stockId, { stockName }]) => ({ stockId, stockName }));
}

/**
 * Merge parser digit ticker + company-name match.
 * Valid market codes win; otherwise fall back to name (fixes 85000-as-ticker).
 */
export async function resolveVoiceStockId(
  text: string,
  parsedStockId: string,
): Promise<{ stockId: string; stockName: string | null }> {
  const digitRaw = parsedStockId.trim();
  const digitValid =
    /^\d{4,6}$/.test(digitRaw) && (await resolveStockNameById(digitRaw))
      ? digitRaw
      : "";
  const fromName = (await resolveStockIdFromText(text)) ?? "";

  const stockId = digitValid || fromName;
  const stockName = stockId ? await resolveStockNameById(stockId) : null;
  return { stockId, stockName };
}

