/**
 * Collapse consecutive repeated speech fragments from Web Speech / STT.
 * e.g. "富採85000 富採85000 富採85000 156元" → "富採85000 156元"
 */
export function collapseRepeatedSpeechFragments(raw: string): string {
  let text = raw.replace(/\s+/g, " ").trim();
  if (!text) return text;

  // 1) Consecutive identical space-separated tokens
  const tokens = text.split(" ");
  const dedupedTokens: string[] = [];
  for (const token of tokens) {
    if (!token) continue;
    if (dedupedTokens[dedupedTokens.length - 1] === token) continue;
    dedupedTokens.push(token);
  }
  text = dedupedTokens.join(" ");

  // 2) Whole string is N exact repeats of one unit (with or without spaces)
  const compact = text.replace(/\s+/g, "");
  for (let copies = Math.floor(compact.length / 2); copies >= 2; copies -= 1) {
    if (compact.length % copies !== 0) continue;
    const unitLen = compact.length / copies;
    if (unitLen < 2) continue;
    const unit = compact.slice(0, unitLen);
    if (unit.repeat(copies) === compact) {
      if (
        dedupedTokens.length === copies &&
        dedupedTokens.every((t) => t === dedupedTokens[0])
      ) {
        return dedupedTokens[0]!;
      }
      return unit;
    }
  }

  // 3) Adjacent repeated chunks without relying on spaces (min 2 chars)
  let prev = "";
  while (prev !== text) {
    prev = text;
    text = text.replace(/([\u4e00-\u9fffA-Za-z0-9]{2,40})\1+/g, "$1");
  }

  return text.replace(/\s+/g, " ").trim();
}
