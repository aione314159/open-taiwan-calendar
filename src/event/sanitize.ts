import {
  CalendarEvent,
  EventFrontmatterEntry,
  ReminderRule,
} from "./types";

/**
 * The trust boundary for the entries stored in a note's frontmatter.
 *
 * Frontmatter is text the user can type into directly — Obsidian's property
 * panel is right there — and it is synced, versioned and merged like the rest
 * of the note. It is also written from outside the plugin by the companion
 * Claude Code skill. None of those paths goes through the dialog's validation,
 * so nothing read back may be trusted. A single malformed entry reaching a
 * React render throws during the render pass, and with no ErrorBoundary in the
 * tree React 18 unmounts the whole calendar and leaves it blank across
 * restarts.
 *
 * Bad entries are dropped one at a time and counted, rather than the batch
 * being rejected: one bad hand-edit should not cost the user every other entry.
 *
 * This module deliberately imports nothing from Obsidian, which is what lets it
 * be reasoned about (and unit-tested) as a pure function.
 */

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

/** Long enough for a sentence, short enough that one entry cannot fill a note. */
export const EVENT_TITLE_MAX_LENGTH = 200;

/** A reminder more than a year ahead of its event is a typo, not an intention. */
const MAX_OFFSET_DAYS = 365;

/**
 * Characters removed from a title rather than rejected with it.
 *
 * A title is free text the user typed — rejecting it for containing a comma
 * would be user-hostile — so the dangerous sequences are stripped instead:
 *
 * - control characters and newlines would break the single-line list item the
 *   daily-note block writes, and the single-line YAML value it is stored as;
 * - `%%` is Obsidian's comment delimiter and is what marks the boundaries of
 *   that block, so a title carrying it could close the block early and swallow
 *   the rest of the note;
 * - `{{`, `}}`, `<%` and `%>` are QuickAdd's and Templater's delimiters, the
 *   same ones src/util/templateSafe.ts strips on the way out to those plugins.
 */
// eslint-disable-next-line no-control-regex -- matching control characters is the point: they are what has to be stripped out of a title
const TITLE_STRIP_PATTERN = /[\u0000-\u001f\u007f]|%%|\{\{|\}\}|<%|%>/g;

export const sanitizeTitle = (raw: string): string =>
  raw.replace(TITLE_STRIP_PATTERN, " ").replace(/\s+/g, " ").trim();

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const pad2 = (n: number): string => String(n).padStart(2, "0");

/**
 * A `YYYY-MM-DD` string, whatever YAML turned the value into.
 *
 * An unquoted `2026-10-24` in frontmatter is parsed as a Date by the YAML
 * reader, not as a string — so a value that looks correct in the file arrives
 * here as an object. Both forms are accepted and normalised, which is also what
 * lets a user type the date by hand without having to know to quote it.
 *
 * The pattern alone would let `2026-02-30` through, and a Date would silently
 * roll it forward to March 2nd, so the parts are compared back against the date
 * they produce.
 */
export const toIsoDate = (value: unknown): string | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(
          value.getUTCDate()
        )}`;
  }
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? value
    : null;
};

/**
 * The reminder rule, or null when the entry carries none.
 *
 * The two fields are read together: a time with no offsets, or offsets with no
 * time, is an incomplete rule that could never fire, and a rule that never
 * fires is indistinguishable from no rule at all.
 */
const readReminder = (raw: Record<string, unknown>): ReminderRule | null => {
  const { remindDaysBefore, remindTime } = raw;
  if (typeof remindTime !== "string" || !TIME_PATTERN.test(remindTime)) {
    return null;
  }
  // A single number is accepted alongside a list: "remindDaysBefore: 1" is what
  // someone types by hand, and refusing it over a missing pair of brackets
  // would be pedantry
  const candidates = Array.isArray(remindDaysBefore)
    ? remindDaysBefore
    : [remindDaysBefore];
  const offsets = Array.from(
    new Set(
      candidates.filter(
        (n): n is number =>
          typeof n === "number" &&
          Number.isInteger(n) &&
          n >= 0 &&
          n <= MAX_OFFSET_DAYS
      )
    )
  ).sort((a, b) => b - a);
  return offsets.length === 0 ? null : { offsets, time: remindTime };
};

/**
 * One entry, or null if it cannot be repaired.
 *
 * `seenIds` is carried through a whole scan so a duplicated id — easy to
 * produce by copying an entry between notes — is given a fresh one instead of
 * quietly shadowing the original in every keyed lookup and React list. A
 * multi-day entry is deliberately exempt: it is stored under the same id in
 * every note its range covers, and those copies are the same entry.
 */
export const sanitizeEvent = (
  raw: unknown,
  seenIds?: Set<string>
): CalendarEvent | null => {
  if (!isPlainObject(raw)) return null;
  const { id, title, color, createdAt } = raw;

  if (typeof title !== "string") return null;
  const cleanTitle = sanitizeTitle(title).slice(0, EVENT_TITLE_MAX_LENGTH);
  if (cleanTitle.length === 0) return null;

  const start = toIsoDate(raw.start);
  if (start === null) return null;

  // An end before the start, or a missing one, is repaired to a single-day
  // entry rather than dropped: the user's text is still there and still
  // belongs on the calendar, and a vanished entry is the worse failure.
  const parsedEnd = toIsoDate(raw.end);
  const end = parsedEnd !== null && parsedEnd >= start ? parsedEnd : start;

  const cleanColor =
    typeof color === "string" && COLOR_PATTERN.test(color)
      ? color.toLowerCase()
      : null;
  if (!cleanColor) return null;

  const cleanId =
    typeof id === "string" && id.length > 0 && !seenIds?.has(id)
      ? id
      : crypto.randomUUID();
  seenIds?.add(cleanId);

  return {
    id: cleanId,
    title: cleanTitle,
    start,
    end,
    color: cleanColor,
    reminder: readReminder(raw),
    createdAt:
      typeof createdAt === "string" ? createdAt : new Date().toISOString(),
  };
};

/** Sorted the way every consumer wants to see them: by date, then by age. */
export const sortEvents = (events: CalendarEvent[]): CalendarEvent[] =>
  [...events].sort(
    (a, b) =>
      a.start.localeCompare(b.start) || a.createdAt.localeCompare(b.createdAt)
  );

/**
 * The frontmatter form of an entry.
 *
 * The reminder is spread into two flat fields, and both are left out entirely
 * when there is no reminder — an `otc-events` entry with `remindTime: null`
 * sitting in the property panel reads as a setting the user forgot to fill in.
 */
export const toFrontmatterEntry = (
  event: CalendarEvent
): EventFrontmatterEntry => ({
  id: event.id,
  title: event.title,
  start: event.start,
  end: event.end,
  color: event.color,
  ...(event.reminder
    ? {
        remindDaysBefore: event.reminder.offsets,
        remindTime: event.reminder.time,
      }
    : {}),
  createdAt: event.createdAt,
});
