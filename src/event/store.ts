import { Store, useStoreValue } from "../state/store";
import type { EntryProblemReason } from "./sanitize";
import type { CalendarEvent } from "./types";

/**
 * The events currently loaded from events.json.
 *
 * Kept in the same minimal Store the settings and note indexes use, so the
 * React tree and the non-React callers (the reminder scheduler, the daily-note
 * block writer, the settings page) all read one value and see one change.
 *
 * Writes go through src/event/repository.ts, never straight into this store:
 * the file on disk is the source of truth, and a store write that does not
 * reach the file is a change the user loses on the next reload.
 */
export const eventsStore = new Store<CalendarEvent[]>([]);

/** Read outside React. Components should use `useEvents` so they re-render. */
export const readEvents = (): CalendarEvent[] => eventsStore.read();

/** One `otc-events` entry the last read could not use as written. */
export interface EntryProblem {
  /** The daily note it is in. */
  path: string;
  /** Its position in that note's list, from 0. */
  index: number;
  reason: EntryProblemReason;
}

/** What the last read dropped or repaired. Empty when every entry was usable. */
export const problemsStore = new Store<EntryProblem[]>([]);

/** Replace the whole list. Called by the repository after a load or a save. */
export const setEvents = (events: CalendarEvent[]): void =>
  eventsStore.write(events);

/**
 * The events covering one day, `start` and `end` both inclusive.
 *
 * String comparison rather than date arithmetic: `YYYY-MM-DD` sorts
 * lexicographically in calendar order, so this needs no Date objects and is
 * safe to call once per cell in a render pass.
 */
export const eventsOnDate = (
  events: CalendarEvent[],
  dateStr: string
): CalendarEvent[] =>
  events.filter((e) => e.start <= dateStr && dateStr <= e.end);

/** Whether any event overlaps a month, for the year view's dot. */
export const hasEventInMonth = (
  events: CalendarEvent[],
  yearMonth: string
): boolean => {
  const first = `${yearMonth}-01`;
  const last = `${yearMonth}-31`;
  return events.some((e) => e.start <= last && first <= e.end);
};

export function useEvents<S>(select: (events: CalendarEvent[]) => S): S {
  return useStoreValue(eventsStore, select);
}
