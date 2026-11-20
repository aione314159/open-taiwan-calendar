import { moment } from "../util/moment";
import type { Moment } from "../util/moment";
import { Store, useStoreValue } from "./store";

/**
 * Which month the calendar shows, and in which view.
 *
 * Held outside the React tree so that a re-render, or the sidebar view being
 * closed and opened again, does not send the grid back to today; and so that
 * commands and other views can move the calendar (setDisplayMonth). Not saved
 * to data.json: after a restart, today's month is the right start.
 */
export interface CalendarViewState {
  /** `YYYY-MM-DD`, any day of the month shown. */
  anchor: string;
  mode: "month" | "year";
}

export const calendarViewStore = new Store<CalendarViewState>({
  anchor: moment().format("YYYY-MM-DD"),
  mode: "month",
});

/** Show the month containing this day (`YYYY-MM-DD` or a Moment). */
export const setDisplayMonth = (day: string | Moment): void => {
  const anchor = typeof day === "string" ? day : day.format("YYYY-MM-DD");
  calendarViewStore.write({ ...calendarViewStore.read(), anchor });
};

export const setViewMode = (mode: CalendarViewState["mode"]): void => {
  calendarViewStore.write({ ...calendarViewStore.read(), mode });
};

export const readDisplayMonth = (): Moment =>
  moment(calendarViewStore.read().anchor, "YYYY-MM-DD");

export const useCalendarView = (): CalendarViewState =>
  useStoreValue(calendarViewStore, (state) => state);
