import { getLanguage, moment } from "obsidian";

/**
 * Which language the plugin should speak.
 *
 * Deliberately not derived from the browser or from the vault: Obsidian has its
 * own interface-language setting and the plugin must follow that one, otherwise
 * a user who runs Obsidian in English on a Chinese OS gets a Chinese plugin.
 */
export type ResolvedLanguage = "zh-Hant" | "zh-Hans" | "en";

/**
 * Obsidian's interface language.
 *
 * getLanguage() is the official source, which is why manifest.json requires
 * 1.8.7 — the version that introduced it. It returns the ISO code of the
 * configured interface language and falls back to "en" on its own.
 *
 * moment's locale is kept as a second source anyway: Obsidian keeps it in step
 * with the interface language, and it covers the case of getLanguage()
 * returning an empty string. The browser language is the last resort.
 */
export const detectObsidianLanguage = (): string =>
  getLanguage() || moment.locale() || navigator.language || "en";

/**
 * In Obsidian's own language codes, Simplified Chinese is `zh` and Traditional
 * Chinese is `zh-TW`. A bare `zh` therefore has to resolve to Simplified —
 * `startsWith("zh")` would wrongly hand every Simplified user Traditional text.
 *
 * Everything else falls back to English, which is also Obsidian's own fallback.
 */
export const resolveLanguage = (language: string): ResolvedLanguage => {
  const lang = language.toLowerCase();
  if (lang === "zh" || lang.startsWith("zh-cn") || lang.startsWith("zh-hans")) {
    return "zh-Hans";
  }
  if (lang.startsWith("zh")) return "zh-Hant";
  return "en";
};
