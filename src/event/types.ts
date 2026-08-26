/**
 * The shape of a user-created calendar entry.
 *
 * One type covers both features the user asked for. A "reminder" and a
 * "range-marked activity" differ only in whether `reminder` is set and whether
 * `end` moves past `start`; modelling them as two types would duplicate the
 * storage, the sanitiser, the calendar rendering and the natural-language
 * parser for no gain.
 *
 * This module imports nothing, so it can be read from any layer without ever
 * forming a cycle (eslint.config.mjs enforces import-x/no-cycle).
 */

/** How a due reminder announces itself. */
export enum ReminderChannel {
  /** A modal dialog in the middle of the window; stays until dismissed. */
  MODAL = "modal",
  /** Obsidian's own corner toast. */
  NOTICE = "notice",
  /** The operating system's notification centre, visible with Obsidian in the background. */
  SYSTEM = "system",
}

export const REMINDER_CHANNELS: readonly ReminderChannel[] = [
  ReminderChannel.MODAL,
  ReminderChannel.NOTICE,
  ReminderChannel.SYSTEM,
];

export interface ReminderRule {
  /**
   * Days before `start` on which to fire, largest first is not required.
   * `[1, 0]` means "once the day before, and once on the day itself" — the
   * example the feature was requested with.
   */
  offsets: number[];
  /** Local wall-clock time of day, `HH:mm`. */
  time: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  /** `YYYY-MM-DD` */
  start: string;
  /** `YYYY-MM-DD`, inclusive. Equal to `start` for a single-day event. */
  end: string;
  /** `#rrggbb`. The colour of the dot drawn on the calendar. */
  color: string;
  /** `null` for an activity with no reminder attached. */
  reminder: ReminderRule | null;
  /** ISO 8601, for ordering entries created on the same day. */
  createdAt: string;
}

/**
 * The frontmatter key each daily note stores its entries under.
 *
 * The notes are the storage. There is no database and no side file: an entry
 * lives in the `---` block of every daily note its dates cover, and the visible
 * checklist at the top of those notes is generated from it. That means the data
 * syncs, versions and merges exactly like the notes themselves, and survives
 * the plugin being uninstalled — which a side file does not.
 */
export const FRONTMATTER_KEY = "otc-events";

/**
 * One entry as it is written into a note's frontmatter.
 *
 * Flat on purpose. Obsidian's property panel renders a nested object as
 * unreadable raw text, and the whole point of putting the data in frontmatter
 * is that the user can see and edit it there. So the reminder rule is spread
 * into two scalar-ish fields rather than nested, and the notification channels
 * are not here at all — they are one global setting, not something worth
 * repeating on every entry.
 */
export interface EventFrontmatterEntry {
  id: string;
  title: string;
  start: string;
  end: string;
  color: string;
  /** Absent when the entry is an activity with no reminder. */
  remindDaysBefore?: number[];
  /** Absent when the entry is an activity with no reminder. */
  remindTime?: string;
  createdAt: string;
}
