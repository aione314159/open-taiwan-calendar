import { App, Notice, TFile } from "obsidian";
import * as dni from "obsidian-daily-notes-interface";
import { NoteType } from "../enum";
import { ensureDailyNote } from "../event/noteStore";
import { t } from "../i18n";
import { settingsStore } from "../state/settings";
import { moment } from "../util/moment";
import { applyLunarTokens, buildNoteParams } from "./noteOps";

/**
 * Carrying yesterday's open to-dos into today's note.
 *
 * The text work — finding open tasks, placing them under the same headings —
 * is pure functions over the note body, so it can be reasoned about apart from
 * the vault. Only `carryOver` touches files.
 */

/** Headings at this level or above are sections; deeper ones group inside them. */
const SECTION_MAX_LEVEL = 2;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const OPEN_TASK = /^- \[ \] (.*)$/;
const ANY_OPEN_TASK = /^\s*- \[ \] (.*)$/;

/** One open to-do and the lines nested under it. */
export interface OpenTask {
  /** The level-1/2 heading it is under, or "" before any. */
  section: string;
  /** The deeper heading it is under inside that section, or "". */
  group: string;
  /** Index of its first line in the source note. */
  line: number;
  /** The task line itself, then its indented children, as written. */
  lines: string[];
}

/** The body after the frontmatter, and how many lines the frontmatter took. */
const bodyOf = (content: string): { offset: number; lines: string[] } => {
  const lines = content.split("\n");
  if (lines[0] !== "---") return { offset: 0, lines };
  const close = lines.indexOf("---", 1);
  return close === -1 ? { offset: 0, lines } : { offset: close + 1, lines: lines.slice(close + 1) };
};

const indentOf = (line: string): number => /^\s*/.exec(line)?.[0].length ?? 0;

/** Every top-level open task in a note, with its section, group and children. */
export const extractOpenTasks = (content: string): OpenTask[] => {
  const { offset, lines } = bodyOf(content);
  const tasks: OpenTask[] = [];
  let section = "";
  let group = "";
  for (let i = 0; i < lines.length; i++) {
    const heading = HEADING.exec(lines[i]);
    if (heading) {
      if (heading[1].length <= SECTION_MAX_LEVEL) {
        section = heading[2];
        group = "";
      } else {
        group = heading[2];
      }
      continue;
    }
    if (!OPEN_TASK.test(lines[i])) continue;
    const block = [lines[i]];
    // Children: the following lines indented deeper than the task
    while (
      i + 1 < lines.length &&
      lines[i + 1].trim() !== "" &&
      indentOf(lines[i + 1]) > 0 &&
      !HEADING.test(lines[i + 1])
    ) {
      block.push(lines[++i]);
    }
    tasks.push({ section, group, line: offset + i - (block.length - 1), lines: block });
  }
  return tasks;
};

/** Where a heading line with this text and level range sits, from `from` to `to`. */
const findHeading = (
  lines: string[],
  text: string,
  from: number,
  to: number,
  levelOk: (level: number) => boolean
): number => {
  for (let i = from; i < to; i++) {
    const match = HEADING.exec(lines[i]);
    if (match && levelOk(match[1].length) && match[2] === text) return i;
  }
  return -1;
};

/** Index of the next heading after `from` matching the level test, or the end. */
const nextHeading = (lines: string[], from: number, levelOk: (level: number) => boolean): number => {
  for (let i = from + 1; i < lines.length; i++) {
    const match = HEADING.exec(lines[i]);
    if (match && levelOk(match[1].length)) return i;
  }
  return lines.length;
};

/** The last line in (from, to) that is real content — not blank, not a `---` rule. */
const lastContent = (lines: string[], from: number, to: number): number => {
  let last = from;
  for (let i = from + 1; i < to; i++) {
    const text = lines[i].trim();
    if (text && text !== "---") last = i;
  }
  return last;
};

export interface InsertResult {
  content: string;
  inserted: number;
  skipped: number;
  /** Sections that were not in the target note; their tasks went to the end. */
  missingSections: string[];
}

/**
 * Place tasks into a note under the same section and group they came from.
 *
 * A task whose text already appears as an open task in the target is skipped,
 * so running the command twice adds nothing. A missing group is created as a
 * `###` heading at the end of its section; a missing section sends its tasks
 * to the end of the note.
 */
