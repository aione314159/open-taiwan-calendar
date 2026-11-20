import type { Moment } from "src/util/moment";
import { App, Menu, Notice, TFile } from "obsidian";
import { NoteType } from "../enum";
import { noteTypeLabel } from "../enum/noteConfig";
import { t } from "../i18n";
import type { Notes } from "../state/notes";
import { buildLunarFields } from "./format";
import { shortDate } from "../event/dateMath";
import type { CalendarEvent } from "../event/types";
import {
  createDailyNotesUntil,
  createNoteWithoutOpening,
  noteExists,
  openOrCreateNote,
  silentCreateAvailable,
} from "./noteOps";
import { moment } from "src/util/moment";

/** The source identifier handed to Obsidian when triggering the native page preview; main.ts registers the same string */
export const HOVER_LINK_SOURCE = "open-taiwan-calendar";

/** How many of a day's entries the menu lists before "show all". */
const MAX_MENU_EVENTS = 8;

/**
 * Obsidian's page preview attaches its popover to hoverParent.hoverPopover.
 * The calendar is a React tree with no ItemView instance to hand over, so a
 * module-level holder object stands in — which also means only one preview
 * popover can exist at a time, matching how an ItemView behaves.
 */
const hoverParent = { hoverPopover: null };

/**
 * Trigger Obsidian's native hover preview for a note that already exists.
 * Nothing is triggered when it does not: a hover-link with no target file just
 * makes Obsidian show an empty "create new file" preview.
 */
export const triggerHoverPreview = (
  app: App,
  event: MouseEvent,
  targetEl: HTMLElement,
  date: Moment,
  type: NoteType,
  notes: Notes[NoteType]
): void => {
  const file = noteExists(date, type, notes);
  if (!file) return;
  app.workspace.trigger("hover-link", {
    event,
    source: HOVER_LINK_SOURCE,
    hoverParent,
    targetEl,
    linktext: file.path,
    sourcePath: file.path,
  });
};

const copyLunarDate = async (date: Moment): Promise<void> => {
  const { lunar } = buildLunarFields(date.toDate());
  const text = `${date.format("YYYY-MM-DD")} ${lunar}`;
  try {
    await navigator.clipboard.writeText(text);
    new Notice(t("notice.copied", { text }));
  } catch {
    new Notice(t("notice.copyFailed"));
  }
};

/**
 * The right-click menu for a calendar cell (Obsidian's native Menu, so it
 * follows the theme automatically).
 * The caller is responsible for preventDefault, which is what keeps the
 * browser's own context menu from opening on top of this one.
 */
export const showNoteContextMenu = (
  app: App,
  event: MouseEvent,
  date: Moment,
  type: NoteType,
  notes: Notes[NoteType],
  options: {
    /**
     * Opens the quick-add dialog with this date filled in, as a reminder or as
     * a plain event — the same two choices the editor menu offers.
     */
    onAddEvent?: (date: Moment, remind: boolean) => void;
    /** The entries on this day, listed so they can be opened for editing. */
    dayEvents?: CalendarEvent[];
    onEditEvent?: (event: CalendarEvent) => void;
    /** Opens the full list, when the day has more entries than the menu shows. */
    onShowAll?: () => void;
    /** Opens "note a to-do on this day" for this date. */
    onCaptureTask?: (date: Moment) => void;
    /**
     * True when Periodic Notes has this granularity switched off. The note
     * items are then left out entirely — the cell is already inert for them,
     * and an item that silently refuses is worse than one that is not there.
     */
    noteActionsDisabled?: boolean;
  } = {}
): void => {
  const menu = new Menu();
  const {
    onAddEvent,
    onCaptureTask,
    dayEvents = [],
    onEditEvent,
    onShowAll,
    noteActionsDisabled = false,
  } = options;
  const file: TFile | null = noteActionsDisabled
    ? null
    : noteExists(date, type, notes);

  // First, because it is the only item that works regardless of what Periodic
  // Notes is or is not configured to do
  if (onAddEvent) {
    menu.addItem((item) =>
      item
        .setTitle(t("menu.addReminderOnDay"))
        .setIcon("bell-plus")
        .onClick(() => onAddEvent(date, true))
    );
    menu.addItem((item) =>
      item
        .setTitle(t("menu.addEvent"))
        .setIcon("calendar-plus")
        .onClick(() => onAddEvent(date, false))
    );
    if (onCaptureTask) {
      menu.addItem((item) =>
        item
          .setTitle(t("menu.captureTask"))
          .setIcon("list-plus")
          .onClick(() => onCaptureTask(date))
      );
    }
    menu.addSeparator();
  }

  // The day's own entries, each opening the edit dialog (which can delete).
  // Left out entirely on an empty day, separator included.
  if (onEditEvent && dayEvents.length > 0) {
    for (const event of dayEvents.slice(0, MAX_MENU_EVENTS)) {
      const range =
        event.start === event.end
          ? ""
          : ` (${t("event.dateRange", { start: shortDate(event.start), end: shortDate(event.end) })})`;
      menu.addItem((item) =>
        item
          .setTitle(`${event.title}${range}`)
          .setIcon(event.reminder ? "bell" : "calendar")
          .onClick(() => onEditEvent(event))
      );
    }
    if (dayEvents.length > MAX_MENU_EVENTS && onShowAll) {
      menu.addItem((item) =>
        item
          .setTitle(t("menu.showAllEvents", { count: dayEvents.length }))
          .setIcon("list")
          .onClick(onShowAll)
      );
    }
    menu.addSeparator();
  }

  // No "open" items when the note does not exist: clicking one would only mislead
  if (file) {
    menu.addItem((item) =>
      item
        .setTitle(t("menu.openInNewTab"))
        .setIcon("file-plus")
        .onClick(() => openOrCreateNote(date, type, notes, app, "tab"))
    );
    menu.addItem((item) =>
      item
        .setTitle(t("menu.openToTheRight"))
        .setIcon("separator-vertical")
        .onClick(() => openOrCreateNote(date, type, notes, app, "split"))
    );
    menu.addSeparator();
  }

  menu.addItem((item) =>
    item
      .setTitle(t("menu.copyLunarDate"))
      .setIcon("copy")
      .onClick(() => copyLunarDate(date))
  );

  if (!file && !noteActionsDisabled) {
    menu.addSeparator();
    menu.addItem((item) =>
      item
        .setTitle(t("menu.createNote", { noteType: noteTypeLabel(type) }))
        .setIcon("plus")
        // Picking "create" from a menu is already the confirmation
        .onClick(() => openOrCreateNote(date, type, notes, app, false, false))
    );
    if (type === NoteType.DAILY && silentCreateAvailable(app)) {
      menu.addItem((item) =>
        item
          .setTitle(t("menu.createWithoutOpening"))
          .setIcon("file-plus-2")
          .onClick(() => void createNoteWithoutOpening(app, date))
      );
    }
  }

  // Only for a day after tomorrow: up to tomorrow there is at most one note
  if (
    type === NoteType.DAILY &&
    !noteActionsDisabled &&
    silentCreateAvailable(app) &&
    date.isAfter(moment().add(1, "day"), "day")
  ) {
    menu.addItem((item) =>
      item
        .setTitle(t("menu.createUntilHere"))
        .setIcon("calendar-range")
        .onClick(() => createDailyNotesUntil(app, date))
    );
  }

  menu.showAtMouseEvent(event);
};
