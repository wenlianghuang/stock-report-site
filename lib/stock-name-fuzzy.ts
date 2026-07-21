import { pinyin } from "pinyin-pro";

const pinyinCache = new Map<string, string>();

/** Tone-less pinyin key for phonetic near-match (身貌 ≈ 昇貿). */
export function pinyinKey(text: string): string {
  const cached = pinyinCache.get(text);
  if (cached !== undefined) return cached;
  const key = pinyin(text, { toneType: "none", type: "array" })
    .join("")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  pinyinCache.set(text, key);
  return key;
}

/** Classic Levenshtein distance. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (Math.abs(a.length - b.length) > 2) return 99;

  const rows = a.length + 1;
  const cols = b.length + 1;
  const prev = new Array<number>(cols);
  const cur = new Array<number>(cols);
  for (let j = 0; j < cols; j++) prev[j] = j;

  for (let i = 1; i < rows; i++) {
    cur[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j < cols; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(
        prev[j]! + 1,
        cur[j - 1]! + 1,
        prev[j - 1]! + cost,
      );
    }
    for (let j = 0; j < cols; j++) prev[j] = cur[j]!;
  }
  return prev[b.length]!;
}

export type FuzzyHit = {
  stockId: string;
  matchedName: string;
  /** Higher is better. Combines character + pinyin distance. */
  score: number;
  kind: "char" | "pinyin";
};

/**
 * Minimum score to auto-fill a near-match.
 * Homophones / 1-char+same-pinyin land well above this;
 * 「順元↔東元」(same 元, unrelated first syllable) stay below.
 */
export const MIN_AUTO_FILL_SCORE = 130;

/**
 * Score query fragment vs registry name.
 * Prefers same/near pinyin over "only share one character".
 *
 * Examples (approx):
 * - 上全/上詮 (char1, py0) → high
 * - 鼎元/頂元 (char1, py0) → high
 * - 身貌/昇貿 (char2, py1) → mid-high, still auto-fill
 * - 順元/東元 (char1, py far) → low, do not auto-fill
 */
export function scoreNameSimilarity(query: string, name: string): FuzzyHit | null {
  if (!query || !name) return null;
  if (query === name) return null; // exact handled elsewhere

  const lenDiff = Math.abs(query.length - name.length);
  if (lenDiff > 1) return null;
  if (query.length < 2 || name.length < 2) return null;

  const charD = editDistance(query, name);
  if (charD > 2) return null;

  const pq = pinyinKey(query);
  const pn = pinyinKey(name);
  if (!pq || !pn) return null;

  const pyD = editDistance(pq, pn);

  // Must be near in characters OR near in sound.
  if (charD > 1 && pyD > 1) return null;

  // Heavier penalty on pinyin so 鼎元/頂元 outranks 順元/東元.
  let score = 200 - charD * 30 - pyD * 15;
  if (query.length === name.length) score += 5;
  if (pyD === 0) score += 40;
  else if (pyD === 1) score += 10;

  const kind: "char" | "pinyin" =
    pyD === 0 || (charD > 1 && pyD <= 1) ? "pinyin" : "char";

  return {
    stockId: "",
    matchedName: name,
    score,
    kind,
  };
}

/**
 * Slide windows over voice text and score against a registry name.
 */
export function bestWindowScore(
  haystack: string,
  name: string,
): { score: number; kind: "char" | "pinyin"; window: string } | null {
  if (!haystack || !name || name.length < 2) return null;
  let best: { score: number; kind: "char" | "pinyin"; window: string } | null =
    null;

  for (
    let len = Math.max(2, name.length - 1);
    len <= name.length + 1;
    len++
  ) {
    if (len > haystack.length) continue;
    for (let i = 0; i + len <= haystack.length; i++) {
      const window = haystack.slice(i, i + len);
      if (!/^[\u4e00-\u9fff]+$/.test(window)) continue;
      const hit = scoreNameSimilarity(window, name);
      if (!hit) continue;
      if (!best || hit.score > best.score) {
        best = { score: hit.score, kind: hit.kind, window };
      }
    }
  }
  return best;
}
