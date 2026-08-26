import type { RocHolidayEntry } from "./types";

/**
 * Government working-day calendar of the Republic of China, as announced by the
 * Directorate-General of Personnel Administration.
 * Source: https://github.com/ruyut/TaiwanCalendar (compiled from the data.gov.tw
 * open data set).
 * Only years with an official announcement are listed here; any year that is
 * missing is picked up by the algorithmic version in rocHoliday.ts.
 *
 * ---------------------------------------------------------------------------
 * intl-release: locale-samples
 *
 * The holiday names below stay in Traditional Chinese on purpose, in every
 * locale. They are proper nouns lifted verbatim from a government calendar, and
 * they are matched against the JSON a user pastes into the "day-off adjustment
 * override" box in the settings page. Translating them would silently break
 * that data contract: an override written against 「補假」 would no longer line
 * up with a table that said "Day off in lieu". They are data, not UI copy, and
 * the international-release scanner is told so by the marker above.
 * ---------------------------------------------------------------------------
 */
export const ROC_HOLIDAY_TABLE: Record<number, RocHolidayEntry[]> = {
  2024: [
    { date: "01-01", name: "開國紀念日", isHoliday: true, isMakeupWorkday: false },
    { date: "02-08", name: "小年夜", isHoliday: true, isMakeupWorkday: false },
    { date: "02-09", name: "農曆除夕", isHoliday: true, isMakeupWorkday: false },
    { date: "02-10", name: "春節", isHoliday: true, isMakeupWorkday: false },
    { date: "02-11", name: "春節", isHoliday: true, isMakeupWorkday: false },
    { date: "02-12", name: "春節", isHoliday: true, isMakeupWorkday: false },
    { date: "02-13", name: "補假", isHoliday: true, isMakeupWorkday: false },
    { date: "02-14", name: "補假", isHoliday: true, isMakeupWorkday: false },
    { date: "02-17", name: "補行上班", isHoliday: false, isMakeupWorkday: true },
    { date: "02-28", name: "和平紀念日", isHoliday: true, isMakeupWorkday: false },
    { date: "04-04", name: "兒童節及民族掃墓節", isHoliday: true, isMakeupWorkday: false },
    { date: "04-05", name: "補假", isHoliday: true, isMakeupWorkday: false },
    { date: "06-10", name: "端午節", isHoliday: true, isMakeupWorkday: false },
    { date: "09-17", name: "中秋節", isHoliday: true, isMakeupWorkday: false },
    { date: "10-10", name: "國慶日", isHoliday: true, isMakeupWorkday: false },
  ],
  2025: [
    { date: "01-01", name: "開國紀念日", isHoliday: true, isMakeupWorkday: false },
    { date: "01-27", name: "小年夜", isHoliday: true, isMakeupWorkday: false },
    { date: "01-28", name: "農曆除夕", isHoliday: true, isMakeupWorkday: false },
    { date: "01-29", name: "春節", isHoliday: true, isMakeupWorkday: false },
    { date: "01-30", name: "春節", isHoliday: true, isMakeupWorkday: false },
    { date: "01-31", name: "春節", isHoliday: true, isMakeupWorkday: false },
    { date: "02-08", name: "補行上班", isHoliday: false, isMakeupWorkday: true },
    { date: "02-28", name: "和平紀念日", isHoliday: true, isMakeupWorkday: false },
    { date: "04-03", name: "補假", isHoliday: true, isMakeupWorkday: false },
    { date: "04-04", name: "兒童節及民族掃墓節", isHoliday: true, isMakeupWorkday: false },
    { date: "05-30", name: "補假", isHoliday: true, isMakeupWorkday: false },
    { date: "05-31", name: "端午節", isHoliday: true, isMakeupWorkday: false },
    { date: "09-28", name: "孔子誕辰紀念日", isHoliday: true, isMakeupWorkday: false },
    { date: "09-29", name: "補假", isHoliday: true, isMakeupWorkday: false },
    { date: "10-06", name: "中秋節", isHoliday: true, isMakeupWorkday: false },
    { date: "10-10", name: "國慶日", isHoliday: true, isMakeupWorkday: false },
    { date: "10-24", name: "補假", isHoliday: true, isMakeupWorkday: false },
    { date: "10-25", name: "臺灣光復暨金門古寧頭大捷紀念日", isHoliday: true, isMakeupWorkday: false },
    { date: "12-25", name: "行憲紀念日", isHoliday: true, isMakeupWorkday: false },
  ],
  2026: [
    { date: "01-01", name: "開國紀念日", isHoliday: true, isMakeupWorkday: false },
    { date: "02-15", name: "小年夜", isHoliday: true, isMakeupWorkday: false },
    { date: "02-16", name: "農曆除夕", isHoliday: true, isMakeupWorkday: false },
    { date: "02-17", name: "春節", isHoliday: true, isMakeupWorkday: false },
    { date: "02-18", name: "春節", isHoliday: true, isMakeupWorkday: false },
    { date: "02-19", name: "春節", isHoliday: true, isMakeupWorkday: false },
    { date: "02-20", name: "補假", isHoliday: true, isMakeupWorkday: false },
    { date: "02-27", name: "補假", isHoliday: true, isMakeupWorkday: false },
    { date: "02-28", name: "和平紀念日", isHoliday: true, isMakeupWorkday: false },
    { date: "04-03", name: "補假", isHoliday: true, isMakeupWorkday: false },
    { date: "04-04", name: "兒童節", isHoliday: true, isMakeupWorkday: false },
    { date: "04-05", name: "清明節", isHoliday: true, isMakeupWorkday: false },
    { date: "04-06", name: "補假", isHoliday: true, isMakeupWorkday: false },
    { date: "05-01", name: "勞動節", isHoliday: true, isMakeupWorkday: false },
    { date: "06-19", name: "端午節", isHoliday: true, isMakeupWorkday: false },
    { date: "09-25", name: "中秋節", isHoliday: true, isMakeupWorkday: false },
    { date: "09-28", name: "孔子誕辰紀念日/教師節", isHoliday: true, isMakeupWorkday: false },
    { date: "10-09", name: "補假", isHoliday: true, isMakeupWorkday: false },
    { date: "10-10", name: "國慶日", isHoliday: true, isMakeupWorkday: false },
    { date: "10-25", name: "臺灣光復暨金門古寧頭大捷紀念日", isHoliday: true, isMakeupWorkday: false },
    { date: "10-26", name: "補假", isHoliday: true, isMakeupWorkday: false },
    { date: "12-25", name: "行憲紀念日", isHoliday: true, isMakeupWorkday: false },
  ],
};

