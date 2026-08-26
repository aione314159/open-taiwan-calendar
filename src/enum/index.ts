/**
 * The five note granularities.
 *
 * The string values are not free to change: they double as the keys of this
 * plugin's own data.json and as the keys Periodic Notes uses inside its
 * settings object, so renaming one would silently orphan a user's saved
 * configuration.
 */
export enum NoteType {
  DAILY = "daily",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
  QUARTERLY = "quarterly",
  YEARLY = "yearly",
}

/** Iteration order shared by every caller that has to walk all five granularities. */
export const NOTE_TYPES: readonly NoteType[] = [
  NoteType.DAILY,
  NoteType.WEEKLY,
  NoteType.MONTHLY,
  NoteType.QUARTERLY,
  NoteType.YEARLY,
];

/**
 * obsidian-daily-notes-interface names the same five things in the singular
 * ("day", "week", ...). Its `IGranularity` is a plain string union, so this map
 * is the single place where the two vocabularies meet.
 */
export const GRANULARITY = {
  [NoteType.DAILY]: "day",
  [NoteType.WEEKLY]: "week",
  [NoteType.MONTHLY]: "month",
  [NoteType.QUARTERLY]: "quarter",
  [NoteType.YEARLY]: "year",
} as const;

export type Granularity = (typeof GRANULARITY)[NoteType];
