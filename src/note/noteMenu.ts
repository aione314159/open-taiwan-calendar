import type { Moment } from "moment";
import { App, Menu, Notice, TFile } from "obsidian";
import { NoteType } from "../enum";
import { noteTypeLabel } from "../enum/noteConfig";
import { t } from "../i18n";
import type { Notes } from "../state/notes";
import { buildLunarFields } from "./format";
import { noteExists, openOrCreateNote } from "./noteOps";

/** The source identifier handed to Obsidian when triggering the native page preview; main.ts registers the same string */
export const HOVER_LINK_SOURCE = "open-taiwan-calendar";

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
  notes: Notes[NoteType]
): void => {
  const menu = new Menu();
  const file: TFile | null = noteExists(date, type, notes);

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

  if (!file) {
    menu.addSeparator();
    menu.addItem((item) =>
      item
        .setTitle(t("menu.createNote", { noteType: noteTypeLabel(type) }))
        .setIcon("plus")
        .onClick(() => openOrCreateNote(date, type, notes, app))
    );
  }

  menu.showAtMouseEvent(event);
};
