import { App, Notice, TFile } from "obsidian";
import { getDateFromFile } from "obsidian-daily-notes-interface";
import { GRANULARITY, NoteType } from "../enum";
import { t } from "../i18n";
import { EventListModal } from "../view/EventListModal";
import { QuickAddEventModal } from "../view/QuickAddEventModal";
import type { QuickAddPreset } from "../view/QuickAddEventModal";
import {
  deleteEvent,
  findEvent,
  refreshEvents,
  upsertEvent,
} from "./noteStore";
import type { CalendarEvent } from "./types";

/**
 * The one door every event write goes through.
 *
 * Writing an entry has three consequences — the frontmatter of every daily note
 * its range covers, the generated checklist at the top of those notes, and the
 * calendar — and the last two are the easy ones to forget at a call site.
 * Routing the dialog, the context menu and the settings page through here is
 * what stops the three from disagreeing.
 */

/**
 * Re-read the vault after a write.
 *
 * Nothing else has to happen to the notes: the frontmatter *is* the display.
 * There was a generated checklist under the properties for a while, and it was
 * removed as a duplicate — Obsidian's property panel already shows every entry
 * at the top of the note, which is where they were asked to be.
 */
const settle = (app: App): void => refreshEvents(app);

/** Persist a new entry into the notes of its range, creating them as needed. */
export const commitNewEvent = async (
  app: App,
  event: CalendarEvent
): Promise<void> => {
  await upsertEvent(app, event);
  settle(app);
  new Notice(t("notice.eventSaved", { title: event.title }));
};

/**
 * Persist an edit.
 *
 * The entry as it was is passed down so that a change of dates clears the notes
 * it used to live in — otherwise moving an entry leaves a copy behind in every
 * note of its old range.
 */
export const commitEventEdit = async (
  app: App,
  previous: CalendarEvent,
  edited: CalendarEvent
): Promise<void> => {
  await upsertEvent(app, edited, previous);
  settle(app);
};

/** Remove an entry from every note of its range. The notes themselves stay. */
export const removeEvent = async (app: App, id: string): Promise<void> => {
  const doomed = findEvent(id);
  if (!doomed) return;
  await deleteEvent(app, doomed);
  settle(app);
  new Notice(t("notice.eventDeleted", { title: doomed.title }));
};

/**
 * The date of the daily note currently open, if one is.
 *
 * Working inside 27 October's journal and reaching for "add a reminder" almost
 * always means a reminder about that day, not about today — so the note in
 * front of the user is a better default than the clock. `getDateFromFile` reads
 * the date back out of the filename using the configured format, and returns
 * null for anything that is not a daily note, which is the "fall back to today"
 * case.
 */
const activeNoteDate = (app: App): string | undefined => {
  const file = app.workspace.getActiveFile();
  if (!(file instanceof TFile)) return undefined;
  try {
    return (
      getDateFromFile(file, GRANULARITY[NoteType.DAILY])?.format("YYYY-MM-DD") ??
      undefined
    );
  } catch {
    // The reader throws when no daily-note provider is configured at all
    return undefined;
  }
};

/**
 * Open the quick-add dialog to create an entry.
 *
 * The preset carries whatever the entry point already knows: the date from a
 * right-click on a calendar cell, the selected text from a right-click in the
 * editor, and whether the user picked "reminder" or "event" from the two
 * separate menu items. The active journal's date is spread in *first*, so a
 * right-click on a calendar cell still wins — that click names a date outright.
 */
export const openQuickAddEvent = (
  app: App,
  preset: QuickAddPreset = {}
): void => {
  new QuickAddEventModal(
    app,
    (event) => void commitNewEvent(app, event),
    { date: activeNoteDate(app), ...preset }
  ).open();
};

/**
 * Open the same dialog to edit an existing entry.
 *
 * The same dialog rather than a second one built out of settings rows: every
 * field is identical, and the natural-language box is as useful for changing a
 * date as for setting one.
 */
export const openEditEvent = (app: App, event: CalendarEvent): void => {
  new QuickAddEventModal(
    app,
    (edited) => void commitEventEdit(app, event, edited),
    { existing: event }
  ).open();
};

/**
 * Open the list of everything the user has entered.
 *
 * The calendar answers "what is on this day"; this answers "what have I got",
 * which a month view cannot without knowing which month to look in.
 */
export const openEventList = (app: App): void => {
  new EventListModal(
    app,
    (event) => openEditEvent(app, event),
    (event) => void removeEvent(app, event.id),
    () => openQuickAddEvent(app)
  ).open();
};
