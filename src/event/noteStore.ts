import { App, Notice, TFile } from "obsidian";
import * as dni from "obsidian-daily-notes-interface";
import { GRANULARITY, NoteType } from "../enum";
import { t } from "../i18n";
import { moment } from "../util/moment";
import type { Moment } from "../util/moment";
import { addDays, diffDays } from "./dateMath";
import { inspectEvent, sanitizeEvent, sortEvents, toFrontmatterEntry } from "./sanitize";
import { problemsStore, readEvents, setEvents } from "./store";
import type { EntryProblem } from "./store";
import { settingsStore } from "../state/settings";
import { FRONTMATTER_KEY } from "./types";
import type { CalendarEvent } from "./types";

/**
 * The daily notes are the database.
 *
 * An entry is written into the frontmatter of every daily note its dates cover,
 * and the checklist at the top of those notes is generated from it. Reading is
 * the reverse: walk the daily notes, collect what is under `otc-events`, and
 * fold the copies of a multi-day entry back into one.
 *
 * The cost of this shape, stated plainly: a multi-day entry exists N times on
 * disk, so moving or deleting one has to touch N notes, and the range walk is
 * bounded below to keep a mistyped year from creating four hundred files. What
 * it buys is that the data lives where the user already looks, syncs and
 * versions with the notes, is editable by hand in Obsidian's property panel,
 * and survives the plugin being uninstalled.
 */

/**
 * The most notes one entry may span.
 *
 * `end` comes from user input, and a typo of 2027 instead of 2026 would
 * otherwise mean this creates hundreds of files. Two months is longer than any
 * plausible single entry and short enough that the worst case is recoverable.
 */
export const MAX_EVENT_DAYS = 62;

/** Every date an entry covers, inclusive, bounded by MAX_EVENT_DAYS. */
export const daysOf = (event: CalendarEvent): string[] => {
  const span = Math.min(diffDays(event.start, event.end), MAX_EVENT_DAYS - 1);
  return Array.from({ length: span + 1 }, (_, i) => addDays(event.start, i));
};

/** The daily-note index, or an empty one when no provider is configured yet. */
const allDailyNotes = (): Record<string, TFile> => {
  try {
    return dni.getAllDailyNotes();
  } catch {
    // Thrown when the configured folder does not exist, which is the ordinary
    // state of a vault that has not set daily notes up. Not an error: it means
    // there are no notes, and therefore no entries.
    return {};
  }
};

/** Open the daily note for a date if it exists; never creates one. Returns whether it did. */
export const openExistingDailyNote = async (app: App, day: string): Promise<boolean> => {
  const file = dailyNoteFor(moment(day, "YYYY-MM-DD"));
  if (!file) return false;
  await app.workspace.getLeaf(false).openFile(file);
  return true;
};

/** Open the daily note for a `YYYY-MM-DD` date, creating it if needed. */
export const openDailyNote = async (app: App, day: string): Promise<void> => {
  const ensured = await ensureDailyNote(moment(day, "YYYY-MM-DD"));
  if (ensured) await app.workspace.getLeaf(false).openFile(ensured.file);
};

/** Whether the daily note for a `YYYY-MM-DD` date already exists. Never creates one. */
export const dailyNoteExists = (day: string): boolean =>
  dailyNoteFor(moment(day, "YYYY-MM-DD")) !== null;

const dailyNoteFor = (date: Moment): TFile | null => {
  try {
    return dni.getDailyNote(date, allDailyNotes()) ?? null;
  } catch {
    return null;
  }
};

/** The raw `otc-events` list of one note, straight out of the metadata cache. */
const rawEntriesOf = (app: App, file: TFile): unknown[] => {
  const value = app.metadataCache.getFileCache(file)?.frontmatter?.[
    FRONTMATTER_KEY
  ] as unknown;
  return Array.isArray(value) ? value : [];
};

/**
 * Read every entry in the vault.
 *
 * Goes through the metadata cache rather than reading files, so this is a walk
 * over already-parsed frontmatter and cheap enough to run whenever a note
 * changes. Copies of a multi-day entry are folded together by id, and the first
 * copy wins — they are written identically, so any of them is the entry.
 */
export const collectEvents = (
  app: App,
  problems: EntryProblem[] = []
): CalendarEvent[] => {
  const byId = new Map<string, CalendarEvent>();
  const seenIds = new Set<string>();
  const fallback = settingsStore.read().eventDefaults;
  for (const file of Object.values(allDailyNotes())) {
    for (const [index, raw] of rawEntriesOf(app, file).entries()) {
      // The id is checked before sanitising: sanitizeEvent hands a duplicate a
      // fresh id, which is right for two different entries that collided and
      // wrong for the same entry seen in the second note of its range
      const id = (raw as { id?: unknown })?.id;
      if (typeof id === "string" && byId.has(id)) continue;
      const { event, reason } = inspectEvent(raw, seenIds, fallback);
      if (reason) problems.push({ path: file.path, index, reason });
      if (event) byId.set(event.id, event);
    }
  }
  return sortEvents([...byId.values()]);
};

/** Re-read the vault into the store. */
export const refreshEvents = (app: App): void => {
  const problems: EntryProblem[] = [];
  setEvents(collectEvents(app, problems));
  problemsStore.write(problems);
  notifyProblems(problems);
};

/**
 * The problem sets already announced this session.
 *
 * Every note change re-reads the vault, so without this one bad entry would
 * raise a notice on every keystroke in any daily note.
 */
