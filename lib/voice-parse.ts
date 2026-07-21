import { toTraditionalChinese } from "@/lib/zh-convert";

export type VoiceReportFields = {
  stockId: string;
  isHolding: boolean;
  shareCount: string;
  avgCost: string;
};

export type VoiceParseResult = {
  fields: VoiceReportFields;
  warnings: string[];
  /** true when stockId looks usable (4–6 digits) */
  canConfirm: boolean;
};


const DIGIT_CHAR: Record<string, string> = {
  "0": "0",
  "1": "1",
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
  "7": "7",
  "8": "8",
  "9": "9",
  零: "0",
  "〇": "0",
  "○": "0",
  "Ｏ": "0",
  O: "0",
  o: "0",
  一: "1",
  壹: "1",
  二: "2",
  兩: "2",
  两: "2",
  貳: "2",
  三: "3",
  參: "3",
  四: "4",
  肆: "4",
  五: "5",
  伍: "5",
  六: "6",
  陸: "6",
  七: "7",
  柒: "7",
  八: "8",
  捌: "8",
  九: "9",
  玖: "9",
};

const UNIT_VALUE: Record<string, number> = {
  十: 10,
  拾: 10,
  百: 100,
  佰: 100,
  千: 1000,
  仟: 1000,
  万: 10000,
  萬: 10000,
};

const QTY_TOKEN =
  "[0-9零〇○一二兩两三四五六七八九十百千萬万點点.]+";

function normalizeText(raw: string): string {
  // Whisper zh often emits Simplified; normalize to Traditional for TW matching.
  return toTraditionalChinese(raw)
    .replace(/臺/g, "台")
    .replace(/\s+/g, "")
    .replace(/[，,。.!！？?]/g, "")
    .trim();
}

/** Digit-by-digit: 二四零九 / 2409 → "2409" */
export function chineseDigitsToArabic(token: string): string {
  let out = "";
  for (const ch of token) {
    const d = DIGIT_CHAR[ch];
    if (d === undefined) return "";
    out += d;
  }
  return out;
}

/**
 * Quantity-style Chinese numbers: 兩千、一萬二千、五十、五十點五、2000.
 * Returns null if unparsable.
 */
export function parseChineseQuantity(raw: string): number | null {
  const s = raw.replace(/\s+/g, "").replace(/块|塊|元|股/g, "");
  if (!s) return null;

  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  // Mixed arabic + unit: 2千 / 1萬2
  const mixed = s.match(/^(\d+)([十拾百佰千仟万萬])(\d*)$/);
  if (mixed) {
    const head = Number(mixed[1]);
    const unit = UNIT_VALUE[mixed[2]!] ?? 0;
    const tail = mixed[3] ? Number(mixed[3]) : 0;
    if (!unit || !Number.isFinite(head)) return null;
    return head * unit + (Number.isFinite(tail) ? tail : 0);
  }

  const [intPart, fracPart] = s.split(/点|點/);
  if (!intPart) return null;

  let total = 0;
  let section = 0;
  let number = 0;
  let hasDigit = false;

  for (const ch of intPart) {
    if (DIGIT_CHAR[ch] !== undefined) {
      number = Number(DIGIT_CHAR[ch]);
      hasDigit = true;
      continue;
    }
    const unit = UNIT_VALUE[ch];
    if (unit === undefined) {
      if (/\d/.test(ch)) {
        number = number * 10 + Number(ch);
        hasDigit = true;
        continue;
      }
      return null;
    }
    if (unit === 10000) {
      section += hasDigit ? number : 0;
      if (section === 0) section = 1;
      total += section * unit;
      section = 0;
      number = 0;
      hasDigit = false;
      continue;
    }
    if (!hasDigit) number = 1;
    section += number * unit;
    number = 0;
    hasDigit = false;
  }
  total += section + (hasDigit ? number : 0);

  if (fracPart !== undefined && fracPart !== "") {
    let frac = "";
    for (const ch of fracPart) {
      if (DIGIT_CHAR[ch] !== undefined) frac += DIGIT_CHAR[ch];
      else if (/\d/.test(ch)) frac += ch;
      else return null;
    }
    if (frac) {
      const f = Number(`0.${frac}`);
      if (!Number.isFinite(f)) return null;
      total += f;
    }
  }

  return Number.isFinite(total) ? total : null;
}

