import { App, PluginSettingTab, Setting, setIcon } from "obsidian";
import type { SettingDefinitionItem, SettingGroupItem } from "obsidian";

import { NoteType } from "../enum";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import HolidayOverrideInput from "../component/HolidayOverrideInput";
// Type-only import: it produces no require at runtime, so it is not a module
// dependency (and import-x/no-cycle lets it through for the same reason)
import type OpenTaiwanCalendarPlugin from "src/main";
import { LayoutMode } from "src/state/settings";
import type { RocHolidayEntry } from "src/holiday/types";
import { readPath } from "src/util/object";
import { noteConfigMap, noteTypeLabel } from "src/enum/noteConfig";
import { t } from "src/i18n";
import { LATEST_OFFICIAL_YEAR } from "src/holiday/rocHolidayData";
import type { NoteConfigItem } from "src/enum/noteConfig";
import { DailySetupModal } from "./DailySetupModal";

// Default height/width ratio of the floating panel, keeping the original
// 400x450 default (8:9)
const FLOATING_WINDOW_HEIGHT_RATIO = 450 / 400;
// Kept in step with MIN_WIDTH in FloatingCalendarPanel
const MIN_FLOATING_WIDTH = 200;

/**
 * The settings page, declared rather than drawn.
 *
 * getSettingDefinitions() is what Obsidian 1.13 renders and, just as
 * importantly, what it indexes for the settings search — a page built in
 * display() is invisible to that search. Obsidian calls display() only when
 * the definitions come back empty, so the two cannot be kept side by side;
 * manifest.json requires 1.13.0 for exactly this reason.
 *
 * Values are never read or written inline. getControlValue / setControlValue
 * below are the single pair of doors between the declared controls and the
 * plugin's own settings storage.
 */
export default class MainSettingTable extends PluginSettingTab {
  plugin: OpenTaiwanCalendarPlugin;

