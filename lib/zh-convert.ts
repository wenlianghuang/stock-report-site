import * as OpenCC from "opencc-js";

/** Simplified Chinese → Traditional Chinese (Taiwan). */
const toTw = OpenCC.Converter({ from: "cn", to: "tw" });

/** Simplified Chinese → Traditional Chinese (Taiwan), aligned with TWSE naming. */
export function toTraditionalChinese(text: string): string {
  if (!text) return text;
  // OpenCC "tw" often uses 臺; listed short names use 台 (e.g. 台積電).
  return toTw(text).replace(/臺/g, "台");
}