/** Remove quantity phrases that should not be mistaken for tickers. */
function stripQuantityPhrases(text: string): string {
  return (
    text
      // Share count immediately before cost — must run before stripping 均價 itself
      .replace(
        new RegExp(
          `${QTY_TOKEN}(?=平均價|均价|均價|(?<![股])價)`,
          "g",
        ),
        "",
      )
      .replace(
        new RegExp(`(?:持股|持有|股数|股數)\\s*${QTY_TOKEN}\\s*股?`, "g"),
        "",
      )
      .replace(
        new RegExp(
          `(?:平均價|均价|均價|成本|成本价|成本價|每股)\\s*${QTY_TOKEN}\\s*(?:元|块|塊)?`,
          "g",
        ),
        "",
      )
      // STT often drops 均: 價19塊 / 价19元
      .replace(new RegExp(`(?<![股])價\\s*${QTY_TOKEN}\\s*(?:元|块|塊)?`, "g"), "")
      .replace(
        new RegExp(
          `[0-9零〇○一二兩两三四五六七八九十百千萬万]+\\s*股(?!票|號|号)`,
          "g",
        ),
        "",
      )
  );
}

function extractStockId(text: string, warnings: string[]): string {
  const labeled = text.match(
    /(?:股號|代号|代號|股票代號|分析|看看|查看)\s*(\d{4,6})/,
  );
  if (labeled?.[1]) {
    return labeled[1];
  }

  // Spoken digit sequence of length 4–6 (二四零九)
  const spoken = text.match(
    /[零〇○ＯOo一二兩两三四五六七八九壹貳參肆伍陸柒捌玖]{4,6}/,
  );
  if (spoken?.[0]) {
    const id = chineseDigitsToArabic(spoken[0]);
    if (/^\d{4,6}$/.test(id)) return id;
  }

  const stripped = stripQuantityPhrases(text);

  // Prefer 4-digit tickers (typical TW listed codes) over 5–6 digit share counts.
  const four = stripped.match(/(?<!\d)(\d{4})(?!\d)/);
  if (four?.[1]) {
    return four[1];
  }

  const bare = stripped.match(/(\d{4,6})/);
  if (bare?.[1]) {
    return bare[1];
  }

  warnings.push("聽不到清楚的股號，請手動確認或改口說四碼代號");
  return "";
}

function extractHolding(
  text: string,
): Pick<VoiceReportFields, "isHolding" | "shareCount" | "avgCost"> & {
  notes: string[];
} {
  const notes: string[] = [];
  const noHolding = /没有持股|沒有持股|无持股|無持股|不持股|未持股/.test(text);
  if (noHolding) {
    return { isHolding: false, shareCount: "", avgCost: "", notes };
  }

  let shareCount = "";
  let avgCost = "";

  const sharePatterns = [
    new RegExp(`(?:持股|持有|股数|股數)\\s*(${QTY_TOKEN})\\s*股?`),
    // 85000平均價 / 八萬均價（STT 常省略「股」）
    new RegExp(`(${QTY_TOKEN})(?=平均價|均价|均價|(?<![股])價)`),
    new RegExp(`([0-9零〇○一二兩两三四五六七八九十百千萬万]+)\\s*股(?!票|號|价|價)`),
  ];
  for (const re of sharePatterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const n = parseChineseQuantity(m[1]);
      if (n !== null && n > 0) {
        shareCount = String(Math.round(n));
        break;
      }
    }
  }

  const costPatterns = [
    new RegExp(`(?:平均價|均价|均價|成本|成本价|成本價)\\s*(${QTY_TOKEN})`),
    new RegExp(`每股\\s*(${QTY_TOKEN})\\s*(?:元|块|塊)?`),
    // STT drops 均: 價19塊
    new RegExp(`(?<![股])價\\s*(${QTY_TOKEN})\\s*(?:元|块|塊)?`),
  ];
  for (const re of costPatterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const n = parseChineseQuantity(m[1]);
      if (n !== null && n > 0) {
        avgCost = String(Number(n.toFixed(4)));
        break;
      }
    }
  }

  const mentionsHolding =
    /有持股|持股|持有/.test(text) || Boolean(shareCount) || Boolean(avgCost);

  if (mentionsHolding && (!shareCount || !avgCost)) {
    notes.push("有提到持股，但股數或均價不完整，請補齊後再送出");
  }

  return {
    isHolding: mentionsHolding,
    shareCount,
    avgCost,
    notes,
  };
}

/** Parse STT transcript into report form fields. Never auto-submits. */
export function parseVoiceReportCommand(transcript: string): VoiceParseResult {
  const text = normalizeText(transcript);
  const warnings: string[] = [];

  if (!text) {
    return {
      fields: { stockId: "", isHolding: false, shareCount: "", avgCost: "" },
      warnings: ["沒有辨識到內容，請再試一次"],
      canConfirm: false,
    };
  }

  const stockId = extractStockId(text, warnings);
  const holding = extractHolding(text);
  warnings.push(...holding.notes);

  const fields: VoiceReportFields = {
    stockId,
    isHolding: holding.isHolding,
    shareCount: holding.shareCount,
    avgCost: holding.avgCost,
  };

  return {
    fields,
    warnings,
    canConfirm: /^\d{4,6}$/.test(stockId),
  };
}
