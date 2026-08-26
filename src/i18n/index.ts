import { detectObsidianLanguage, resolveLanguage } from "./detect";
import { en } from "./en";
import type { TranslationKey } from "./en";
import { zhTW } from "./zh-TW";

/**
 * The plugin's whole i18n layer: two typed lookup tables and one function.
 *
 * No runtime dependency is added for this. The plugin ships a CI gate that
 * forbids any outbound request (cli/check_network_gate.sh) and the bundle is
 * already ~1.19 MB, so an i18n framework would cost more than it is worth for
 * roughly two hundred strings that are known at compile time.
 *
 * This module imports nothing from the rest of the project, so it can be used
 * from any layer without ever forming a cycle (.eslintrc.json enforces
 * import/no-cycle and the build runs it).
 */

/** Locales that ship a translation table. Everything else resolves to English. */
export type PluginLocale = "en" | "zh-TW";

const TABLES: Record<PluginLocale, Partial<Record<TranslationKey, string>>> = {
  en,
  "zh-TW": zhTW,
};

/**
 * Obsidian only applies a language change after a restart, so resolving once
 * and caching matches what the user actually sees. Resolution is lazy rather
 * than done at module load: `t()` must never run before Obsidian has a window,
 * and a module-level read would make that ordering an accident waiting to break.
 */
let cachedLocale: PluginLocale | null = null;

export const getLocale = (): PluginLocale => {
  if (cachedLocale === null) {
    cachedLocale =
      resolveLanguage(detectObsidianLanguage()) === "zh-Hant" ? "zh-TW" : "en";
  }
  return cachedLocale;
};

export type TranslationVars = Record<string, string | number>;

/**
 * Substitute `{name}` tokens.
 *
 * Only names actually present in `vars` are replaced. That is what keeps the
 * literal braces in sample JSON (`{"2027": [...]}`) and in Periodic Notes' own
 * `{{date}}` tokens intact — a blanket replace would eat the inner `{date}` of
 * `{{date}}` and print the token as `{}` in the settings page.
 */
const interpolate = (template: string, vars?: TranslationVars): string => {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match
  );
};

/**
 * Look up a user-visible string.
 *
 * Falls back to English whenever the active locale has no entry for the key,
 * and to an empty string in the impossible case that English has none either.
 * It never returns the key itself: a raw `settings.layoutName` rendered into a
 * settings page looks like a broken build to the user and hides the real fault,
 * whereas a blank label is at least obviously blank.
 */
export const t = (key: TranslationKey, vars?: TranslationVars): string =>
  interpolate(TABLES[getLocale()][key] ?? en[key] ?? "", vars);

export type { TranslationKey } from "./en";
export { detectObsidianLanguage, resolveLanguage } from "./detect";
export type { ResolvedLanguage } from "./detect";
export { DAILY_NOTE_PRESETS } from "./dailyNotePresets";
export type { DailyNotePreset } from "./dailyNotePresets";
