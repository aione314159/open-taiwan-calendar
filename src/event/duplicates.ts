import type { InlineReminder } from "./inlineReminders";
import type { CalendarEvent } from "./types";

/**
 * "The same thing set up in both reminder systems."
 *
 * Pure functions: an entry and the inline marks in, the suspected pairs out.
 */

/** Titles closer than this (Dice coefficient over character pairs) count as the same. */
const SIMILARITY_THRESHOLD = 0.6;

/** Lower case, with whitespace, punctuation and symbols removed. */
const normalise = (text: string): string =>
  text.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");

const bigrams = (text: string): string[] =>
  Array.from({ length: Math.max(0, text.length - 1) }, (_, i) => text.slice(i, i + 2));

/** Dice coefficient over character bigrams, 0 to 1. */
const dice = (a: string, b: string): number => {
  const left = bigrams(a);
  const right = bigrams(b);
  if (left.length === 0 || right.length === 0) return 0;
  const pool = [...right];
  let shared = 0;
  for (const pair of left) {
    const at = pool.indexOf(pair);
    if (at !== -1) {
      shared++;
      pool.splice(at, 1);
    }
  }
  return (2 * shared) / (left.length + right.length);
};

/**
 * A shared opening this long is the same task written with different detail:
 * "Renew the car insurance (compare quotes…)" and "Renew the car insurance (call agent…)".
 */
const SHARED_PREFIX = 12;

const commonPrefix = (a: string, b: string): number => {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
};

/** Whether two titles name the same thing: one contains the other, they share a long opening, or they are close. */
export const similarTitles = (a: string, b: string): boolean => {
  const x = normalise(a);
  const y = normalise(b);
  if (x.length < 2 || y.length < 2) return x === y && x.length > 0;
  return (
    x.includes(y) ||
    y.includes(x) ||
    commonPrefix(x, y) >= SHARED_PREFIX ||
    dice(x, y) >= SIMILARITY_THRESHOLD
  );
};

/** The key under which "don't warn about this pair again" is remembered. */
export const duplicateKey = (event: CalendarEvent, item: InlineReminder): string =>
  `${event.id}|${item.path}|${item.text}`;

/**
 * Inline marks that look like the same thing as a reminder on one of its days.
 * Plain markers (no reminder) are not compared: only two reminders can ring twice.
 */
export const findDuplicates = (
  event: Pick<CalendarEvent, "id" | "title" | "start" | "end" | "reminder">,
  inline: InlineReminder[],
  ignored: string[] = []
): InlineReminder[] => {
  if (!event.reminder) return [];
  return inline.filter(
    (item) =>
      item.date >= event.start &&
      item.date <= event.end &&
      similarTitles(event.title, item.text) &&
      !ignored.includes(duplicateKey(event as CalendarEvent, item))
  );
};
