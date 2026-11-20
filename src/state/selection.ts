import { moment } from "../util/moment";
import { Store, useStoreValue } from "./store";

/**
 * The day the sidebar's day panel is about: today until a day cell is
 * clicked. Kept apart from the month being shown, which the arrows move.
 */
export const selectedDateStore = new Store<string>(moment().format("YYYY-MM-DD"));

export const selectDate = (iso: string): void => selectedDateStore.write(iso);

export const useSelectedDate = (): string => useStoreValue(selectedDateStore, (iso) => iso);
