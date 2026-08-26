// Import order carries no meaning any more: the module dependencies form a
// strict DAG (api -> store -> slice, view -> api), guarded by import/no-cycle in
// .eslintrc.json. The list below is deliberately alphabetical.
import { Notice, Plugin } from "obsidian";
import { sanitizeOverrides } from "./holiday/rocHoliday";
import type { RocHolidayEntry } from "./holiday/types";
import { t } from "./i18n";
import { HOVER_LINK_SOURCE } from "./note/noteMenu";
import { refreshAllNotes } from "./state/notes";
import {
  DeepPartial,
  PluginSetting,
  defaultSetting,
  patchSettings,
  replaceHolidayOverrides,
  settingsStore,
} from "./state/settings";
import { openPluginSettings } from "./util/pluginSettings";
import { CalendarView, VIEW_TYPE_CALENDAR } from "./view/CalendarView";
import { FloatingCalendarPanel } from "./view/FloatingCalendarPanel";
import SettingView from "./view/SettingView";

// The plugin object
export default class OpenTaiwanCalendarPlugin extends Plugin {
  public options: PluginSetting = defaultSetting;
  private floatingPanel: FloatingCalendarPanel | null = null;

  // Initialisation performed when the plugin is enabled
  onload(): void {
    this.register(
      settingsStore.watch(() => {
        this.options = settingsStore.read();
      })
    );

    // Register the calendar view
    this.registerView(
      VIEW_TYPE_CALENDAR,
      (leaf) => new CalendarView(leaf, this)
    );

    this.addCommand({
      // Obsidian prefixes command ids with the plugin id already, so repeating
      // it here would produce open-taiwan-calendar:show-open-taiwan-calendar-view
      id: "open-sidebar",
      name: t("command.openSidebar"),
      checkCallback: (checking: boolean) => {
        if (checking) {
          return (
            this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).length === 0
          );
        }
        this.initLeaf();
      },
    });

    this.addRibbonIcon(
      "calendar-with-checkmark",
      t("command.toggleFloatingPanel"),
      () => this.toggleFloatingPanel()
    );
    this.addCommand({
      id: "toggle-floating-calendar",
      name: t("command.toggleFloatingPanel"),
      callback: () => this.toggleFloatingPanel(),
    });

    // Register the calendar cells' hover preview as a source in the core Page
    // Preview plugin's list, so the user can decide for themselves whether to
    // turn it on. defaultMod: false = preview without holding a modifier key.
    this.registerHoverLinkSource(HOVER_LINK_SOURCE, {
      display: t("hoverSource.display"),
      defaultMod: false,
    });

    // Everything above is synchronous registration. Reading data.json is not,
    // and Plugin.onload is typed to return void, so the asynchronous half is
    // split out and its failure handled rather than left to float away.
    void this.startUp();
  }

  private async startUp(): Promise<void> {
    try {
      await this.loadOptions();
    } catch {
      new Notice(t("notice.loadFailed"));
    }

    this.addSettingTab(new SettingView(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      this.initLeaf();
      if (this.options.floatingWindow.visible) {
        this.showFloatingPanel();
      }
    });
  }

  onunload(): void {
    this.hideFloatingPanel();
  }

  /**
   * The trust boundary: data.json holds arbitrary JSON.
   * It is synced by Obsidian Sync / iCloud / git and may come from a vault
   * someone else shared, so it cannot be treated as trusted input. The holiday
   * overrides go through sanitizeOverrides here, so that bad data cannot travel
   * all the way into a render and take the whole React tree down with it.
   */
  async loadOptions(): Promise<void> {
    const options = ((await this.loadData()) ?? {}) as DeepPartial<PluginSetting>;
    // useScale stopped being a setting once fit-to-container scaling became
    // unconditional. Older data.json files still carry the key, and a merge
    // neither recognises nor discards it — so it gets written straight back out
    // to the file and goes on looking like a real setting.
    if (options.appearance) {
      delete (options.appearance as Record<string, unknown>).useScale;
    }
    const { holidayOverrides, ...rest } = options;
    const { value, dropped } = sanitizeOverrides(holidayOverrides);
    patchSettings(rest);
    // holidayOverrides replaces rather than merges; patchSettings cannot do it
    replaceHolidayOverrides(value);
    if (dropped > 0) {
      new Notice(t("notice.overridesDropped", { count: dropped }));
    }
    await this.saveData(this.options);
  }

  /** Holiday overrides replace wholesale; they do not go through writeOptions' merge */
  writeHolidayOverrides(value: Record<number, RocHolidayEntry[]>): void {
    replaceHolidayOverrides(value);
  }

  writeOptions(changeOpts: () => DeepPartial<PluginSetting>): void {
    patchSettings(changeOpts());
  }

  /**
   * Persist the settings to data.json.
   *
   * Deliberately not async. Every caller is a UI handler that has nothing to do
   * with the result, so returning a promise only ever produced unhandled
   * rejections; a write that fails surfaces as a notice instead.
   */
  saveOptions(): void {
    void this.saveData(this.options)
      .then(() =>
        this.app.workspace.trigger("open-taiwan-calendar:settings-updated")
      )
      .catch(() => new Notice(t("notice.saveFailed")));
  }

  initLeaf(): void {
    if (this.app.workspace.getLeavesOfType(VIEW_TYPE_CALENDAR).length) {
      return;
    }
    void this.app.workspace.getRightLeaf(false)?.setViewState({
      type: VIEW_TYPE_CALENDAR,
    });
  }

  private openSettings(): void {
    openPluginSettings(this.app, this.manifest.id);
  }

  /**
   * Apply a width change from the settings page to an already-open floating
   * panel straight away. If none is open the value is simply written to the
   * settings and picked up next time it opens; nothing extra is needed.
   */
  public applyFloatingPanelSize(width: number, height: number): void {
    this.floatingPanel?.setSize(width, height);
  }

  public setFloatingPanelVisible(visible: boolean): void {
    if (visible) {
      this.showFloatingPanel();
    } else {
      this.hideFloatingPanel();
    }
    this.writeOptions(() => ({ floatingWindow: { visible } }));
    this.saveOptions();
  }

  private toggleFloatingPanel(): void {
    if (this.floatingPanel) {
      this.hideFloatingPanel();
    } else {
      this.showFloatingPanel();
    }
    this.writeOptions(() => ({
      floatingWindow: { visible: this.floatingPanel !== null },
    }));
    this.saveOptions();
  }

  private showFloatingPanel(): void {
    if (this.floatingPanel) return;
    // When the sidebar is closed the floating panel is the only calendar on
    // screen, so it has to load the note data itself — otherwise the "has a
    // note" dots never see state.notes and never appear.
    refreshAllNotes();
    const { x, y, width, height } = this.options.floatingWindow;
    this.floatingPanel = new FloatingCalendarPanel(
      this.app,
      document,
      x,
      y,
      width,
      height,
      {
        onMove: (nx, ny) => {
          this.writeOptions(() => ({ floatingWindow: { x: nx, y: ny } }));
          this.saveOptions();
        },
        onResize: (w, h) => {
          this.writeOptions(() => ({
            floatingWindow: { width: w, height: h },
          }));
          this.saveOptions();
        },
        onClose: () => this.toggleFloatingPanel(),
        onOpenSettings: () => this.openSettings(),
      }
    );
    this.floatingPanel.mount(document.body);
  }

  private hideFloatingPanel(): void {
    this.floatingPanel?.destroy();
    this.floatingPanel = null;
  }
}