const announced = new Set<string>();

const notifyProblems = (problems: EntryProblem[]): void => {
  if (problems.length === 0) return;
  const signature = problems
    .map((p) => `${p.path}#${p.index}#${p.reason}`)
    .sort()
    .join("|");
  if (announced.has(signature)) return;
  announced.add(signature);
  new Notice(t("notice.entryProblems", { count: problems.length }), 10_000);
};

/**
 * The daily note for a date, creating it if it is not there.
 *
 * Creating is the point of the feature as asked for — "just create the journal
 * and put it at the top" — so this is the one place in the plugin that makes a
 * file the user did not click for. `createDailyNote` honours whatever template,
 * folder and filename format the vault is configured with.
 */
export const ensureDailyNote = async (
  date: Moment,
  /** Leave the failure notice to the caller, which reports a whole batch at once. */
  quiet = false
): Promise<{ file: TFile; created: boolean } | null> => {
  const existing = dailyNoteFor(date);
  if (existing) return { file: existing, created: false };
  try {
    return { file: await dni.createDailyNote(date), created: true };
  } catch {
    if (!quiet) {
      new Notice(t("notice.dailyNoteCreateFailed", { date: date.format("YYYY-MM-DD") }));
    }
    return null;
  }
};

/** Replace one note's whole entry list. Removing the last one drops the key. */
const writeEntries = async (
  app: App,
  file: TFile,
  entries: CalendarEvent[]
): Promise<void> => {
  // processFrontMatter hands over the parsed frontmatter typed as `any`, which
  // is the honest type for it — the file's contents are arbitrary. The one
  // narrowing that matters happens on the way back in, in sanitizeEvent.
  await app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
    if (entries.length === 0) {
      // Deleting rather than leaving an empty list: `otc-events: []` sitting in
      // the property panel of every note the user ever cleared is litter
      delete frontmatter[FRONTMATTER_KEY];
      return;
    }
    frontmatter[FRONTMATTER_KEY] = entries.map(toFrontmatterEntry);
  });
};

/** One note and the entries it now holds, as just written. */
export interface TouchedNote {
  file: TFile;
  entries: CalendarEvent[];
  /** True when this write created the note. */
  created: boolean;
}

/** What a write did: the notes it changed, and the days it could not write. */
export interface WriteResult {
  touched: TouchedNote[];
  /** `YYYY-MM-DD` days whose note could not be created or written. */
  failed: string[];
}

/** The entries of one note, as sanitised events. */
export const entriesOf = (app: App, file: TFile): CalendarEvent[] =>
  sortEvents(
    rawEntriesOf(app, file)
      .map((raw) => sanitizeEvent(raw))
      .filter((e): e is CalendarEvent => e !== null)
  );

/**
 * Add or replace one entry across the notes of its range.
 *
 * `previous` is the entry as it was before an edit; its days are cleared first,
 * so moving an entry from October to November does not leave a copy behind in
 * October's notes.
 */
export const upsertEvent = async (
  app: App,
  event: CalendarEvent,
  previous?: CalendarEvent
): Promise<WriteResult> => {
  const nextDays = new Set(daysOf(event));
  const staleDays = previous
    ? daysOf(previous).filter((d) => !nextDays.has(d))
    : [];

  // The entries are handed back rather than left to be re-read. Obsidian
  // updates the metadata cache asynchronously after a frontmatter write, so a
  // caller that read the cache straight afterwards would see the note as it was
  // a moment ago — which is exactly how the first note written ended up with an
  // empty checklist while every later one was correct.
  const touched: TouchedNote[] = [];
  for (const day of staleDays) {
    const file = dailyNoteFor(moment(day, "YYYY-MM-DD"));
    if (!file) continue;
    const entries = entriesOf(app, file).filter((e) => e.id !== event.id);
    await writeEntries(app, file, entries);
    touched.push({ file, entries, created: false });
  }

  const failed: string[] = [];
  for (const day of nextDays) {
    const ensured = await ensureDailyNote(moment(day, "YYYY-MM-DD"), true);
    if (!ensured) {
      failed.push(day);
      continue;
    }
    const { file, created } = ensured;
    const entries = sortEvents([
      ...entriesOf(app, file).filter((e) => e.id !== event.id),
      event,
    ]);
    try {
      await writeEntries(app, file, entries);
      touched.push({ file, entries, created });
    } catch {
      failed.push(day);
    }
  }
  return { touched, failed };
};

/** Remove one entry from every note of its range. Never deletes a note. */
export const deleteEvent = async (
  app: App,
  event: CalendarEvent
): Promise<TouchedNote[]> => {
  const touched: TouchedNote[] = [];
  for (const day of daysOf(event)) {
    const file = dailyNoteFor(moment(day, "YYYY-MM-DD"));
    if (!file) continue;
    const entries = entriesOf(app, file).filter((e) => e.id !== event.id);
    await writeEntries(app, file, entries);
    touched.push({ file, entries, created: false });
  }
  return touched;
};

/** Whether a file is a daily note, by asking the configured filename format. */
export const isDailyNote = (file: TFile): boolean => {
  try {
    return dni.getDateFromFile(file, GRANULARITY[NoteType.DAILY]) !== null;
  } catch {
    return false;
  }
};

/** Look up an entry by id across the whole store. */
export const findEvent = (id: string): CalendarEvent | undefined =>
  readEvents().find((e) => e.id === id);
