import { App, Menu, setIcon } from "obsidian";
import { Root } from "react-dom/client";
import { mountCalendarRoot } from "../component/CalendarRoot";
import { t } from "../i18n";
import type { TranslationKey } from "../i18n";
import { fitScale, FitScaleController } from "../util/fitScale";

export interface FloatingCalendarPanelOptions {
  onMove: (x: number, y: number) => void;
  onResize: (width: number, height: number) => void;
  onClose: () => void;
  onOpenSettings: () => void;
}

/** The four corners the panel can be docked to */
type DockCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

/**
 * Translation keys rather than labels: this array is built at module load,
 * before Obsidian's interface language can be read, so a resolved string here
 * would be frozen in whichever locale happened to load first.
 */
const DOCK_CORNERS: Array<{ corner: DockCorner; labelKey: TranslationKey }> = [
  { corner: "top-left", labelKey: "floating.dockTopLeft" },
  { corner: "top-right", labelKey: "floating.dockTopRight" },
  { corner: "bottom-left", labelKey: "floating.dockBottomLeft" },
  { corner: "bottom-right", labelKey: "floating.dockBottomRight" },
];

/** Gap between the panel and the window edge when docked into a corner */
const DOCK_MARGIN = 8;

const MIN_WIDTH = 200;
const MIN_HEIGHT = 220;

/** A draggable, resizable full-month calendar panel; its visual language follows open_monitor's frosted-glass floating panel. */
export class FloatingCalendarPanel {
  readonly el: HTMLElement;
  private readonly bodyEl: HTMLElement;
  private readonly scaleEl: HTMLElement;
  private root: Root | null = null;
  private scaleController: FitScaleController | null = null;
  private dragging = false;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private resizing = false;
  private resizeStartX = 0;
  private resizeStartY = 0;
  private resizeStartW = 0;
  private resizeStartH = 0;

