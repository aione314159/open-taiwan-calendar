import { App, Plugin, TFile } from "obsidian";
import * as dni from "obsidian-daily-notes-interface";
import { Store, useStoreValue } from "../state/store";

/**
 * Open and handled to-dos per daily note, from the metadata cache only.
 *
 * Obsidian has already parsed every note's list items, `task` included, so the
 * counts cost no file reads even in a vault of a thousand daily notes. Any
 * status character other than a space counts as handled.
 */

export interface TaskCount {
  open: number;
  done: number;
}

/** Keyed by `YYYY-MM-DD`; days whose note has no to-dos are absent. */
export const taskStatsStore = new Store<Record<string, TaskCount>>({});

const countOf = (app: App, file: TFile): TaskCount | null => {
  const items = app.metadataCache.getFileCache(file)?.listItems ?? [];
  let open = 0;
  let done = 0;
  for (const item of items) {
    if (item.task === undefined) continue;
    if (item.task === " ") open++;
    else done++;
  }
  return open + done === 0 ? null : { open, done };
};

const dayOf = (file: TFile): string | null => {
  try {
    return dni.getDateFromFile(file, "day")?.format("YYYY-MM-DD") ?? null;
  } catch {
    return null;
  }
};

const rebuild = (app: App): void => {
  let all: Record<string, TFile> = {};
  try {
    all = dni.getAllDailyNotes();
  } catch {
    taskStatsStore.write({});
    return;
  }
  const next: Record<string, TaskCount> = {};
  for (const file of Object.values(all)) {
    const day = dayOf(file);
    const count = day ? countOf(app, file) : null;
    if (day && count) next[day] = count;
  }
  taskStatsStore.write(next);
};

/** Fill the store now and keep it current, one note at a time. */
export const startTaskStats = (plugin: Plugin): void => {
  const { app } = plugin;
  rebuild(app);
  plugin.registerEvent(
    app.metadataCache.on("changed", (file) => {
      const day = dayOf(file);
      if (!day) return;
      const count = countOf(app, file);
      const current = taskStatsStore.read();
      const before = current[day];
      if (before?.open === count?.open && before?.done === count?.done) return;
      const next = { ...current };
      if (count) next[day] = count;
      else delete next[day];
      taskStatsStore.write(next);
    })
  );
  plugin.registerEvent(app.vault.on("delete", () => rebuild(app)));
  plugin.registerEvent(app.vault.on("rename", () => rebuild(app)));
};

export const useTaskStats = <S>(select: (stats: Record<string, TaskCount>) => S): S =>
  useStoreValue(taskStatsStore, select);
