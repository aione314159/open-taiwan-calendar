import { NOTE_TYPES, NoteType } from "../enum";
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

export interface AppearanceSetting {
  layout: LayoutMode;
  pastTimeTransparent: boolean;
}

export interface FloatingWindowSetting {
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type PluginSetting = Record<NoteType, NoteConfig> & {
  appearance: AppearanceSetting;
  floatingWindow: FloatingWindowSetting;
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
    pastTimeTransparent: false,
  },
  floatingWindow: {
    visible: false,
    x: 80,
    y: 80,
    width: 400,
    height: 450,
  },
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

export function useSetting<S>(select: (setting: PluginSetting) => S): S {
  return useStoreValue(settingsStore, select);
}
