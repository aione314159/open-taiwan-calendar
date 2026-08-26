import type { App } from "obsidian";
import { NoteType } from "../enum";
import { noteTypeLabel } from "../enum/noteConfig";
import { t } from "../i18n";

/**
 * Enablement queries for Periodic Notes / the core Daily Notes plugin, plus the
 * access points for their settings.
 *
 * The enablement logic is copied from obsidian-daily-notes-interface's
 * `shouldUsePeriodicNotesSettings` and `appHas*PluginLoaded` (see
 * node_modules/obsidian-daily-notes-interface/dist/main.js).
 *
 * Why not copy `shouldUsePeriodicNotesSettings` alone: that function only looks
 * at periodic-notes, so a user running only the core Daily Notes plugin is
 * judged "not enabled" and daily notes become entirely unclickable — a
 * regression. What is used here is the semantics of `appHas*PluginLoaded`:
 * "can this granularity create a note right now?"
 *
 * WARNING: everything this module touches is Obsidian's **undocumented internal
 * API** (`app.plugins` and `app.internalPlugins` are both absent from the `App`
 * class in obsidian.d.ts, but were verified to exist on 1.13.7). The types are
 * hand-written from runtime observation, which is why every access stays
 * optional: if an upgrade removes any part of the chain, the worst case
 * degrades to "not found -> treat as not enabled" rather than throwing.
 */

/** Periodic Notes' settings for a single granularity; field shape copied from its data.json */
export interface PeriodicNoteGranularitySetting {
  format?: string;
  folder?: string;
  template?: string;
  enabled?: boolean;
}

export interface PeriodicNotesPlugin {
  /**
   * Describes only the "granularity key -> granularity settings" part. The
   * data.json also holds flags such as showGettingStartedBanner and
   * hasMigrated*, which this plugin neither reads nor writes; they are carried
   * through unchanged by spreading on write-back.
   */
  settings?: Record<string, PeriodicNoteGranularitySetting | undefined>;
  /**
   * Replaces the settings wholesale, writes the file, then triggers
   * `periodic-notes:settings-updated`. It is periodic-notes 0.0.17's own single
   * write entry point (see updateSettings in its main.js); mutating the
   * `settings` object directly never saves, so the change is gone on restart.
   */
  updateSettings?: (value: Record<string, unknown>) => Promise<void>;
}

/** The core Daily Notes internal plugin. `instance.options` is literally the content of .obsidian/daily-notes.json */
export interface CoreDailyNotesPlugin {
  enabled?: boolean;
  /** Passing true means "the user turned this on"; internally it calls requestSaveConfig() to write core-plugins.json */
  enable?: (fromUser: boolean) => unknown;
  instance?: {
    options?: { folder?: string; format?: string; template?: string };
  };
  /** Write options back to .obsidian/daily-notes.json */
  saveData?: (data: unknown) => Promise<void>;
}

interface PluginHost {
  plugins?: {
    getPlugin?: (id: string) => PeriodicNotesPlugin | null;
    /** Installed (not necessarily enabled) plugins, keyed by plugin id */
    manifests?: Record<string, unknown>;
  };
  internalPlugins?: {
    getPluginById?: (id: string) => CoreDailyNotesPlugin | null;
  };
}

const asHost = (app: App): PluginHost => app as unknown as PluginHost;

export const getPeriodicNotesPlugin = (app: App): PeriodicNotesPlugin | null =>
  asHost(app).plugins?.getPlugin?.("periodic-notes") ?? null;

export const getCoreDailyNotesPlugin = (
  app: App
): CoreDailyNotesPlugin | null =>
  asHost(app).internalPlugins?.getPluginById?.("daily-notes") ?? null;

/**
 * Whether a community plugin is **installed** (having a manifest counts,
 * enabled or not).
 * Different from `getPlugin(id)`, which only returns an instance for an enabled
 * plugin and therefore misreads "installed but turned off" as "not installed".
 */
export const communityPluginInstalled = (app: App, id: string): boolean =>
  !!asHost(app).plugins?.manifests?.[id];

/** Can this granularity actually create a note right now? Without this check, clicking just conjures a file in the vault root */
export const granularityEnabled = (app: App, type: NoteType): boolean => {
  if (getPeriodicNotesPlugin(app)?.settings?.[type]?.enabled) {
    return true;
  }
  if (type === NoteType.DAILY) {
    // The core Daily Notes internal plugin can supply daily note settings too
    return !!getCoreDailyNotesPlugin(app)?.enabled;
  }
  if (type === NoteType.WEEKLY) {
    // The Calendar plugin still holds weekly note settings, and dni's
    // appHasWeeklyNotesPluginLoaded recognises it as a provider too
    return !!asHost(app).plugins?.getPlugin?.("calendar");
  }
  return false;
};

/** The reason and the way out shown to the user when a granularity is off (shared by the tooltip and the aria-label) */
export const granularityDisabledHint = (type: NoteType): string =>
  t("hint.granularityDisabled", { noteType: noteTypeLabel(type) });
