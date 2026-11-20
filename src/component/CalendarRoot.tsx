import { createRoot, Root } from "react-dom/client";
import type { Moment } from "src/util/moment";
import { App, PaneType } from "obsidian";
import type { NoteIndex } from "../state/notes";
import { readNotes } from "../state/notes";
import { openEditEvent, openEventList, openQuickAddEvent } from "../event/commands";
import { eventsOnDate, readEvents } from "../event/store";
import Upcoming from "./Upcoming";
import { toggleListPanel } from "../state/view";
import DayPanel from "./DayPanel";
import { moment } from "src/util/moment";
import { createNoteWithoutOpening, openOrCreateNote } from "../note/noteOps";
import { showNoteContextMenu, triggerHoverPreview } from "../note/noteMenu";
import { granularityEnabled } from "../note/periodicNotes";
import { openPluginSettings } from "../util/pluginSettings";
import { subscribeColorScheme, toggleColorScheme } from "../util/theme";
import { NoteType } from "../enum";
import { CaptureTaskModal } from "../view/CaptureTaskModal";
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
 * whether a granularity is switched on, adding an event — is handed down from
 * here as a callback.
 */
/** The selected day's panel below the sidebar grid. */
export const mountDayPanelRoot = (app: App, container: Element): Root => {
  const root = createRoot(container);
  root.render(
    <DayPanel
      onEdit={(event) => openEditEvent(app, event)}
      onOpenLine={(file, line) =>
        void app.workspace.getLeaf(false).openFile(file, { eState: { line } })
      }
      onCreateNote={(day) =>
        void openOrCreateNote(moment(day, "YYYY-MM-DD"), NoteType.DAILY, readNotes(NoteType.DAILY), app)
      }
      readFile={(file) => app.vault.cachedRead(file)}
      onSaveSettings={() => app.workspace.trigger("open-taiwan-calendar:save-settings")}
    />
  );
  return root;
};

/** The "coming up" list below the sidebar grid, in its own root so it is not scaled. */
export const mountUpcomingRoot = (app: App, container: Element): Root => {
  const root = createRoot(container);
  root.render(
    <Upcoming
      onEdit={(event) => openEditEvent(app, event)}
      onSaveSettings={() => app.workspace.trigger("open-taiwan-calendar:save-settings")}
    />
  );
  return root;
};

export const mountCalendarRoot = (
  app: App,
  container: Element,
  /** The sidebar shows the list under its grid; the floating panel opens the dialog. */
  options: { inlineList?: boolean } = {}
): Root => {
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
        notes: NoteIndex,
        noteActionsDisabled = false
      ) =>
        showNoteContextMenu(app, event, date, type, notes, {
          // Only day cells offer it: an event is bound to a date, and a week or
          // a quarter column has no single date to bind one to
          onAddEvent:
            type === NoteType.DAILY
              ? (target: Moment, remind: boolean) =>
                  openQuickAddEvent(app, { date: target.format("YYYY-MM-DD"), remind })
              : undefined,
          dayEvents:
            type === NoteType.DAILY
              ? eventsOnDate(readEvents(), date.format("YYYY-MM-DD"))
              : [],
          onEditEvent: (event) => openEditEvent(app, event),
          onShowAll: () => openEventList(app),
          onCaptureTask:
            type === NoteType.DAILY
              ? (target: Moment) =>
                  new CaptureTaskModal(app, target.format("YYYY-MM-DD")).open()
              : undefined,
          noteActionsDisabled,
        })
      }
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
      onAddEvent={(date: Moment) =>
        openQuickAddEvent(app, { date: date.format("YYYY-MM-DD") })
      }
      onCreateQuietly={(date: Moment) => void createNoteWithoutOpening(app, date)}
      onShowEventList={() => (options.inlineList ? toggleListPanel() : openEventList(app))}
      onToggleColorScheme={() => toggleColorScheme(app)}
      subscribeColorScheme={(onChange: () => void) =>
        subscribeColorScheme(app, onChange)
      }
    />
  );
  return root;
};
