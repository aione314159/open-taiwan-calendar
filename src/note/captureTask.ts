import { App, Notice, TFile } from "obsidian";
import * as dni from "obsidian-daily-notes-interface";
import { NoteType } from "../enum";
import { ensureDailyNote } from "../event/noteStore";
import { t } from "../i18n";
import { moment } from "../util/moment";
import { applyLunarTokens, buildNoteParams } from "./noteOps";

/** Headings deeper than this are groups inside a section, not sections. */
const SECTION_MAX_LEVEL = 2;

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;

/** The level-1 and level-2 headings of a note, in order, without duplicates. */
export const sectionsOf = (app: App, file: TFile): string[] => {
  const headings = app.metadataCache.getFileCache(file)?.headings ?? [];
  return Array.from(
    new Set(
      headings
        .filter((h) => h.level <= SECTION_MAX_LEVEL)
        .map((h) => h.heading.trim())
    )
  );
};

/**
 * The sections to offer for a date.
 *
 * The date's own note when it exists; otherwise the most recent daily note,
 * because a note created from the template will have the same headings.
 */
export const sectionsForDate = (app: App, day: string): string[] => {
  let all: Record<string, TFile> = {};
  try {
    all = dni.getAllDailyNotes();
  } catch {
    return [];
  }
  const own = dni.getDailyNote(moment(day, "YYYY-MM-DD"), all);
  if (own) return sectionsOf(app, own);
  const latest = Object.entries(all).sort(([a], [b]) => b.localeCompare(a))[0];
  return latest ? sectionsOf(app, latest[1]) : [];
};

/**
 * Insert one line at the end of a section's own list.
 *
 * "Its own list" is the part between the section heading and its first
 * sub-heading: a section grouped into `### project` blocks keeps loose items
 * above the groups, not inside the last one. A `---` separator closing the
 * section is not content, so the line goes above it. Returns `found: false`
 * and appends to the end of the note when the section is not there.
 */
export const insertIntoSection = (
  content: string,
  section: string,
  line: string
): { content: string; found: boolean } => {
  const lines = content.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const match = HEADING.exec(lines[i]);
    if (match && match[1].length <= SECTION_MAX_LEVEL && match[2] === section) {
      start = i;
      break;
    }
  }
  if (start === -1) {
    // Appended as-is: the note's own trailing blank lines are its content too
    const separator = content.length === 0 || content.endsWith("\n") ? "" : "\n";
    return { content: `${content}${separator}${line}\n`, found: false };
  }
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const match = HEADING.exec(lines[i]);
    // Any heading ends the section's own list: a deeper one starts a group,
    // a same-or-higher one starts the next section
    if (match) {
      end = i;
      break;
    }
  }
  let last = start;
  for (let i = start + 1; i < end; i++) {
    const text = lines[i].trim();
    if (text && text !== "---") last = i;
  }
  lines.splice(last + 1, 0, line);
  return { content: lines.join("\n"), found: true };
};

/**
 * Write `- [ ] text` into a section of a day's note, creating the note first.
 *
 * Nothing is opened: the point is to jot something down for another day
 * without leaving the note being worked on.
 */
export const captureTask = async (
  app: App,
  day: string,
  section: string,
  text: string
): Promise<void> => {
  const date = moment(day, "YYYY-MM-DD");
  const ensured = await ensureDailyNote(date);
  if (!ensured) return;
  const { file, created } = ensured;
  if (created) {
    await applyLunarTokens(app, file, buildNoteParams(date, NoteType.DAILY, file.basename));
  }
  let found = true;
  await app.vault.process(file, (content) => {
    const result = insertIntoSection(content, section, `- [ ] ${text}`);
    found = result.found;
    return result.content;
  });

  const fragment = createFragment();
  fragment.append(
    found
      ? t("notice.taskCaptured", { date: day, section })
      : t("notice.taskCapturedNoSection", { date: day, section })
  );
  fragment.append(" ");
  const open = fragment.createEl("a", { text: t("notice.openNote") });
  open.addEventListener("click", () => void app.workspace.getLeaf(false).openFile(file));
  new Notice(fragment, 8000);
};
