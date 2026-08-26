import { Lunar, Solar } from "lunar-typescript";
import type { RocHolidayEntry, RocHolidayResult } from "./types";
import { ROC_HOLIDAY_NAMES, ROC_HOLIDAY_TABLE } from "./rocHolidayData";

const pad2 = (n: number) => String(n).padStart(2, "0");

const solarToMMDD = (solar: ReturnType<typeof Solar.fromYmd>) =>
  `${pad2(solar.getMonth())}-${pad2(solar.getDay())}`;

const shiftSolar = (solar: ReturnType<typeof Solar.fromYmd>, days: number) => {
  const d = new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay());
  d.setDate(d.getDate() + days);
  return Solar.fromYmd(d.getFullYear(), d.getMonth() + 1, d.getDate());
};

/**
 * The year from which the three public holidays restored by the 2025 amendment
 * to the Act on Commemorative Days and Holidays actually take effect.
 * Without this year check, 10-25 in 2019 would be computed as a day off — that
 * is rewriting history, not falling back to a calculation.
 */
const RESTORED_HOLIDAYS_EFFECTIVE_YEAR = 2025;

/**
 * The purely algorithmic version: fixed-date national holidays + the three
 * major lunar festivals + the Qingming solar term (Tomb Sweeping Day).
 * It carries none of the year-by-year day-off adjustments the government
 * announces, but it can be computed for any year, which is what makes it a
 * usable fallback for years ROC_HOLIDAY_TABLE does not cover.
 */
export const computeAlgorithmicHolidays = (year: number): RocHolidayEntry[] => {
  const entries: RocHolidayEntry[] = [
    { date: `01-01`, name: ROC_HOLIDAY_NAMES.foundingDay, isHoliday: true, isMakeupWorkday: false },
    { date: `02-28`, name: ROC_HOLIDAY_NAMES.peaceMemorialDay, isHoliday: true, isMakeupWorkday: false },
    { date: `04-04`, name: ROC_HOLIDAY_NAMES.childrensDay, isHoliday: true, isMakeupWorkday: false },
    { date: `05-01`, name: ROC_HOLIDAY_NAMES.labourDay, isHoliday: true, isMakeupWorkday: false },
    { date: `10-10`, name: ROC_HOLIDAY_NAMES.nationalDay, isHoliday: true, isMakeupWorkday: false },
  ];

  const qingming = Solar.fromYmd(year, 1, 1)
    .getLunar()
    .getJieQiTable()[ROC_HOLIDAY_NAMES.qingmingJieQi];
  if (qingming) {
    entries.push({
      date: solarToMMDD(qingming),
      name: ROC_HOLIDAY_NAMES.tombSweepingDay,
      isHoliday: true,
      isMakeupWorkday: false,
    });
  }

  const chineseNewYear = Lunar.fromYmd(year, 1, 1).getSolar();
  const chuxi = shiftSolar(chineseNewYear, -1);
  entries.push(
    {
      date: solarToMMDD(chuxi),
      name: ROC_HOLIDAY_NAMES.lunarNewYearsEve,
      isHoliday: true,
      isMakeupWorkday: false,
    },
    {
      date: solarToMMDD(chineseNewYear),
      name: ROC_HOLIDAY_NAMES.lunarNewYear,
      isHoliday: true,
      isMakeupWorkday: false,
    },
    {
      date: solarToMMDD(shiftSolar(chineseNewYear, 1)),
      name: ROC_HOLIDAY_NAMES.lunarNewYear,
      isHoliday: true,
      isMakeupWorkday: false,
    },
    {
      date: solarToMMDD(shiftSolar(chineseNewYear, 2)),
      name: ROC_HOLIDAY_NAMES.lunarNewYear,
      isHoliday: true,
      isMakeupWorkday: false,
    }
  );

  const dragonBoat = Lunar.fromYmd(year, 5, 5).getSolar();
  entries.push({
    date: solarToMMDD(dragonBoat),
    name: ROC_HOLIDAY_NAMES.dragonBoatFestival,
    isHoliday: true,
    isMakeupWorkday: false,
  });

  const midAutumn = Lunar.fromYmd(year, 8, 15).getSolar();
  entries.push({
    date: solarToMMDD(midAutumn),
    name: ROC_HOLIDAY_NAMES.midAutumnFestival,
    isHoliday: true,
    isMakeupWorkday: false,
  });

  // Appended after the three major lunar festivals, not before them: the
  // Mid-Autumn Festival can land on 09-28 (the 15th of the 8th lunar month can
  // fall as late as early October). findEntry returns the first match, so
  // pushing the festivals first is what stops Confucius' Birthday from taking
  // over the Mid-Autumn Festival's name on the day they collide.
  if (year >= RESTORED_HOLIDAYS_EFFECTIVE_YEAR) {
    entries.push(
      {
        date: `09-28`,
        name: ROC_HOLIDAY_NAMES.confuciusBirthday,
        isHoliday: true,
        isMakeupWorkday: false,
      },
      {
        date: `10-25`,
        name: ROC_HOLIDAY_NAMES.taiwanRetrocessionDay,
        isHoliday: true,
        isMakeupWorkday: false,
      },
      {
        date: `12-25`,
        name: ROC_HOLIDAY_NAMES.constitutionDay,
        isHoliday: true,
        isMakeupWorkday: false,
      }
    );
  }

  return entries;
};

