import { createRoot, Root } from "react-dom/client";
import type { Moment } from "moment";
import { App, PaneType } from "obsidian";
import type { NoteIndex } from "../state/notes";
import { openOrCreateNote } from "../note/noteOps";
import { showNoteContextMenu, triggerHoverPreview } from "../note/noteMenu";
import { granularityEnabled } from "../note/periodicNotes";
import { openPluginSettings } from "../util/pluginSettings";
import { NoteType } from "../enum";
import Calendar from "./Calendar";

/**
 * Mount the calendar React tree into a container.
 *
 * Both the sidebar view and the floating panel come through here; each takes
 * care of its own outer container and scaling.
 *
 * `App` is resolved at this layer and nowhere deeper. `Calendar` is a plain
 * React component that never reaches for the Obsidian API, so everything that
 * does need it — opening files, the context menu, the hover preview, asking
 * whether a granularity is switched on — is handed down from here as a
 * callback.
 */
export const mountCalendarRoot = (app: App, container: Element): Root => {
  const root = createRoot(container);
  root.render(
    <Calendar
      openOrCreateNote={(
        date: Moment,
        type: NoteType,
        notes: NoteIndex,
        newLeaf: PaneType | false = false
      ) => {
        void openOrCreateNote(date, type, notes, app, newLeaf);
      }}
      onContextMenu={(
        event: MouseEvent,
        date: Moment,
        type: NoteType,
        notes: NoteIndex
      ) => showNoteContextMenu(app, event, date, type, notes)}
      onHoverPreview={(
        event: MouseEvent,
        target: HTMLElement,
        date: Moment,
        type: NoteType,
        notes: NoteIndex
      ) => triggerHoverPreview(app, event, target, date, type, notes)}
      isNoteTypeEnabled={(type: NoteType) => granularityEnabled(app, type)}
      // openPluginSettings only wants app.setting and a constant id, so there is
      // no reason to thread a whole plugin instance down for one button
      onOpenSettings={() => openPluginSettings(app)}
    />
  );
  return root;
};
