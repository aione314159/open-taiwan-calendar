import { App, PluginSettingTab, Setting, setIcon } from "obsidian";
import type { SettingDefinitionItem, SettingGroupItem } from "obsidian";

import { NoteType } from "../enum";
import { openEditEvent, openQuickAddEvent, removeEvent } from "src/event/commands";
import { formatOffsets, formatReminderSummary, parseOffsets } from "src/event/offsets";
import { eventsStore, readEvents } from "src/event/store";
import { REMINDER_CHANNELS, ReminderChannel } from "src/event/types";
import type { CalendarEvent } from "src/event/types";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import HolidayOverrideInput from "../component/HolidayOverrideInput";
// Type-only import: it produces no require at runtime, so it is not a module
// dependency (and import-x/no-cycle lets it through for the same reason)
import type OpenTaiwanCalendarPlugin from "src/main";
import { DotSize, LayoutMode } from "src/state/settings";
import type { RocHolidayEntry } from "src/holiday/types";
import { readPath } from "src/util/object";
import { noteConfigMap, noteTypeLabel } from "src/enum/noteConfig";
import { t } from "src/i18n";
import type { TranslationKey } from "src/i18n";
import { LATEST_OFFICIAL_YEAR } from "src/holiday/rocHolidayData";
import type { NoteConfigItem } from "src/enum/noteConfig";
import { DailySetupModal } from "./DailySetupModal";
import { markSettingRowShapes } from "./settingRowShape";

// Default height/width ratio of the floating panel, keeping the original
// 400x450 default (8:9)
const FLOATING_WINDOW_HEIGHT_RATIO = 450 / 400;
// Kept in step with MIN_WIDTH in FloatingCalendarPanel
const MIN_FLOATING_WIDTH = 200;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * The label pair for each notification channel.
 * A table rather than three copies of the same row, so adding a channel to
 * REMINDER_CHANNELS is the only edit needed to make it appear here.
 */
const CHANNEL_LABELS: Record<
  ReminderChannel,
  { name: TranslationKey; desc: TranslationKey }