export const insertTasks = (content: string, tasks: OpenTask[]): InsertResult => {
  const lines = content.split("\n");
  const existing = new Set(
    lines.map((l) => ANY_OPEN_TASK.exec(l)?.[1].trim()).filter((s): s is string => !!s)
  );
  let inserted = 0;
  let skipped = 0;
  const missing = new Set<string>();
  const appended: string[] = [];

  for (const task of tasks) {
    const text = OPEN_TASK.exec(task.lines[0])?.[1].trim() ?? "";
    if (existing.has(text)) {
      skipped++;
      continue;
    }
    existing.add(text);
    inserted++;

    const sectionAt = task.section
      ? findHeading(lines, task.section, 0, lines.length, (l) => l <= SECTION_MAX_LEVEL)
      : -1;
    if (sectionAt === -1) {
      if (task.section) missing.add(task.section);
      appended.push(...task.lines);
      continue;
    }
    const sectionEnd = nextHeading(lines, sectionAt, (l) => l <= SECTION_MAX_LEVEL);
    if (!task.group) {
      // The section's own list: above its first group heading
      const ownEnd = nextHeading(lines, sectionAt, () => true);
      lines.splice(lastContent(lines, sectionAt, Math.min(ownEnd, sectionEnd)) + 1, 0, ...task.lines);
      continue;
    }
    const groupAt = findHeading(lines, task.group, sectionAt + 1, sectionEnd, (l) => l > SECTION_MAX_LEVEL);
    if (groupAt === -1) {
      const at = lastContent(lines, sectionAt, sectionEnd) + 1;
      lines.splice(at, 0, `### ${task.group}`, ...task.lines);
      continue;
    }
    const groupEnd = nextHeading(lines, groupAt, () => true);
    lines.splice(lastContent(lines, groupAt, groupEnd) + 1, 0, ...task.lines);
  }

  let result = lines.join("\n");
  if (appended.length > 0) {
    const separator = result.length === 0 || result.endsWith("\n") ? "" : "\n";
    result = `${result}${separator}${appended.join("\n")}\n`;
  }
  return { content: result, inserted, skipped, missingSections: [...missing] };
};

/** Turn `- [ ]` into `- [>]` on the given source lines. */
export const markMigrated = (content: string, lineIndexes: number[]): string => {
  const lines = content.split("\n");
  for (const index of lineIndexes) {
    lines[index] = lines[index].replace(/^- \[ \] /, "- [>] ");
  }
  return lines.join("\n");
};

/** The latest daily note before today, or null. */
export const previousDailyNote = (): TFile | null => {
  let all: Record<string, TFile> = {};
  try {
    all = dni.getAllDailyNotes();
  } catch {
    return null;
  }
  const today = moment().startOf("day");
  let best: { date: number; file: TFile } | null = null;
  for (const file of Object.values(all)) {
    const date = dni.getDateFromFile(file, "day");
    if (!date || !date.isBefore(today)) continue;
    if (!best || date.valueOf() > best.date) best = { date: date.valueOf(), file };
  }
  return best?.file ?? null;
};

/** Copy the chosen tasks into today's note, creating it from the template if needed. */
export const carryOver = async (app: App, source: TFile, chosen: OpenTask[]): Promise<void> => {
  const today = moment().startOf("day");
  const ensured = await ensureDailyNote(today);
  if (!ensured) return;
  const { file, created } = ensured;
  if (created) {
    await applyLunarTokens(app, file, buildNoteParams(today, NoteType.DAILY, file.basename));
  }
  let result: InsertResult = { content: "", inserted: 0, skipped: 0, missingSections: [] };
  await app.vault.process(file, (content) => {
    result = insertTasks(content, chosen);
    return result.content;
  });
  if (settingsStore.read().carryOverSource === "migrate" && result.inserted > 0) {
    await app.vault.process(source, (content) =>
      markMigrated(content, chosen.map((task) => task.line))
    );
  }
  const parts = [t("notice.carriedOver", { inserted: result.inserted, skipped: result.skipped })];
  if (result.missingSections.length > 0) {
    parts.push(t("notice.carriedOverMissing", { sections: result.missingSections.join(t("event.offsetSeparator")) }));
  }
  new Notice(parts.join(" "), 8000);
};