/**
 * The latest year the bundled official table covers, derived from the table.
 * Do not turn this back into a hand-written constant: a hand-written one gets
 * forgotten the next time a year is added, and then the settings page claims a
 * coverage that does not exist — with nothing anywhere raising an error.
 */
export const LATEST_OFFICIAL_YEAR = Math.max(
  ...Object.keys(ROC_HOLIDAY_TABLE).map(Number)
);

/**
 * Holiday names used by the algorithmic fallback in rocHoliday.ts.
 *
 * They live in this file rather than next to the algorithm because they are the
 * same class of thing as ROC_HOLIDAY_TABLE above — official proper nouns that
 * must stay byte-identical to what a user's override JSON can contain — and
 * keeping every one of them in a single file is what lets the rest of src/ be
 * checked for stray non-English text.
 */
export const ROC_HOLIDAY_NAMES = {
  foundingDay: "開國紀念日",
  peaceMemorialDay: "和平紀念日",
  childrensDay: "兒童節",
  labourDay: "勞動節",
  nationalDay: "國慶日",
  tombSweepingDay: "民族掃墓節",
  /** Solar-term key that lunar-typescript's getJieQiTable() is indexed by */
  qingmingJieQi: "清明",
  lunarNewYearsEve: "除夕",
  lunarNewYear: "春節",
  dragonBoatFestival: "端午節",
  midAutumnFestival: "中秋節",
  confuciusBirthday: "孔子誕辰紀念日",
  taiwanRetrocessionDay: "臺灣光復暨金門古寧頭大捷紀念日",
  constitutionDay: "行憲紀念日",
} as const;
