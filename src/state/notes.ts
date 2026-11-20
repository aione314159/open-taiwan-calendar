import {
  getAllDailyNotes,
  getAllWeeklyNotes,
  getAllMonthlyNotes,
  getAllQuarterlyNotes,
  getAllYearlyNotes,
  getDateFromFile,
  getDateFromPath,
} from "obsidian-daily-notes-interface";
import { TAbstractFile, TFile } from "obsidian";
import { GRANULARITY, NOTE_TYPES, NoteType } from "../enum";
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
 * Re-read the granularities a created, deleted or renamed file belongs to.
 *
 * On a rename the old path is checked as well: a note renamed away from its
 * date format leaves the granularity it used to belong to, and that index has
 * to drop it. A file that matches nothing is somebody else's note and needs no
 * reload.
 */
export const refreshNotesTouchedBy = (
  file: TAbstractFile,
  oldPath?: string
): NoteType[] => {
  if (!(file instanceof TFile)) {
    return [];
  }
  const touched = NOTE_TYPES.filter(
    (type) =>
      getDateFromFile(file, GRANULARITY[type]) ||
      (oldPath && getDateFromPath(oldPath, GRANULARITY[type]))
  );
  touched.forEach(refreshNotes);
  return touched;
};

/**
 * Whether a file taken out of the index is still the file at its path.
 *
 * The index holds `TFile` objects. When a note is deleted and written again —
 * a sync client or an external editor replacing it — the vault hands out a new
 * `TFile` and the old one is orphaned. Opening the orphan shows an empty tab
 * named after the date instead of the note.
 */
const isLive = (file: TFile): boolean =>
  file.vault.getAbstractFileByPath(file.path) === file;

/**
 * Find the note for a date, re-reading the vault when the index cannot be
 * trusted.
 *
 * The index is refreshed by vault events, and a missed event leaves it stale
 * until Obsidian restarts. Checking at the moment of the click costs one walk
 * of one folder and turns a stale index into a correct answer.
 */
export const resolveNote = (
  type: NoteType,
  find: (index: Record<string, TFile>) => TFile | null,
  index: NoteIndex
): TFile | null => {
  const cached = index ? find(index) : null;
  if (cached && isLive(cached)) {
    return cached;
  }
  refreshNotes(type);
  const fresh = notesStore.read()[type];
  return fresh ? find(fresh) : null;
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
