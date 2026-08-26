/**
 * Arithmetic on `YYYY-MM-DD` strings.
 *
 * Everything here works in UTC. For date-only values that is exact — no hour
 * shifts around a daylight-saving boundary, no "add one day" that lands on the
 * same day at 23:00 — and it keeps the module free of any dependency, moment
 * included, so the parser and the sanitiser can both use it without dragging
 * Obsidian into their import graph.
 */

const pad2 = (n: number): string => String(n).padStart(2, "0");

export const toParts = (iso: string): [number, number, number] => {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d];
};

const fromUtc = (date: Date): string =>
  `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(
    date.getUTCDate()
  )}`;

const toUtc = (iso: string): Date => {
  const [y, m, d] = toParts(iso);
  return new Date(Date.UTC(y, m - 1, d));
};

export const addDays = (iso: string, days: number): string => {
  const date = toUtc(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtc(date);
};

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export const diffDays = (from: string, to: string): number =>
  Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);

/** 0 = Sunday, matching `Date.getUTCDay()`. */
export const weekdayOf = (iso: string): number => toUtc(iso).getUTCDay();

/** A calendar date, not merely three numbers: rejects February 30th. */
export const buildDate = (
  year: number,
  month: number,
  day: number
): string | null => {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? fromUtc(date)
    : null;
};

/** `MM/DD`, which is how a date reads inside a line of prose. */
export const shortDate = (iso: string): string => {
  const [, month, day] = iso.split("-");
  return `${month}/${day}`;
};
