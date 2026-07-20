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

function normalizeName(name: string): string {
  return name
    .trim()
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

    const normalized = normalizeName(baseName);
    // help matching "台積" from "台積電"
    if (normalized.endsWith("電") || normalized.endsWith("金") || normalized.endsWith("控")) {
      const trimmed = normalized.slice(0, -1);
      if (trimmed.length >= 2) addNameVariant(nameToId, trimmed, stockIdRaw);
    }
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
  const query = normalizeName(text);
  if (!query) return null;
  const registry = await getRegistry();
  for (const [name, stockId] of registry.sortedNameToId) {
    if (query.includes(name)) return stockId;
  }
  return null;
}