  constructor(app: App, plugin: OpenTaiwanCalendarPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    // Every rule in styles.css is scoped under .otc-settings. The declarative
    // renderer owns the contents of containerEl but not the element itself, so
    // the class is attached once here rather than on each render.
    this.containerEl.addClass("otc-settings");
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      this.hero(),
      this.appearanceGroup(),
      this.floatingGroup(),
      this.holidayGroup(),
      this.noteGroup(),
    ];
  }

  /**
   * Read one control's value.
   *
   * Every control key is the dotted path of the setting it edits, so one
   * readPath call covers the whole page. The assertion stays here, in the one
   * place the framework hands out `unknown` anyway.
   */
  getControlValue(key: string): unknown {
    return readPath(this.plugin.options, key);
  }

  /**
   * Persist one control's value.
   *
   * Each case owns whatever has to happen beyond the write itself — resizing
   * an open floating panel, showing or hiding it, re-evaluating the `visible`
   * predicate of a row further down the page.
   */
  setControlValue(key: string, value: unknown): void {
    switch (key) {
      case "appearance.layout":
        this.plugin.writeOptions(() => ({
          appearance: { layout: value as LayoutMode },
        }));
        break;
      case "appearance.pastTimeTransparent":
        this.plugin.writeOptions(() => ({
          appearance: { pastTimeTransparent: value as boolean },
        }));
        break;
      case "floatingWindow.visible":
        // Opens or closes the panel and persists on its own
        this.plugin.setFloatingPanelVisible(value as boolean);
        return;
      case "floatingWindow.width": {
        const width = Math.max(
          MIN_FLOATING_WIDTH,
          Number(value) || MIN_FLOATING_WIDTH
        );
        const height = Math.round(width * FLOATING_WINDOW_HEIGHT_RATIO);
        this.plugin.writeOptions(() => ({ floatingWindow: { width, height } }));
        // Apply straight away to an open panel; with none open this is just
        // written to the settings and takes effect next time it opens
        this.plugin.applyFloatingPanelSize(width, height);
        break;
      }
      default: {
        // The per-granularity keys: "<note type>.useQuickAdd" and
        // "<note type>.quickAddChoice"
        const [type, field] = key.split(".");
        this.plugin.writeOptions(() => ({ [type]: { [field]: value } }));
        // The choice field is only shown while QuickAdd is on for that
        // granularity, so its visible predicate has to be re-evaluated
        if (field === "useQuickAdd") this.refreshDomState();
        break;
      }
    }
    this.plugin.saveOptions();
  }

  hide() {
    this.plugin.saveOptions();
  }

  /**
   * Read one setting by dotted path.
   *
   * The caller names the type it expects. That keeps the single unavoidable
   * assertion here, in one place, instead of letting an `any` leak out into
   * every predicate on the page.
   */
  getSetting<T>(path: string): T {
    return readPath(this.plugin.options, path) as T;
  }

  /**
   * Mount a React component into a settings row and unmount it with the row.
   *
   * The returned cleanup is what the declarative renderer calls before it
   * tears the row down. Unmounting is deferred by a tick: React refuses to
   * unmount a root while it is still rendering, and the teardown can be
   * triggered from inside a render pass.
   */
  private renderReact(el: HTMLElement, node: ReactNode): () => void {
    const root = createRoot(el);
    root.render(node);
    return () => {
      window.setTimeout(() => root.unmount(), 0);
    };
  }

  /** The page header: the plugin mark, its name and one line about it */
  private hero(): SettingGroupItem {
    return {
      name: t("settings.heroTitle"),
      desc: t("settings.heroSubtitle"),
      // Rendered as the page's own header, not as a setting anyone can search for
      searchable: false,
      render: (setting: Setting) => {
        const el = setting.settingEl;
        el.empty();
        el.addClass("otc-hero");
        setIcon(el.createDiv({ cls: "otc-hero-mark" }), "calendar-days");
        const text = el.createDiv();
        text.createDiv({ cls: "otc-hero-title", text: t("settings.heroTitle") });
        text.createDiv({
          cls: "otc-hero-subtitle",
          text: t("settings.heroSubtitle"),
        });
      },
    };
  }

  /**
   * A card's header row: icon, title, subtitle.
   *
   * A group only carries a plain `heading` string, which has nowhere to put
   * the icon or the subtitle, so the header is a rendered row at the top of
   * the group instead. It is excluded from search: the settings inside the
   * card are what a user searches for, and the card title would only return a
   * row with nothing to change on it.
   */
  private cardHead(
    icon: string,
    title: string,
    subtitle: string
  ): SettingGroupItem {
    return {
      name: title,
      desc: subtitle,
      searchable: false,
      render: (setting: Setting) => {
        const el = setting.settingEl;
        el.empty();
        el.addClass("otc-card-head");
        setIcon(el.createDiv({ cls: "otc-card-icon" }), icon);
        const text = el.createDiv({ cls: "otc-card-head-text" });
        text.createDiv({ cls: "otc-card-title", text: title });
        text.createDiv({ cls: "otc-card-subtitle", text: subtitle });
      },
    };
  }

  /** A paragraph of explanation sitting between the rows of a card */
  private paragraph(
    name: string,
    build: (el: HTMLElement) => void
  ): SettingGroupItem {
    return {
      name,
      searchable: false,
      render: (setting: Setting) => {
        const el = setting.settingEl;
        el.empty();
        el.addClass("otc-card-note");
        build(el.createEl("p", { cls: "setting-item-description" }));
      },
    };
  }

  private appearanceGroup(): SettingDefinitionItem {
    return {
      type: "group",
      cls: "otc-card",
      items: [
        this.cardHead(
          "palette",
          t("settings.appearanceCardTitle"),
          t("settings.appearanceCardSubtitle")
        ),
        {
          name: t("settings.layoutName"),
          desc: t("settings.layoutDesc"),
          control: {
            type: "dropdown",
            key: "appearance.layout",
            options: {
              [LayoutMode.Normal]: t("settings.layoutNormal"),
              [LayoutMode.Small]: t("settings.layoutCompact"),
            },
          },
        },
        {
          name: t("settings.pastTransparentName"),
          desc: t("settings.pastTransparentDesc"),
          control: { type: "toggle", key: "appearance.pastTimeTransparent" },
        },
      ],
    };
  }

  private floatingGroup(): SettingDefinitionItem {
    return {
      type: "group",
      cls: "otc-card",
      items: [
        this.cardHead(
          "picture-in-picture",
          t("settings.floatingCardTitle"),
          t("settings.floatingDesc")
        ),
        {
          name: t("settings.floatingVisibleName"),
          desc: t("settings.floatingDesc"),
          control: { type: "toggle", key: "floatingWindow.visible" },
        },
        {
          name: t("settings.floatingWidthName"),
          desc: t("settings.floatingWidthDesc"),
          control: {
            type: "number",
            key: "floatingWindow.width",
            min: MIN_FLOATING_WIDTH,
          },
        },
      ],
    };
  }

  private holidayGroup(): SettingDefinitionItem {
    return {
      type: "group",
      cls: "otc-card",
      items: [
        this.cardHead(
          "calendar-check",
          t("settings.holidayCardTitle"),
          t("settings.holidayCardSubtitle")
        ),
        this.paragraph(t("settings.holidayCardTitle"), (el) => {
          el.setText(
            t("settings.holidayIntro", {
              latestYear: LATEST_OFFICIAL_YEAR,
              nextYear: LATEST_OFFICIAL_YEAR + 1,
            })
          );
        }),
        {
          name: t("settings.holidayOverrideTitle"),
          desc: t("settings.holidayOverrideSubtitle"),
          // The title and description are drawn by React: the row is emptied
          // completely and the component lays itself out, which is what allows
          // the toolbar buttons to sit at the right of the title row and the
          // editor to take the full width of the row.
          render: (setting: Setting) => {
            const el = setting.settingEl;
            el.empty();
            el.addClass("otc-holiday-override-item");
            return this.renderReact(
              el,
              <HolidayOverrideInput
                title={t("settings.holidayOverrideTitle")}
                subTitle={t("settings.holidayOverrideSubtitle")}
                value={this.getSetting<Record<number, RocHolidayEntry[]>>(
                  "holidayOverrides"
                )}
                onChange={(value) => {
                  // Replace semantics: assign the whole thing, which is exactly
                  // what writeOptions' merge is not allowed to do
                  this.plugin.writeHolidayOverrides(value);
                  this.plugin.saveOptions();
                }}
              />
            );
          },
        },
      ],
    };
  }

  /** The QuickAdd rows for one granularity, plus its heading */
  private noteItems(noteConfigItem: NoteConfigItem): SettingGroupItem[] {
    const { key } = noteConfigItem;
    return [
      {
        name: noteTypeLabel(key),
        searchable: false,
        render: (setting: Setting) => {
          setting.setName(noteTypeLabel(key)).setHeading();
          if (key !== NoteType.DAILY) return;
          setting.addButton((button) => {
            button
              .setButtonText(t("dailySetup.button"))
              .setCta()
              .setTooltip(t("dailySetup.buttonTooltip"))
              .onClick(() =>
                new DailySetupModal(this.app, () => this.update()).open()
              );
            // The button has visible text and still needs an aria-label: what a
            // screen reader should announce is the complete action, not the few
            // words the layout has squeezed the label down to
            button.buttonEl.setAttr("aria-label", t("dailySetup.button"));
            button.buttonEl.addClass("otc-daily-setup-btn");
          });
        },
      },
      {
        name: t("settings.quickAddName"),
        desc: t("settings.quickAddDesc"),
        control: { type: "toggle", key: `${key}.useQuickAdd` },
      },
      {
        name: t("settings.quickAddChoiceTitle"),
        desc: t("settings.quickAddChoiceDesc"),
        // Nothing to configure until QuickAdd is on for this granularity
        visible: () => this.getSetting<boolean>(`${key}.useQuickAdd`),
        control: { type: "text", key: `${key}.quickAddChoice` },
      },
    ];
  }

  private noteGroup(): SettingDefinitionItem {
    return {
      type: "group",
      cls: "otc-card",
      items: [
        this.cardHead(
          "book-open",
          t("settings.notesCardTitle"),
          t("settings.notesCardSubtitle")
        ),
        this.paragraph(t("settings.notesCardTitle"), (el) => {
          el.createEl("a", {
            href: "obsidian://show-plugin?id=periodic-notes",
            text: t("settings.periodicNotesLink"),
          });
        }),
        this.paragraph(t("settings.variablesIntro"), (el) => {
          el.createDiv({ text: t("settings.variablesIntro") });
          const list = el.createEl("ul");
          (
            [
              ["{{lunar}}", t("settings.varLunar")],
              ["{{solarTerm}}", t("settings.varSolarTerm")],
              ["{{festivals}}", t("settings.varFestivals")],
              ["{{ganzhi}}", t("settings.varGanzhi")],
              [
                "{{chineseYear}} / {{chineseMonth}} / {{chineseDay}}",
                t("settings.varChineseParts"),
              ],
              ["{{dateStr}}", t("settings.varDateStr")],
            ] as Array<[string, string]>
          ).forEach(([token, desc]) => {
            const li = list.createEl("li");
            li.createEl("code", { text: token });
            li.appendText(` — ${desc}`);
          });
          el.createDiv({ text: t("settings.builtinTokens") });
        }),
        ...[
          noteConfigMap[NoteType.DAILY],
          noteConfigMap[NoteType.WEEKLY],
          noteConfigMap[NoteType.MONTHLY],
          noteConfigMap[NoteType.QUARTERLY],
          noteConfigMap[NoteType.YEARLY],
        ].flatMap((item) => this.noteItems(item)),
      ],
    };
  }
}
