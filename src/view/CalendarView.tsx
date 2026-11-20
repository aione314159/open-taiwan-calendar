import { Root } from "react-dom/client";
import { ItemView, WorkspaceLeaf } from "obsidian";
import { openEditEvent, openQuickAddEvent, removeEvent, setEventDone } from "../event/commands";
import { calendarViewStore } from "../state/view";
import { EventListBody } from "./EventListModal";
import { refreshAllNotes } from "../state/notes";
import {
  mountCalendarRoot,
  mountDayPanelRoot,
  mountUpcomingRoot,
} from "../component/CalendarRoot";
import { fitScale, FitScaleController } from "../util/fitScale";
import { t } from "src/i18n";
// Type-only import: it produces no require at runtime, so it is not a module dependency
import type OpenTaiwanCalendarPlugin from "src/main";

export const VIEW_TYPE_CALENDAR = "open-taiwan-calendar-view";

export class CalendarView extends ItemView {
  private root: Root | null = null;
  private upcomingRoot: Root | null = null;
  private dayPanelRoot: Root | null = null;
  private unwatchList: (() => void) | null = null;
  private scaleController: FitScaleController | null = null;
  readonly plugin: OpenTaiwanCalendarPlugin | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: OpenTaiwanCalendarPlugin) {
    super(leaf);
    this.plugin = plugin;

    // The vault listeners that keep the note index current live on the plugin,
    // not here: the floating panel reads the same index, and it has to stay
    // current while this view is closed or deferred.
    // Settings changes reach the calendar through its own subscriptions
    // (useSetting); re-mounting here on every save sent the grid back to
    // today's month whenever anything — a reminder firing, a snooze, the
    // floating panel moving — wrote data.json
  }

  // The ResizeObserver already covers container size changes; this adds one
  // immediate recompute so dragging does not lag a beat behind
  public onResize(): void {
    this.scaleController?.update();
  }

  // The view type
  getViewType() {
    return VIEW_TYPE_CALENDAR;
  }

  getDisplayText() {
    return t("view.calendarTitle");
  }

  getIcon(): string {
    return "calendar-with-checkmark";
  }

  // Initialisation performed when the view opens
  async onOpen() {
    // Load every granularity's notes
    refreshAllNotes();
    this.render();
  }

  public render() {
    const mountEl = this.containerEl.children[1] as HTMLElement;
    // Unmount first, then clear the DOM. The other way round, React 18 cleans
    // up against a host node that has already been removed and throws
    // NotFoundError: Failed to execute 'removeChild'; render() stops there, the
    // new root is never created, and the calendar is blank.
    // Clearing always goes through Obsidian's native empty(): assigning an HTML
    // string property is a red flag in the community plugin review, and the
    // review bot is a string matcher that does not care whether the right-hand
    // side is an empty string.
    this.scaleController?.destroy();
    this.scaleController = null;
    this.root?.unmount();
    this.root = null;
    this.upcomingRoot?.unmount();
    this.upcomingRoot = null;
    this.dayPanelRoot?.unmount();
    this.dayPanelRoot = null;
    mountEl.empty();

    // Fit-to-container scaling is always applied and is not a setting: in a
    // narrow sidebar, not shrinking clips the content off on the right; in a
    // wide one, not enlarging leaves a large empty strip. Neither is a state a
    // user would want, and with no situation in which "off" is better, it has
    // no business being a switch.
    const outer = mountEl.createDiv({ cls: "otc-view-fit" });
    // The width is pinned to the design width rather than max-content, which
    // would let the grid stretch without bound (the same note is recorded on
    // .otc-floating-scale in styles.css). The height follows the content.
    const inner = outer.createDiv({ cls: "otc-view-scale" });
    this.root = mountCalendarRoot(this.app, inner, { inlineList: true });
    // The sidebar is tall and narrow: the ratio is decided by the width and the
    // height is necessarily left over, so top alignment is what stops a large
    // gap appearing above the calendar
    this.scaleController = fitScale(outer, inner, {
      allowUpscale: true,
      align: "top",
      // The list, day panel and upcoming list go right under the grid
      fitBy: "width",
    });
    this.mountListPanel(mountEl.createDiv({ cls: "otc-event-list-panel" }));
    this.dayPanelRoot = mountDayPanelRoot(this.app, mountEl.createDiv());
    this.upcomingRoot = mountUpcomingRoot(this.app, mountEl.createDiv());
  }

  // Release resources when the view closes
  /**
   * The reminders-and-events list under the grid, opened by the toolbar's
   * list button. Mounted only while open; it scrolls inside a capped height so
   * the grid stays in view.
   */
  private mountListPanel(el: HTMLElement): void {
    this.unwatchList?.();
    let body: EventListBody | null = null;
    const sync = () => {
      const open = calendarViewStore.read().listOpen;
      if (open && !body) {
        el.addClass("is-open");
        body = new EventListBody(
          this.app,
          el,
          (event) => openEditEvent(this.app, event),
          (event) => void removeEvent(this.app, event.id),
          () => openQuickAddEvent(this.app),
          (event) => setEventDone(this.app, event, !event.done),
          // The panel stays open: jumping to a day or adding keeps the list
          () => undefined
        );
        body.mount();
      } else if (!open && body) {
        body.destroy();
        body = null;
        el.removeClass("is-open");
      }
    };
    const unwatch = calendarViewStore.watch(sync);
    this.unwatchList = () => {
      unwatch();
      body?.destroy();
      body = null;
    };
    sync();
  }

  async onClose() {
    this.unwatchList?.();
    this.scaleController?.destroy();
    this.scaleController = null;
    this.root?.unmount();
    this.upcomingRoot?.unmount();
    this.dayPanelRoot?.unmount();
  }
}
