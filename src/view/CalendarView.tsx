import { Root } from "react-dom/client";
import {
  Events,
  ItemView,
  TAbstractFile,
  TFile,
  WorkspaceLeaf,
} from "obsidian";
import { refreshAllNotes, refreshNotes } from "../state/notes";
import { mountCalendarRoot } from "../component/CalendarRoot";
import { fitScale, FitScaleController } from "../util/fitScale";
import { getDateFromFile } from "obsidian-daily-notes-interface";
import { GRANULARITY, NOTE_TYPES } from "src/enum";
import { t } from "src/i18n";
// Type-only import: it produces no require at runtime, so it is not a module dependency
import type OpenTaiwanCalendarPlugin from "src/main";

export const VIEW_TYPE_CALENDAR = "open-taiwan-calendar-view";

export class CalendarView extends ItemView {
  private root: Root | null = null;
  private scaleController: FitScaleController | null = null;
  readonly plugin: OpenTaiwanCalendarPlugin | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: OpenTaiwanCalendarPlugin) {
    super(leaf);
    this.plugin = plugin;

    // Arrow functions rather than bound methods: `this` is captured by the
    // closure, so there is nothing to bind and nothing to forget to bind.
    const onVaultChange = (file: TAbstractFile) => {
      // Before the layout is ready there is no root to update, and vault
      // events fire in bulk while Obsidian indexes the vault at startup
      if (this.app.workspace.layoutReady && this.root) {
        this.reloadTouchedGranularity(file);
      }
    };

    const workspace = this.app.workspace as Events;
    this.registerEvent(
      workspace.on("periodic-notes:settings-updated", () => refreshAllNotes())
    );
    this.registerEvent(
      workspace.on("open-taiwan-calendar:settings-updated", () => this.render())
    );
    this.registerEvent(this.app.vault.on("create", onVaultChange));
    this.registerEvent(this.app.vault.on("delete", onVaultChange));
    this.registerEvent(this.app.vault.on("rename", onVaultChange));
  }

  /**
   * Work out which granularity a file belongs to and re-read just that one.
   *
   * A file matches at most one granularity, so the first hit ends the search;
   * a file that matches none is somebody else's note and needs no reload.
   */
  private reloadTouchedGranularity(file: TAbstractFile): void {
    if (!(file instanceof TFile)) {
      return;
    }
    const touched = NOTE_TYPES.find((type) =>
      getDateFromFile(file, GRANULARITY[type])
    );
    if (touched) {
      refreshNotes(touched);
    }
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
    this.root = mountCalendarRoot(this.app, inner);
    // The sidebar is tall and narrow: the ratio is decided by the width and the
    // height is necessarily left over, so top alignment is what stops a large
    // gap appearing above the calendar
    this.scaleController = fitScale(outer, inner, {
      allowUpscale: true,
      align: "top",
    });
  }

  // Release resources when the view closes
  async onClose() {
    this.scaleController?.destroy();
    this.scaleController = null;
    this.root?.unmount();
  }
}
