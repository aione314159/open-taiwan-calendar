import type { CalendarEvent } from "./types";

/**
 * Where an entry sits relative to today.
 *
 * Three buckets rather than two, because "running right now" is the state a
 * list like this exists to surface: a nine-day trip on its fourth day is
 * neither upcoming nor over, and burying it under next month's entries would
 * hide the one thing the user opened the list to check.
 *
 * Shared by the event list and the reading-view block so the two never disagree
 * about what "running now" means — the same reason offsets.ts is shared by the
 * quick-add dialog and the settings page.
 *
 * This module imports nothing but a type, so it can be read from any layer
 * without forming a cycle (eslint.config.mjs enforces import-x/no-cycle).
 */
export type Phase = "current" | "upcoming" | "past";

/** `today` is `YYYY-MM-DD`; the comparisons are plain string ordering. */
export const phaseOf = (event: CalendarEvent, today: string): Phase => {
  if (event.end < today) return "past";
  if (event.start > today) return "upcoming";
  return "current";
};

/** Sort weight: what is running, then what is ahead, then what is over. */
export const PHASE_ORDER: Record<Phase, number> = {
  current: 0,
  upcoming: 1,
  past: 2,
};