> = {
  [ReminderChannel.MODAL]: {
    name: "settings.reminderChannelModalName",
    desc: "settings.reminderChannelModalDesc",
  },
  [ReminderChannel.NOTICE]: {
    name: "settings.reminderChannelNoticeName",
    desc: "settings.reminderChannelNoticeDesc",
  },
  [ReminderChannel.SYSTEM]: {
    name: "settings.reminderChannelSystemName",
    desc: "settings.reminderChannelSystemDesc",
  },
};

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

    /**
     * Re-mark the row shapes after every render.
     *
     * styles.css needs to know which rows hold a text field. `:has()` said so
     * directly until the community CSS lint flagged its invalidation cost, and
     * the declarative renderer owns these rows: `cls` exists on a group but not
     * on an individual definition, so there is nowhere to declare the mark
     * alongside the item. Watching the container covers every path that redraws
     * it — the first open, update(), and Obsidian's own re-renders — without
     * this class having to know which one ran.
     *
     * Only childList is observed, so the class writes below cannot feed back in.
     */
    const shapeMarker = new MutationObserver(() =>
      markSettingRowShapes(this.containerEl)
    );
    shapeMarker.observe(this.containerEl, { childList: true, subtree: true });
    plugin.register(() => shapeMarker.disconnect());

    /**
     * Redraw when the events change underneath the page.
     *
     * getSettingDefinitions() reads the event list once per render, so a page
     * that is already on screen keeps showing whatever was there when it was
     * drawn — which is how an open settings page ended up displaying "nothing
     * yet" while the calendar beside it drew two entries. The events move for
     * reasons that have nothing to do with this page: the first load after
     * startup, a sync from another device, the companion Claude Code skill
     * writing events.json directly.
     *
     * Not guarded on visibility. A closed page looked like the one case that
     * could be skipped, but Obsidian reuses the rendered rows when the page is
     * opened again, so skipping the redraw left the list showing "nothing yet"
     * next time it was opened. Redrawing a page nobody is looking at costs a
     * DOM rebuild that is already cheap enough to run on every event change.
     *
     * Registered through the plugin so the subscription ends when it unloads.
     */
    plugin.register(
      eventsStore.watch(() => {
        try {
          this.update();
        } catch {
          // The tab has no rendered container until Obsidian has shown it once
        }
      })
    );
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      this.hero(),
      this.appearanceGroup(),
      this.floatingGroup(),
      this.holidayGroup(),
      this.eventsGroup(),
      this.eventListGroup(),
      this.noteGroup(),
    ];
  }

  /**
   * The keys that do not map one-to-one onto a stored field.
   *
   * Three shapes need translating between what is stored and what a control can
   * hold: a list of numbers shown as one line of text, an array of channels
   * shown as three separate toggles, and the fields of one event out of a list
   * addressed by its id. Reading and writing them lives in one pair of helpers
   * so the two directions cannot drift apart.
   */
  private readSynthetic(key: string): unknown {
    const { reminder } = this.plugin.options;
    if (key === "reminder.offsetsText") {
      return formatOffsets(reminder.defaultOffsets);
    }
    const channel = REMINDER_CHANNELS.find((c) => key === `reminder.channel.${c}`);
    return channel ? reminder.channels.includes(channel) : undefined;
  }

  /** Returns true when the key was a synthetic one and has been handled. */
  private writeSynthetic(key: string, value: unknown): boolean {
    if (key === "reminder.offsetsText") {
      const offsets = parseOffsets(String(value));
      // A line that does not parse is rejected by `validate` before it reaches
      // here; this guard is what stops a programming slip from writing an empty
      // rule that can never fire
      if (offsets) {
        this.plugin.writeOptions(() => ({ reminder: { defaultOffsets: offsets } }));
      }
      return true;
    }

    const channel = REMINDER_CHANNELS.find((c) => key === `reminder.channel.${c}`);
    if (!channel) return false;
    const current = this.plugin.options.reminder.channels;
    // Rebuilt from REMINDER_CHANNELS rather than appended to, so the stored
    // order is always the declared one and a toggle cannot introduce a duplicate
    const next = value
      ? REMINDER_CHANNELS.filter((c) => c === channel || current.includes(c))
      : current.filter((c) => c !== channel);
    this.plugin.writeOptions(() => ({ reminder: { channels: next } }));
    return true;
  }

  /**
   * Read one control's value.
   *
   * Every control key is the dotted path of the setting it edits, so one
   * readPath call covers the whole page. The assertion stays here, in the one
   * place the framework hands out `unknown` anyway.
   */
  getControlValue(key: string): unknown {
    const synthetic = this.readSynthetic(key);
    return synthetic === undefined ? readPath(this.plugin.options, key) : synthetic;
  }

  /**
   * Persist one control's value.
   *
   * Each case owns whatever has to happen beyond the write itself — resizing
   * an open floating panel, showing or hiding it, re-evaluating the `visible`
   * predicate of a row further down the page.
   */
  setControlValue(key: string, value: unknown): void {
    // The synthetic keys persist through their own path, so they return before
    // the saveOptions at the bottom rather than falling through to it
    if (this.writeSynthetic(key, value)) return;
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
      case "appearance.dotSize":
        this.plugin.writeOptions(() => ({
          appearance: { dotSize: value as DotSize },
        }));
        break;
      case "appearance.hoverPreview":
        this.plugin.writeOptions(() => ({
          appearance: { hoverPreview: value as boolean },
        }));
        break;
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
        // Everything whose dotted path is exactly "<section>.<field>": the
        // per-granularity QuickAdd keys, and the event / reminder / daily-block
        // sections, which need no side effect beyond the write itself
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
          name: t("settings.dotSizeName"),
          desc: t("settings.dotSizeDesc"),
          control: {
            type: "dropdown",
            key: "appearance.dotSize",
            options: {
              [DotSize.Small]: t("settings.dotSizeSmall"),
              [DotSize.Medium]: t("settings.dotSizeMedium"),
              [DotSize.Large]: t("settings.dotSizeLarge"),
            },
          },
        },
        {
          name: t("settings.pastTransparentName"),
          desc: t("settings.pastTransparentDesc"),
          control: { type: "toggle", key: "appearance.pastTimeTransparent" },
        },
        {
          name: t("settings.hoverPreviewName"),
          desc: t("settings.hoverPreviewDesc"),
          control: { type: "toggle", key: "appearance.hoverPreview" },
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

  private eventsGroup(): SettingDefinitionItem {
    return {
      type: "group",
      cls: "otc-card",
      items: [
        this.cardHead(
          "calendar-plus",
          t("settings.eventsCardTitle"),
          t("settings.eventsCardSubtitle")
        ),
        {
          name: t("settings.reminderColorName"),
          desc: t("settings.reminderColorDesc"),
          control: { type: "color", key: "eventDefaults.reminderColor" },
        },
        {
          name: t("settings.eventColorName"),
          desc: t("settings.eventColorDesc"),
          control: { type: "color", key: "eventDefaults.eventColor" },
        },
        {
          name: t("settings.reminderEnabledName"),
          desc: t("settings.reminderEnabledDesc"),
          control: { type: "toggle", key: "reminder.enabled" },
        },
        {
          name: t("settings.reminderTimeName"),
          desc: t("settings.reminderTimeDesc"),
          control: {
            type: "text",
            key: "reminder.defaultTime",
            validate: (raw) =>
              TIME_PATTERN.test(String(raw).trim())
                ? undefined
                : t("quickAdd.errorBadTime"),
          },
        },
        {
          name: t("settings.reminderOffsetsName"),
          desc: t("settings.reminderOffsetsDesc"),
          control: {
            type: "text",
            key: "reminder.offsetsText",
            validate: (raw) =>
              parseOffsets(String(raw)) ? undefined : t("quickAdd.errorNoOffset"),
          },
        },
        ...REMINDER_CHANNELS.map((channel) => ({
          name: t(CHANNEL_LABELS[channel].name),
          desc: t(CHANNEL_LABELS[channel].desc),
          control: {
            type: "toggle" as const,
            key: `reminder.channel.${channel}`,
          },
        })),
        {
          name: t("settings.snoozeName"),
          desc: t("settings.snoozeDesc"),
          control: { type: "number", key: "reminder.snoozeMinutes", min: 1 },
        },
      ],
    };
  }

  /**
   * The events themselves.
   *
   * A plain group whose rows are drawn by hand, not Obsidian 1.13's `type:
   * "list"`. The list looked like the right tool — it brings add, delete and
   * drag-to-reorder for free — but its renderer draws nothing for rows that
   * carry an `action` instead of a `control`: the definitions came back with
   * every entry present and the page still showed the empty state. Rendering
   * the rows here costs two buttons and removes the guesswork.
   */
  private eventListGroup(): SettingDefinitionItem {
    const events = readEvents();
    return {
      type: "group",
      cls: "otc-card",
      items: [
        {
          name: t("settings.eventListTitle"),
          searchable: false,
          render: (setting: Setting) => {
            setting.setName(t("settings.eventListTitle")).setHeading();
            setting.addButton((button) =>
              button
                .setButtonText(t("settings.eventListAdd"))
                .setCta()
                .onClick(() => openQuickAddEvent(this.app))
            );
          },
        },
        ...(events.length === 0
          ? [
              {
                name: t("settings.eventListEmpty"),
                searchable: false,
                render: (setting: Setting) => {
                  const el = setting.settingEl;
                  el.empty();
                  el.addClass("otc-card-note");
                  el.createEl("p", {
                    cls: "setting-item-description",
                    text: t("settings.eventListEmpty"),
                  });
                },
              },
            ]
          : events.map((event) => this.eventRow(event))),
      ],
    };
  }

  /**
   * One event: its title and a summary, with edit and delete beside them.
   *
   * Clicking edit opens the dialog that created the entry rather than a second
   * one built out of settings rows — every field is the same, and the
   * natural-language box is as useful for changing a date as for setting one.
   */
  private eventRow(event: CalendarEvent): SettingGroupItem {
    const range =
      event.start === event.end
        ? event.start
        : t("event.dateRange", { start: event.start, end: event.end });
    return {
      name: event.title,
      desc: `${range} · ${formatReminderSummary(event.reminder)}`,
      render: (setting: Setting) => {
        setting
          .setName(event.title)
          .setDesc(`${range} · ${formatReminderSummary(event.reminder)}`)
          .addExtraButton((button) =>
            button
              .setIcon("pencil")
              .setTooltip(t("settings.eventEditAction"))
              .onClick(() => openEditEvent(this.app, event))
          )
          .addExtraButton((button) =>
            button
              .setIcon("trash-2")
              .setTooltip(t("settings.eventDeleteAction"))
              .onClick(() => {
                void removeEvent(this.app, event.id).then(() => this.update());
              })
          );
        // The colour is the one thing a row cannot say in words, and it is what
        // the user is looking for when matching a row to a bar on the calendar
        setting.nameEl.prepend(
          createSpan({ cls: "otc-event-swatch", attr: { style: "" } })
        );
        (setting.nameEl.firstElementChild as HTMLElement).style.setProperty(
          "--otc-event-color",
          event.color
        );
      },
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
