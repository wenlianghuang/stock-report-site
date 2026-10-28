/**
 * 台股交易日。備註規則與 stock-winning-rate 的 twse_calendar.is_trading_day 相同：
 * 日期有列在證交所開休市表時，只有備註 "o" 是交易日（"*" 僅結算交割）；
 * 沒列到的日期，週一到週五視為交易日。
 * 這裡不抓網路，行事曆由呼叫端傳入。
 */

const DATE_COL = /^(\d+)月(\d+)日/;
const ROC_YEAR = /(\d+)年/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const SEARCH_LIMIT_DAYS = 40;

export type TradingCalendar = {
  isTradingDay: (isoDate: string) => boolean;
};

export type TwseSchedule = {
  year: number;
  /** ISO 日期 → 備註。空字串是休市，"o" 是交易日，"*" 僅結算。 */
  remarks: ReadonlyMap<string, string>;
};

export function isIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function addCalendarDays(isoDate: string, days: number): string {
  if (!isIsoDate(isoDate) || !Number.isInteger(days)) {
    throw new Error(`無效日期 ${isoDate}`);
  }
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

/** 有列在表上時只認備註 o；否則週一到週五開市。可合併多個年度。 */
export function twseCalendarFromRemarks(
  remarks: ReadonlyMap<string, string>,
): TradingCalendar {
  return {
    isTradingDay(isoDate: string) {
      if (!isIsoDate(isoDate)) return false;
      const remark = remarks.get(isoDate);
      if (remark !== undefined) return remark === "o";
      const date = new Date(`${isoDate}T00:00:00.000Z`);
      const weekday = date.getUTCDay();
      return weekday >= 1 && weekday <= 5;
    },
  };
}

export function twseCalendar(schedules: readonly TwseSchedule[]): TradingCalendar {
  const remarks = new Map<string, string>();
  for (const schedule of schedules) {
    for (const [isoDate, remark] of schedule.remarks) {
      remarks.set(isoDate, remark);
    }
  }
  return twseCalendarFromRemarks(remarks);
}

/** 沒有休市表時的行事曆：只排除週六、週日。 */
export function weekdayCalendar(): TradingCalendar {
  return twseCalendarFromRemarks(new Map());
}

export function parseTwseHolidayCsv(text: string, fallbackYear: number): TwseSchedule {
  const rows = parseCsv(text.replace(/^\uFEFF/, ""));
  if (rows.length === 0) {
    throw new Error("證交所開休市 CSV 為空");
  }

  let year = fallbackYear;
  const rocMatch = ROC_YEAR.exec(rows[0][0] ?? "");
  if (rocMatch) year = Number(rocMatch[1]) + 1911;

  const remarks = new Map<string, string>();
  for (const row of rows.slice(2)) {
    const dateMatch = DATE_COL.exec((row[0] ?? "").trim());
    if (!dateMatch) continue;
    const month = Number(dateMatch[1]);
    const day = Number(dateMatch[2]);
    const isoDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (!isIsoDate(isoDate)) continue;
    remarks.set(isoDate, (row[3] ?? "").trim());
  }

  return { year, remarks };
}

/** 嚴格在 fromIso 之後的第 count 個交易日。 */
export function addTradingDays(
  fromIso: string,
  count: number,
  calendar: TradingCalendar,
): string {
  if (!isIsoDate(fromIso)) throw new Error(`無效日期 ${fromIso}`);
  if (!Number.isInteger(count) || count < 1) {
    throw new Error("交易日數必須是正整數");
  }

  let cursor = fromIso;
  let found = 0;
  for (let step = 0; step < SEARCH_LIMIT_DAYS + count; step += 1) {
    cursor = addCalendarDays(cursor, 1);
    if (!calendar.isTradingDay(cursor)) continue;
    found += 1;
    if (found === count) return cursor;
  }
  throw new Error(`找不到 ${fromIso} 之後的交易日`);
}

export function nextTradingDay(afterIso: string, calendar: TradingCalendar): string {
  return addTradingDays(afterIso, 1, calendar);
}

/** 嚴格在 beforeIso 之前的最近交易日。 */
export function previousTradingDay(beforeIso: string, calendar: TradingCalendar): string {
  if (!isIsoDate(beforeIso)) throw new Error(`無效日期 ${beforeIso}`);
  let cursor = beforeIso;
  for (let step = 0; step < SEARCH_LIMIT_DAYS; step += 1) {
    cursor = addCalendarDays(cursor, -1);
    if (calendar.isTradingDay(cursor)) return cursor;
  }
  throw new Error(`找不到 ${beforeIso} 之前的交易日`);
}

/** 成交日之後的第二個交易日。 */
export function settlementDate(tradeDate: string, calendar: TradingCalendar): string {
  return addTradingDays(tradeDate, 2, calendar);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  }
  return rows;
}
