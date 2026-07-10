export const MA_STACK_LABEL: Record<string, string> = {
  bullish_stack: "均線多頭排列",
  bearish_stack: "均線空頭排列",
  mixed: "均線糾結",
  unknown: "均線排列資料不足",
};

export const MA20_SLOPE_LABEL: Record<string, string> = {
  rising: "月線向上",
  falling: "月線向下",
  flat: "月線平穩",
  unknown: "月線斜率資料不足",
};

export const CHIP_REGIME_LABEL: Record<string, string> = {
  accumulation: "籌碼偏多",
  distribution: "籌碼偏空",
  mixed: "籌碼中性",
  unknown: "籌碼型態資料不足",
};

export const INSTITUTIONAL_LABEL: Record<string, string> = {
  bullish: "法人一致買超",
  bearish: "法人一致賣超",
  mixed: "法人方向分歧",
  neutral: "法人買賣中性",
  unknown: "法人資料不足",
};

export const RS_LABEL: Record<string, string> = {
  outperform: "強於大盤",
  underperform: "弱於大盤",
  inline: "與大盤同步",
  unknown: "相對強弱資料不足",
};

export const VOLUME_ANOMALY_LABEL: Record<string, string> = {
  spike: "成交量放大",
  shrink: "成交量萎縮",
  normal: "成交量正常",
  unknown: "成交量資料不足",
};

export const MA_ALIGNMENT_LABEL: Record<string, string> = {
  bullish: "短中線同步偏多",
  bearish: "短中線同步偏空",
  short_rebound: "短線反彈",
  short_pullback: "短線回檔",
  neutral: "短中線方向不明",
  unknown: "均線資料不足",
};

export type BadgeTone = "bullish" | "bearish" | "neutral" | "info";

export function toneForMaStack(value?: string): BadgeTone {
  if (value === "bullish_stack") return "bullish";
  if (value === "bearish_stack") return "bearish";
  return "neutral";
}

export function toneForChipRegime(value?: string): BadgeTone {
  if (value === "accumulation") return "bullish";
  if (value === "distribution") return "bearish";
  return "neutral";
}

export function toneForRs(value?: string): BadgeTone {
  if (value === "outperform") return "bullish";
  if (value === "underperform") return "bearish";
  return "neutral";
}

export function toneForMa20Slope(value?: string): BadgeTone {
  if (value === "rising") return "bullish";
  if (value === "falling") return "bearish";
  return "neutral";
}

export function toneForInstitutional(value?: string): BadgeTone {
  if (value === "bullish") return "bullish";
  if (value === "bearish") return "bearish";
  return "neutral";
}

export function toneForVolume(value?: string): BadgeTone {
  if (value === "spike") return "info";
  if (value === "shrink") return "neutral";
  return "neutral";
}
