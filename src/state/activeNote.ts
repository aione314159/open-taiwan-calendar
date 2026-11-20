import { Plugin, TFile } from "obsidian";
import { getDateFromFile } from "obsidian-daily-notes-interface";
import { GRANULARITY, NOTE_TYPES, NoteType } from "../enum";
import { settingsStore } from "./settings";
import { Store, useStoreValue } from "./store";
import { readDisplayMonth, setDisplayMonth } from "./view";

/** The periodic note open in the editor, if the active file is one. */
export interface ActiveNote {
  type: NoteType | null;
  /** `YYYY-MM-DD`, the first day of the note's period. */
  iso: string | null;
}

export const activeNoteStore = new Store<ActiveNote>({ type: null, iso: null });

const periodicOf = (file: TFile | null): ActiveNote => {
  if (!file) return { type: null, iso: null };
  for (const type of NOTE_TYPES) {
    try {
      const date = getDateFromFile(file, GRANULARITY[type]);
      if (date) return { type, iso: date.format("YYYY-MM-DD") };
    } catch {
      // A granularity with no provider configured throws; it is just not this one
    }
  }
  return { type: null, iso: null };
};

/**
 * Track the active file. With "follow the open note" on, opening another
 * month's daily note pages the calendar there; anything that is not a daily
 * note leaves the month alone.
 */
export const startActiveNoteTracking = (plugin: Plugin): void => {
  const update = () => {
    const next = periodicOf(plugin.app.workspace.getActiveFile());
    const current = activeNoteStore.read();
    if (next.type !== current.type || next.iso !== current.iso) activeNoteStore.write(next);
    if (
      next.type === NoteType.DAILY &&
      next.iso &&
      settingsStore.read().appearance.followActiveNote &&
      !readDisplayMonth().isSame(next.iso, "month")
    ) {
      setDisplayMonth(next.iso);
    }
  };
  plugin.registerEvent(plugin.app.workspace.on("file-open", update));
  plugin.registerEvent(plugin.app.workspace.on("active-leaf-change", update));
  update();
};

export const useActiveNote = (): ActiveNote => useStoreValue(activeNoteStore, (s) => s);