  constructor(
    private readonly app: App,
    private readonly doc: Document,
    x: number,
    y: number,
    width: number,
    height: number,
    private readonly options: FloatingCalendarPanelOptions
  ) {
    // The global createDiv() returns a detached element, which is what the root
    // needs: mount() decides where it goes, and the constructor only builds the
    // tree. Every child below is created through its parent's helper instead,
    // so the whole panel goes through Obsidian's DOM API.
    this.el = createDiv({ cls: "otc-floating-panel" });
    this.el.style.left = `${x}px`;
    this.el.style.top = `${y}px`;
    this.el.style.width = `${Math.max(width, MIN_WIDTH)}px`;
    this.el.style.height = `${Math.max(height, MIN_HEIGHT)}px`;

    const header = this.el.createDiv({ cls: "otc-floating-header" });

    header.createSpan({ cls: "otc-floating-title", text: t("floating.title") });

    const dockBtn = header.createEl("button", {
      cls: ["clickable-icon", "otc-floating-icon-btn"],
      attr: { "aria-label": t("floating.dock") },
    });
    setIcon(dockBtn, "pin");
    dockBtn.addEventListener("click", (evt) => {
      evt.stopPropagation();
      this.openDockMenu(evt);
    });

    const settingsBtn = header.createEl("button", {
      cls: ["clickable-icon", "otc-floating-icon-btn"],
      attr: { "aria-label": t("floating.settings") },
    });
    setIcon(settingsBtn, "settings");
    settingsBtn.addEventListener("click", (evt) => {
      evt.stopPropagation();
      this.options.onOpenSettings();
    });

    const closeBtn = header.createEl("button", {
      cls: ["clickable-icon", "otc-floating-icon-btn"],
      attr: { "aria-label": t("floating.close") },
    });
    setIcon(closeBtn, "x");
    closeBtn.addEventListener("click", (evt) => {
      evt.stopPropagation();
      this.options.onClose();
    });

    this.bodyEl = this.el.createDiv({ cls: "otc-floating-body" });
    this.scaleEl = this.bodyEl.createDiv({ cls: "otc-floating-scale" });

    const resizeHandle = this.el.createDiv({
      cls: "otc-floating-resize-handle",
    });

    header.addEventListener("mousedown", this.onDragStart);
    doc.addEventListener("mousemove", this.onDragMove);
    doc.addEventListener("mouseup", this.onDragEnd);

    resizeHandle.addEventListener("mousedown", this.onResizeStart);
    doc.addEventListener("mousemove", this.onResizeMove);
    doc.addEventListener("mouseup", this.onResizeEnd);
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.el);
    this.root = mountCalendarRoot(this.app, this.scaleEl);
    // The floating panel's size is whatever the user dragged it to and its
    // aspect ratio hugs the content, so allow upscaling to fill and stay centred
    this.scaleController = fitScale(this.bodyEl, this.scaleEl, {
      allowUpscale: true,
      align: "center",
    });
  }

  /**
   * Resize from outside — the settings page applying its width to an already
   * open panel.
   * onResize is deliberately not called back: this size came from the settings
   * page in the first place, and writing it back would just make a round trip.
   * The scale does not need recomputing by hand either: fitScale's
   * ResizeObserver watches bodyEl and recomputes on its own.
   */
  setSize(width: number, height: number): void {
    this.el.style.width = `${Math.max(width, MIN_WIDTH)}px`;
    this.el.style.height = `${Math.max(height, MIN_HEIGHT)}px`;
  }

  /** Open the corner-docking menu (Obsidian's native Menu, so it follows the theme) */
  private openDockMenu(evt: MouseEvent): void {
    const menu = new Menu();
    for (const { corner, labelKey } of DOCK_CORNERS) {
      menu.addItem((item) =>
        item.setTitle(t(labelKey)).onClick(() => this.dockTo(corner))
      );
    }
    menu.showAtMouseEvent(evt);
  }

  /** Snap the panel to a corner and write the new coordinates back */
  private dockTo(corner: DockCorner): void {
    const { width, height } = this.el.getBoundingClientRect();
    const maxX = this.doc.documentElement.clientWidth - width - DOCK_MARGIN;
    const maxY = this.doc.documentElement.clientHeight - height - DOCK_MARGIN;
    const x = corner === "top-left" || corner === "bottom-left" ? DOCK_MARGIN : maxX;
    const y = corner === "top-left" || corner === "top-right" ? DOCK_MARGIN : maxY;
    this.el.style.left = `${Math.max(DOCK_MARGIN, x)}px`;
    this.el.style.top = `${Math.max(DOCK_MARGIN, y)}px`;
    const rect = this.el.getBoundingClientRect();
    this.options.onMove(rect.left, rect.top);
  }

  /** Remove the panel, unmount the React tree, and detach the drag/resize listeners bound to document so nothing is left behind. */
  destroy(): void {
    this.doc.removeEventListener("mousemove", this.onDragMove);
    this.doc.removeEventListener("mouseup", this.onDragEnd);
    this.doc.removeEventListener("mousemove", this.onResizeMove);
    this.doc.removeEventListener("mouseup", this.onResizeEnd);
    this.scaleController?.destroy();
    this.root?.unmount();
    this.el.remove();
  }

  private onDragStart = (evt: MouseEvent): void => {
    this.dragging = true;
    const rect = this.el.getBoundingClientRect();
    this.dragOffsetX = evt.clientX - rect.left;
    this.dragOffsetY = evt.clientY - rect.top;
    evt.preventDefault();
  };

  private onDragMove = (evt: MouseEvent): void => {
    if (!this.dragging) return;
    const x = evt.clientX - this.dragOffsetX;
    const y = evt.clientY - this.dragOffsetY;
    this.el.style.left = `${x}px`;
    this.el.style.top = `${y}px`;
  };

  private onDragEnd = (): void => {
    if (!this.dragging) return;
    this.dragging = false;
    const rect = this.el.getBoundingClientRect();
    this.options.onMove(rect.left, rect.top);
  };

  private onResizeStart = (evt: MouseEvent): void => {
    this.resizing = true;
    const rect = this.el.getBoundingClientRect();
    this.resizeStartX = evt.clientX;
    this.resizeStartY = evt.clientY;
    this.resizeStartW = rect.width;
    this.resizeStartH = rect.height;
    evt.preventDefault();
    evt.stopPropagation();
  };

  private onResizeMove = (evt: MouseEvent): void => {
    if (!this.resizing) return;
    const width = Math.max(
      MIN_WIDTH,
      this.resizeStartW + (evt.clientX - this.resizeStartX)
    );
    const height = Math.max(
      MIN_HEIGHT,
      this.resizeStartH + (evt.clientY - this.resizeStartY)
    );
    this.el.style.width = `${width}px`;
    this.el.style.height = `${height}px`;
  };

  private onResizeEnd = (): void => {
    if (!this.resizing) return;
    this.resizing = false;
    const rect = this.el.getBoundingClientRect();
    this.options.onResize(rect.width, rect.height);
  };
}
