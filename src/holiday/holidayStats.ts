import type { RocHolidayEntry } from "./types";
import { holidayEntriesOf } from "./rocHoliday";
import { ROC_HOLIDAY_NAMES } from "./rocHolidayData";

/** A day off: a holiday, or a weekend day that is not a make-up workday. */
interface DayInfo {
  off: boolean;
  /** Off only because it is a Saturday or a Sunday */
  weekend: boolean;
  name?: string;
}

/** A stretch of consecutive days off long enough to count as a long weekend. */
export interface DayOffRun {
  /** `YYYY-MM-DD` */
  start: string;
  /** `YYYY-MM-DD` */
  end: string;
  days: number;
  /** The holiday the stretch is for; absent when it has no named holiday */
  name?: string;
}

export interface HolidayStats {
  /** Days off inside the range */
  daysOff: number;
  /** Of those, the Saturdays and Sundays that are not also a holiday */
  weekendDays: number;
  /** Of those, the days off for a holiday or a day off in lieu */
  holidayDays: number;
  /** Long weekends that touch the range, each with its full length */
  runs: DayOffRun[];
}

/** Two days is an ordinary weekend; three or more is a long weekend. */
export const LONG_WEEKEND_MIN_DAYS = 3;

/**
 * How far past each end of the range to look. A long weekend that starts in
 * the previous month still belongs to this one if it reaches into it, and its
 * length should be the real one, not the part that falls inside. The longest
 * Lunar New Year break on record is ten days, so two weeks is more than enough.
 */
const EDGE_DAYS = 14;

const pad2 = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/**
 * The name a long weekend goes by: the holiday covering most of its days.
 * Ties are joined (兒童節・清明節), and a day off in lieu never names one.
 */
const nameOfRun = (days: DayInfo[]): string | undefined => {
  const counts = new Map<string, number>();
  for (const day of days) {
    if (!day.name || day.name === ROC_HOLIDAY_NAMES.dayOffInLieu) continue;
    counts.set(day.name, (counts.get(day.name) ?? 0) + 1);
  }
  const top = Math.max(0, ...counts.values());
  const names = [...counts].filter(([, n]) => n === top).map(([name]) => name);
  return names.length > 0 ? names.join("・") : undefined;
};

/**
 * Days off and long weekends between two dates, both inclusive.
 *
 * Uses the same holiday data as the grid (holidayEntriesOf), so a year the
 * user has overridden in the settings is counted the way it is drawn.
 */
export const holidayStats = (
  from: Date,
  to: Date,
  overrides?: Record<number, RocHolidayEntry[]>
): HolidayStats => {
  const tables = new Map<number, Map<string, RocHolidayEntry>>();
  const entryOn = (d: Date): RocHolidayEntry | undefined => {
    const year = d.getFullYear();
    let table = tables.get(year);
    if (!table) {
      table = new Map();
      // First entry per date wins, the same as getRocHoliday's lookup
      for (const e of holidayEntriesOf(year, overrides)) {
        if (!table.has(e.date)) table.set(e.date, e);
      }
      tables.set(year, table);
    }
    return table.get(`${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
  };
  const infoOf = (d: Date): DayInfo => {
    const entry = entryOn(d);
    if (entry?.isMakeupWorkday) return { off: false, weekend: false };
    if (entry?.isHoliday) return { off: true, weekend: false, name: entry.name };
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    return { off: weekend, weekend };
  };

  const fromIso = isoOf(from);
  const toIso = isoOf(to);
  const stats: HolidayStats = { daysOff: 0, weekendDays: 0, holidayDays: 0, runs: [] };
  let run: Array<[string, DayInfo]> = [];
  const closeRun = () => {
    if (run.length >= LONG_WEEKEND_MIN_DAYS) {
      const start = run[0][0];
      const end = run[run.length - 1][0];
      if (end >= fromIso && start <= toIso) {
        stats.runs.push({
          start,
          end,
          days: run.length,
          name: nameOfRun(run.map(([, info]) => info)),
        });
      }
    }
    run = [];
  };

  const last = addDays(to, EDGE_DAYS);
  for (let d = addDays(from, -EDGE_DAYS); d <= last; d = addDays(d, 1)) {
    const iso = isoOf(d);
    const info = infoOf(d);
    if (info.off) {
      run.push([iso, info]);
      if (iso >= fromIso && iso <= toIso) {
        stats.daysOff += 1;
        if (info.weekend) stats.weekendDays += 1;
        else stats.holidayDays += 1;
      }
    } else {
      closeRun();
    }
  }
  closeRun();
  return stats;
};
