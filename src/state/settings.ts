import { NOTE_TYPES, NoteType } from "../enum";
import { ReminderChannel } from "../event/types";
import type { RocHolidayEntry } from "../holiday/types";
import { deepMerge } from "../util/object";
import { Store, useStoreValue } from "./store";

/**
 * Every field optional, all the way down.
 *
 * Settings arrive one fragment at a time — a single toggle, one edge of the
 * floating window — so the write path takes a patch rather than a whole object.
 */
export type DeepPartial<T> = T extends object
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T;

/** How one granularity creates its note. */
export interface NoteConfig {
  useQuickAdd?: boolean;
  quickAddChoice?: string;
}

export enum LayoutMode {
  Normal = "Normal",
  Small = "Small",
}

/**
 * How big the status dots along a date cell's bottom edge are drawn.
 *
 * The string values double as the keys of data.json, so renaming one would
 * silently orphan a user's saved choice — the same reason NoteType's values are
 * fixed.
 */
export enum DotSize {
  Small = "Small",
  Medium = "Medium",
  Large = "Large",
}

export interface AppearanceSetting {
  layout: LayoutMode;
  /**
   * The size of the "has a note" dot and the event dots.
   *
   * 4px reads as a hint at a glance and disappears at arm's length or on a
   * high-density display, which is why this is a setting rather than a constant.
   */
  dotSize: DotSize;
  pastTimeTransparent: boolean;
  /**
   * Whether resting the pointer on a date pops up the note preview.
   *
   * Separate from the core Page Preview plugin's own switch on purpose: that
   * one is shared with every plugin that registers a hover source, so turning
   * this calendar's preview off there would cost the user previews everywhere
   * else too.
   */
  hoverPreview: boolean;
}

export interface FloatingWindowSetting {
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** What a newly created entry starts out as. */
export interface EventDefaultsSetting {
  /** `#rrggbb` for an entry that carries a reminder. */
  reminderColor: string;
  /** `#rrggbb` for an entry that is only marked on the calendar. */
  eventColor: string;
}

export interface ReminderSetting {
  /** The master switch. Off means nothing fires, events still show on the calendar. */
  enabled: boolean;
  /**
   * Days before the event a new reminder fires on.
   * The default `[1, 0]` is the rule the feature was asked for: once the day
   * before, once on the day itself.
   */
  defaultOffsets: number[];
  /** `HH:mm` local time a new reminder fires at. */
  defaultTime: string;
  /** Which channels a new reminder announces itself through. */
  /**
   * How every reminder announces itself.
   *
   * One global setting rather than a field on each entry: the channels are a
   * preference about how this vault interrupts its owner, not a property of any
   * particular reminder, and repeating them on every entry would put three
   * strings into the frontmatter of every note for nothing.
   */
  channels: ReminderChannel[];
  /** How long "remind me later" pushes a modal reminder back. */
  snoozeMinutes: number;
}

export type PluginSetting = Record<NoteType, NoteConfig> & {
  appearance: AppearanceSetting;
  floatingWindow: FloatingWindowSetting;
  eventDefaults: EventDefaultsSetting;
  reminder: ReminderSetting;
  /**
   * Which reminders have already fired, keyed by `<event id>#<offset>` and
   * holding the `YYYY-MM-DD` they fired on.
   *
   * This lives in data.json rather than in events.json on purpose: it is a
   * per-machine playback record, not shared data. Syncing it would mean a
   * reminder dismissed on the desktop never appears on the laptop at all.
   */
  reminderState: Record<string, string>;
  /**
   * Calendars the Directorate-General of Personnel Administration has announced
   * but this plugin does not bundle yet, keyed by year. They take precedence
   * over the built-in table.
   */
  holidayOverrides: Record<number, RocHolidayEntry[]>;
};

const blankNoteConfig = (): NoteConfig => ({
  useQuickAdd: false,
  quickAddChoice: "",
});

const blankNoteConfigs = (): Record<NoteType, NoteConfig> => {
  const configs = {} as Record<NoteType, NoteConfig>;
  NOTE_TYPES.forEach((type) => {
    configs[type] = blankNoteConfig();
  });
  return configs;
};

export const defaultSetting: PluginSetting = {
  ...blankNoteConfigs(),
  appearance: {
    layout: LayoutMode.Normal,
    dotSize: DotSize.Small,
    pastTimeTransparent: false,
    hoverPreview: true,
  },
  floatingWindow: {
    visible: false,
    x: 80,
    y: 80,
    width: 400,
    height: 450,
  },
  eventDefaults: {
    // Two colours rather than one: a reminder and a plain marker are different
    // kinds of thing, and telling them apart at a glance on the grid is the
    // whole job of a coloured dot.
    reminderColor: "#e07a5f",
    eventColor: "#3d5a80",
  },
  reminder: {
    enabled: true,
    defaultOffsets: [1, 0],
    defaultTime: "09:00",
    channels: [ReminderChannel.MODAL, ReminderChannel.NOTICE],
    snoozeMinutes: 10,
  },
  reminderState: {},
  holidayOverrides: {},
};

export const settingsStore = new Store<PluginSetting>(defaultSetting);

/** Fold a fragment into the current settings. */
export const patchSettings = (patch: DeepPartial<PluginSetting>): void => {
  settingsStore.write(deepMerge(settingsStore.read(), patch));
};

/**
 * Swap the override table out wholesale.
 *
 * Kept separate from `patchSettings` because the two have different meanings:
 * this one is "forget what was there and use exactly this", which is what the
 * settings page needs so that handing it an empty object clears a bad paste.
 */
export const replaceHolidayOverrides = (
  value: Record<number, RocHolidayEntry[]>
): void => {
  settingsStore.write({ ...settingsStore.read(), holidayOverrides: value });
};

/**
 * Swap the fired-reminder record out wholesale.
 *
 * Same reason `replaceHolidayOverrides` exists: `patchSettings` merges, and the
 * scheduler's prune pass has to be able to *remove* the entries of events that
 * no longer exist. A merge would keep every key it was ever given, and the
 * record would grow for the life of the vault.
 */
export const replaceReminderState = (value: Record<string, string>): void => {
  settingsStore.write({ ...settingsStore.read(), reminderState: value });
};

export function useSetting<S>(select: (setting: PluginSetting) => S): S {
  return useStoreValue(settingsStore, select);
}
