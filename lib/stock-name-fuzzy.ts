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
  /** Higher is better. */
  score: number;
  kind: "char" | "pinyin";
};

/**
 * Score query fragment vs registry name.
 * char distance ≤1 → strong; tone-less pinyin equal / distance ≤1 → phonetic.
 */
export function scoreNameSimilarity(query: string, name: string): FuzzyHit | null {
  if (!query || !name) return null;
  if (query === name) return null; // exact handled elsewhere

  const lenDiff = Math.abs(query.length - name.length);
  if (lenDiff <= 1 && query.length >= 2 && name.length >= 2) {
    const d = editDistance(query, name);
    if (d === 1) {
      return {
        stockId: "",
        matchedName: name,
        score: 80,
        kind: "char",
      };
    }
  }

  // Only bother with pinyin when lengths are close (STT same syllable count).
  if (lenDiff > 1) return null;
  if (query.length < 2 || name.length < 2) return null;

  const pq = pinyinKey(query);
  const pn = pinyinKey(name);
  if (!pq || !pn) return null;
  if (pq === pn) {
    return {
      stockId: "",
      matchedName: name,
      score: 70,
      kind: "pinyin",
    };
  }
  if (Math.abs(pq.length - pn.length) <= 2 && editDistance(pq, pn) <= 1) {
    return {
      stockId: "",
      matchedName: name,
      score: 55,
      kind: "pinyin",
    };
  }
  return null;
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
