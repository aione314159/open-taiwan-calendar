import { App, Editor } from "obsidian";
import { openQuickAddEvent } from "../event/commands";
import type { CalendarEvent } from "../event/types";
import { settingsStore } from "../state/settings";

/**
 * Turning the line under the cursor into an entry.
 *
 * The selection is the sentence when there is one; otherwise the whole line
 * the cursor is on, which is how a plan is usually written down — one line —
 * and saves selecting it first. The parser already strips list markers and
 * checkboxes.
 */

/** The mark appended to a line once it has an entry. Not 📅: Tasks reads that as a due date. */
const MARK = { reminder: "🔔", event: "🗓" } as const;
const MARKED = / (?:🔔|🗓) \d{4}-\d{2}-\d{2}$/u;

/**
 * Append the mark to the source line if it is still there and not marked yet.
 *
 * Found again by its text, not its number: saving into the daily note that is
 * open adds frontmatter lines above it and moves it down. Of the lines that
 * still read exactly as it did, the one nearest its old position wins; a line
 * edited while the dialog was open is not marked rather than marked wrongly.
 */
const markLine = (editor: Editor, line: number, original: string, event: CalendarEvent): void => {
  if (MARKED.test(original) || original.trim() === "") return;
  let target = -1;
  for (let i = 0; i < editor.lineCount(); i++) {
    if (editor.getLine(i) !== original) continue;
    if (target === -1 || Math.abs(i - line) < Math.abs(target - line)) target = i;
  }
  if (target === -1) return;
  const mark = event.reminder ? MARK.reminder : MARK.event;
  editor.setLine(target, `${original} ${mark} ${event.start}`);
};

export const addLineAsEntry = (app: App, editor: Editor, remind: boolean): void => {
  const selection = editor.getSelection().trim();
  const line = editor.getCursor().line;
  const original = editor.getLine(line);
  const sentence = selection || original.replace(MARKED, "").trim() || undefined;
  openQuickAddEvent(app, { sentence, remind }, (event) => {
    if (settingsStore.read().eventDefaults.markSourceLine) {
      markLine(editor, line, original, event);
    }
  });
};
