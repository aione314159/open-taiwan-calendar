import { App, TFile } from "obsidian";
import { t } from "../i18n";
import { settingsStore } from "../state/settings";
import { createConfirmationDialog } from "../view/ConfirmModal";
import type { QuickAddPreset } from "../view/QuickAddEventModal";
import { commitNewEvent, openQuickAddEvent } from "./commands";
import type { InlineReminder } from "./inlineReminders";
import { sanitizeEvent } from "./sanitize";

/** The mark with the space before it, so removing it leaves no trailing gap. */
const MARK = /\s*\(@\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?\)/;

/** The dialog preset for one inline reminder: same text, day and time, fired on the day. */
export const inlineToPreset = (item: InlineReminder): QuickAddPreset => ({
  title: item.text,
  date: item.date,
  end: item.date,
  remind: true,
  offsets: [0],
  ...(item.time ? { time: item.time } : {}),
});

/** Remove the `(@…)` mark from its line, leaving every other character alone. */
export const removeInlineMark = async (app: App, item: InlineReminder): Promise<void> => {
  const file = app.vault.getAbstractFileByPath(item.path);
  if (!(file instanceof TFile)) return;
  await app.vault.process(file, (content) => {
    const lines = content.split("\n");
    const line = lines[item.line];
    // The line may have moved or changed since it was read; touch it only if
    // it still carries a mark for the same day
    if (line === undefined || !line.includes(`(@${item.date}`)) return content;
    lines[item.line] = line.replace(MARK, "");
    return lines.join("\n");
  });
};

/**
 * Turn one inline reminder into a calendar reminder through the usual dialog,
 * then offer to remove the mark. Keeping it is the default: the dialog's own
 * cancel leaves the line exactly as it was.
 */
export const convertInline = (app: App, item: InlineReminder): void => {
  openQuickAddEvent(app, inlineToPreset(item), () =>
    createConfirmationDialog({
      ctx: app,
      title: t("inline.removeMarkTitle"),
      text: t("inline.removeMarkText", { line: item.text }),
      cta: t("inline.removeMark"),
      onAccept: () => removeInlineMark(app, item),
    })
  );
};

/** Batch conversion without dialogs: default colour, the mark's time or the default time. */
export const convertInlineDirectly = async (
  app: App,
  items: InlineReminder[],
  removeMarks: boolean
): Promise<void> => {
  const { reminder, eventDefaults } = settingsStore.read();
  for (const item of items) {
    const event = sanitizeEvent({
      id: crypto.randomUUID(),
      title: item.text,
      start: item.date,
      end: item.date,
      color: eventDefaults.reminderColor,
      remindDaysBefore: [0],
      remindTime: item.time ?? reminder.defaultTime,
      createdAt: new Date().toISOString(),
    });
    if (!event) continue;
    await commitNewEvent(app, event);
    if (removeMarks) await removeInlineMark(app, item);
  }
};
