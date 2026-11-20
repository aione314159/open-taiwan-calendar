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

/** Append the mark to the line if it is still the same line and not marked yet. */
const markLine = (editor: Editor, line: number, original: string, event: CalendarEvent): void => {
  if (line >= editor.lineCount()) return;
  const current = editor.getLine(line);
  // The user may have edited the note while the dialog was open; a line that
  // changed is not marked rather than marked in the wrong place
  if (current !== original || MARKED.test(current)) return;
  const mark = event.reminder ? MARK.reminder : MARK.event;
  editor.setLine(line, `${current} ${mark} ${event.start}`);
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
