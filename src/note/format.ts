import type { Moment } from "moment";
// lunar-typescript API reference: https://6tail.cn/calendar/api.html#overview.html
import { Lunar } from "lunar-typescript";
import { getRocHoliday } from "../holiday/rocHoliday";
import type { RocHolidayEntry } from "../holiday/types";

// ---------------------------------------------------------------------------
// intl-release: locale-samples
//
// lunar-typescript emits the zodiac animal, the lunar month and the solar term
// in Simplified Chinese only. The map below converts just the characters this
// plugin can actually produce, so it is a data table rather than UI copy: the
// keys are the library's output and the values are their Traditional forms.
// Nothing here is ever translated — the plugin's whole purpose is to render the
// lunar calendar in Traditional Chinese, in every interface language.
// ---------------------------------------------------------------------------
const SIMPLIFIED_TO_TRADITIONAL: Record<string, string> = {
  龙: "龍",
  马: "馬",
  鸡: "雞",
  猪: "豬",
  腊: "臘",
  惊: "驚",
  蛰: "蟄",
  谷: "穀",
  满: "滿",
  种: "種",
  处: "處",
};

export const toTraditional = (s: string): string =>
  s.replace(/[龙马鸡猪腊惊蛰谷满种处]/g, (c) => SIMPLIFIED_TO_TRADITIONAL[c]);

/**
 * This whole module is pure: the holiday overrides are passed in by the caller
 * rather than read from the store. Passing them in is what makes the module
 * unit-testable, and what keeps the dependency running from the view towards
 * the state layer rather than back the other way.
 */
export const formatDate = (
  date: Moment,
  holidayOverrides?: Record<number, RocHolidayEntry[]>
) => {
  const d = Lunar.fromDate(date.toDate());
  const solarTerm = toTraditional(d.getJieQi());
  const displayDay =
    d.getDay() === 1
      ? toTraditional(d.getMonthInChinese()).concat("月")
      : d.getDayInChinese();
  const h = getRocHoliday(
    date.get("year"),
    date.get("month") + 1,
    date.get("date"),
    holidayOverrides
  );
  return {
    dateStr: h.name || solarTerm || displayDay,
    isWork: h.isMakeupWorkday,
    isHoliday: h.isHoliday,
  };
};

/** How many characters the one-line label inside a date cell may show */
export const DISPLAY_LABEL_MAX_CHARS = 3;

/**
 * Truncation for the label inside a date cell.
 *
 * Applied uniformly to "the one line of text in a cell" rather than as a
 * special case for festivals: solar terms (白露) and lunar days (廿三) are ≤3
 * characters anyway and are unaffected, while the name can also come from the
 * user-editable override JSON, where sanitizeOverrides only caps the length at
 * 20. Making it a festival-only special case would pin the protection to the
 * one source that happens to be known today.
 *
 * Character count comes from Array.from rather than .length: .length counts
 * UTF-16 code units, so an emoji or a rare supplementary-plane character counts
 * as two and the cut lands in the middle of a character.
 */
export const truncateDisplayLabel = (s: string): string => {
  const chars = Array.from(s);
  if (chars.length <= DISPLAY_LABEL_MAX_CHARS) return s;
  return `${chars.slice(0, DISPLAY_LABEL_MAX_CHARS).join("")}…`;
};

/** The lunar fields derived for one day. Shared by the QuickAdd params and the template-token substitution. */
export interface LunarFields {
  /** Sexagenary year plus zodiac animal, e.g. 乙巳蛇年 */
  chineseYear: string;
  /** Lunar month, e.g. 七月 */
  chineseMonth: string;
  /** Lunar day, e.g. 初三 */
  chineseDay: string;
  /** Sexagenary year, e.g. 乙巳 */
  ganzhi: string;
  /** The solar term of the day; empty string on days that are not one */
  solarTerm: string;
  /** The full lunar string: year, month, day (plus the solar term) */
  lunar: string;
}

/**
 * The one and only place the lunar fields are computed.
 * This used to live inside createNoteQuickAdd, which meant the non-QuickAdd
 * path could not get at any of it; pulling it out lets both paths share a
 * single definition.
 */
export const buildLunarFields = (date: Date): LunarFields => {
  const d = Lunar.fromDate(date);
  const ganzhi = d.getYearInGanZhi();
  const chineseYear = `${ganzhi}${toTraditional(d.getYearShengXiao())}年`;
  const chineseMonth = `${toTraditional(d.getMonthInChinese())}月`;
  const chineseDay = d.getDayInChinese();
  const solarTerm = toTraditional(d.getJieQi()) || "";
  const base = `${chineseYear}${chineseMonth}${chineseDay}`;
  return {
    chineseYear,
    chineseMonth,
    chineseDay,
    ganzhi,
    solarTerm,
    lunar: solarTerm ? `${base} ${solarTerm}` : base,
  };
};

export const formatMonth = (date: Moment) => {
  const d = Lunar.fromDate(new Date(date.get("year"), date.get("month")));
  return toTraditional(d.getMonthInChinese());
};

export const formatLabel = (date: Moment) => {
  const year = date.year();
  const month = date.month();
  const d = Lunar.fromDate(new Date(year, month));
  return `${d.getYearInGanZhi()}${toTraditional(
    d.getYearShengXiao()
  )}年${toTraditional(d.getMonthInChinese())}月`;
};
