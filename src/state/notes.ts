import {
  getAllDailyNotes,
  getAllWeeklyNotes,
  getAllMonthlyNotes,
  getAllQuarterlyNotes,
  getAllYearlyNotes,
} from "obsidian-daily-notes-interface";
import type { TFile } from "obsidian";
import { NOTE_TYPES, NoteType } from "../enum";
import { Store, useStoreValue } from "./store";

/** The notes that already exist for one granularity, keyed by their date string. */
export type NoteIndex = Record<string, TFile> | null;

export type Notes = Record<NoteType, NoteIndex>;

const emptyNotes = (): Notes => {
  const notes = {} as Notes;
  NOTE_TYPES.forEach((type) => {
    notes[type] = null;
  });
  return notes;
};

export const notesStore = new Store<Notes>(emptyNotes());

const READERS: Record<NoteType, () => Record<string, TFile>> = {
  [NoteType.DAILY]: getAllDailyNotes,
  [NoteType.WEEKLY]: getAllWeeklyNotes,
  [NoteType.MONTHLY]: getAllMonthlyNotes,
  [NoteType.QUARTERLY]: getAllQuarterlyNotes,
  [NoteType.YEARLY]: getAllYearlyNotes,
};

/**
 * Re-read one granularity from the vault.
 *
 * The reader throws `XxxNotesFolderMissingError` when the configured folder is
 * not there — which happens the moment someone points Periodic Notes at a
 * folder they have yet to create. That is not a failure, it just means this
 * granularity currently holds no notes, so it is recorded as an empty index. An
 * escaping exception would also abort the rest of `refreshAllNotes`, taking the
 * other four granularities' dots down with it.
 */
export const refreshNotes = (type: NoteType): void => {
  let index: Record<string, TFile>;
  try {
    index = READERS[type]();
  } catch {
    index = {};
  }
  notesStore.write({ ...notesStore.read(), [type]: index });
};

export const refreshAllNotes = (): void => {
  NOTE_TYPES.forEach(refreshNotes);
};

/**
 * Read one granularity's index outside React.
 *
 * Components should reach for `useNotes` so they re-render on change; this is
 * for the callers that have no render to speak of — the settings page and the
 * one-click setup flow. Refresh first if the value has to be current.
 */
export const readNotes = (type: NoteType): NoteIndex => notesStore.read()[type];

export function useNotes<S>(select: (notes: Notes) => S): S {
  return useStoreValue(notesStore, select);
}
