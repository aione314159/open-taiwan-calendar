import { t } from "../i18n";
import type { TranslationKey } from "../i18n";
import { NoteType } from "./index";

export interface NoteConfigItem {
  /**
   * Translation key rather than the label itself: this map is built at module
   * load, long before Obsidian's interface language can be read, so storing the
   * resolved string here would freeze whichever locale happened to win the race.
   */
  titleKey: TranslationKey;
  key: NoteType;
}

/**
 * Display-name lookup for the periodic-note granularities.
 * Pure data with no dependency beyond i18n. Both the view layer (settings page)
 * and the note-operation layer read it, and keeping it here is what stops the
 * note logic from having to import the view in the other direction.
 */
export const noteConfigMap: Record<NoteType, NoteConfigItem> = {
  [NoteType.DAILY]: {
    titleKey: "noteType.daily",
    key: NoteType.DAILY,
  },
  [NoteType.WEEKLY]: {
    titleKey: "noteType.weekly",
    key: NoteType.WEEKLY,
  },
  [NoteType.MONTHLY]: {
    titleKey: "noteType.monthly",
    key: NoteType.MONTHLY,
  },
  [NoteType.QUARTERLY]: {
    titleKey: "noteType.quarterly",
    key: NoteType.QUARTERLY,
  },
  [NoteType.YEARLY]: {
    titleKey: "noteType.yearly",
    key: NoteType.YEARLY,
  },
};

/** The granularity's name in the user's language, resolved at call time. */
export const noteTypeLabel = (type: NoteType): string =>
  t(noteConfigMap[type].titleKey);