/** Upper bound on the length of a festival name */
export const HOLIDAY_NAME_MAX_LENGTH = 20;

/** Year key: four digits */
const YEAR_KEY_PATTERN = /^\d{4}$/;
/** Date: MM-DD */
const MMDD_PATTERN = /^\d{2}-\d{2}$/;
/**
 * Allow-list for festival names: CJK characters, ASCII letters, digits, spaces.
 * This doubles as the first line of defence against template injection — the
 * name ends up inside QuickAdd's params, and an allow-list naturally rejects
 * `< > % { } [ ]`, the syntax characters QuickAdd and Templater act on.
 */
const HOLIDAY_NAME_PATTERN =
  /^[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff\u1100-\u11ff\uac00-\ud7a3 0-9A-Za-z]+$/;

export interface SanitizeOverridesResult {
  value: Record<number, RocHolidayEntry[]>;
  /** How many entries were thrown away (a year block or one holiday each count as one) */
  dropped: number;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const sanitizeEntry = (raw: unknown): RocHolidayEntry | null => {
  if (!isPlainObject(raw)) return null;
  const { date, name, isHoliday, isMakeupWorkday } = raw;
  if (typeof date !== "string" || !MMDD_PATTERN.test(date)) return null;
  if (typeof name !== "string") return null;
  if (name.length === 0 || name.length > HOLIDAY_NAME_MAX_LENGTH) return null;
  if (!HOLIDAY_NAME_PATTERN.test(name)) return null;
  if (typeof isHoliday !== "boolean") return null;
  if (typeof isMakeupWorkday !== "boolean") return null;
  return { date, name, isHoliday, isMakeupWorkday };
};

/**
 * Reduce holiday-override data of unknown provenance to a trustworthy shape.
 *
 * This sits at the trust boundary rather than in the input box: data.json is
 * synced by Obsidian Sync / iCloud / git and may come from a vault someone else
 * shared, and that load path never passes through the settings page's input
 * validation. A single bad entry makes getRocHoliday throw a TypeError during
 * a React render; the project has no ErrorBoundary, so React 18 unmounts the
 * whole tree — the calendar goes blank, and stays blank across a restart.
 *
 * Bad entries are dropped one by one instead of the batch being rejected, and
 * the count is reported back so the caller can tell the user.
 */
export const sanitizeOverrides = (raw: unknown): SanitizeOverridesResult => {
  const value: Record<number, RocHolidayEntry[]> = {};
  let dropped = 0;
  if (!isPlainObject(raw)) {
    return { value, dropped: raw === undefined || raw === null ? 0 : 1 };
  }
  for (const [yearKey, yearValue] of Object.entries(raw)) {
    if (!YEAR_KEY_PATTERN.test(yearKey)) {
      dropped += 1;
      continue;
    }
    if (!Array.isArray(yearValue)) {
      dropped += 1;
      continue;
    }
    const entries: RocHolidayEntry[] = [];
    for (const item of yearValue) {
      const entry = sanitizeEntry(item);
      if (entry) {
        entries.push(entry);
      } else {
        dropped += 1;
      }
    }
    // An empty array is kept on purpose: it is the user saying "override this
    // year with nothing", which is also their escape hatch out of bad data.
    value[Number(yearKey)] = entries;
  }
  return { value, dropped };
};

const findEntry = (
  entries: RocHolidayEntry[],
  mmdd: string
): RocHolidayEntry | undefined =>
  Array.isArray(entries) ? entries.find((e) => e.date === mmdd) : undefined;

/**
 * ROC holiday information for a given date.
 * Precedence: the user's override from the settings page (an official
 * announcement for a future year) > the bundled table (years already announced)
 * > the algorithmic fallback.
 */
export const getRocHoliday = (
  year: number,
  month: number,
  day: number,
  overrides?: Record<number, RocHolidayEntry[]>
): RocHolidayResult => {
  const mmdd = `${pad2(month)}-${pad2(day)}`;
  const table = overrides?.[year] ?? ROC_HOLIDAY_TABLE[year];
  const entries = table ?? computeAlgorithmicHolidays(year);
  const entry = findEntry(entries, mmdd);
  if (!entry) {
    return { isHoliday: false, isMakeupWorkday: false };
  }
  return {
    name: entry.name,
    isHoliday: entry.isHoliday,
    isMakeupWorkday: entry.isMakeupWorkday,
  };
};

/**
 * The festival label to display for a date. This replaces lunar-typescript's
 * getFestivals(), whose festival names are specific to mainland China.
 */
export const getRocFestivalLabel = (
  date: Date,
  overrides?: Record<number, RocHolidayEntry[]>
): string | undefined => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const h = getRocHoliday(year, month, day, overrides);
  return h.name;
};

export type { RocHolidayEntry, RocHolidayResult } from "./types";
export { ROC_HOLIDAY_TABLE } from "./rocHolidayData";
