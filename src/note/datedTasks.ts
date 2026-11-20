import { App, TFile } from "obsidian";
import * as dni from "obsidian-daily-notes-interface";
import { diffDays } from "../event/dateMath";
import { eventsOnDate, readEvents } from "../event/store";
import { parseNaturalLanguage } from "../event/parseNaturalLanguage";
import type { ParsedInput } from "../event/parseNaturalLanguage";
import { moment } from "../util/moment";

/** One open to-do whose text names a day that has not passed. */
export interface DatedTask {
  file: TFile;
  /** The line as written. */
  line: string;
  parsed: ParsedInput;
}

const OPEN_TASK = /^\s*[-*+] \[ \] /;

/**
 * How far into the next year a date with no year may land and still count.
 *
 * The parser gives a date with no year the next occurrence after the note's
 * date, which is right for a plan ("1/5" written on 20 December) and wrong
 * for a note about something that already happened ("8/12 decided ..."
 * written on 29 August becomes next August). A rolled-over date further out
 * than this is taken as a reference to the past.
 */
const MAX_ROLLOVER_DAYS = 90;

/** True when `start` came from a yearless date pushed into the year after the note's. */
const looksLikePastReference = (line: string, start: string, noteDate: string): boolean => {
  const [startYear] = start.split("-");
  const [noteYear] = noteDate.split("-");
  if (Number(startYear) !== Number(noteYear) + 1) return false;
  if (line.includes(startYear)) return false;
  return diffDays(noteDate, start) > MAX_ROLLOVER_DAYS;
};

/**
 * Find open to-dos in daily notes that name today or a later date and have no
 * entry yet.
 *
 * Only notes whose metadata lists an open task are read, so a vault of a
 * thousand notes reads the handful that matter. Relative words are read
 * against the note's own date: "明天" in last week's note meant a day that is
 * already past, and is left out.
 */
export const findDatedTasks = async (
  app: App,
  onProgress: (done: number, total: number) => void
): Promise<DatedTask[]> => {
  let all: Record<string, TFile> = {};
  try {
    all = dni.getAllDailyNotes();
  } catch {
    return [];
  }
  const today = moment().format("YYYY-MM-DD");
  const files = Object.values(all).filter((file) =>
    (app.metadataCache.getFileCache(file)?.listItems ?? []).some((item) => item.task === " ")
  );
  const events = readEvents();
  const found: DatedTask[] = [];
  for (const [index, file] of files.entries()) {
    onProgress(index, files.length);
    const noteDate = dni.getDateFromFile(file, "day")?.format("YYYY-MM-DD");
    if (!noteDate) continue;
    const content = await app.vault.cachedRead(file);
    for (const line of content.split("\n")) {
      if (!OPEN_TASK.test(line)) continue;
      const parsed = parseNaturalLanguage(line, noteDate);
      if (!parsed.matchedDate || parsed.start < today || parsed.start === noteDate) continue;
      if (looksLikePastReference(line, parsed.start, noteDate)) continue;
      const scheduled = eventsOnDate(events, parsed.start).some(
        (event) => event.title === parsed.title
      );
      if (!scheduled) found.push({ file, line: line.trim(), parsed });
    }
  }
  onProgress(files.length, files.length);
  return found.sort((a, b) => a.parsed.start.localeCompare(b.parsed.start));
};
