import type { ResolvedLanguage } from "./detect";

/**
 * Default folder, template path and template body that "Set up daily notes"
 * proposes, per interface language.
 *
 * These are locale content rather than UI labels: they end up as folder names
 * and as the body of a file inside the user's vault, so they belong next to the
 * translation tables rather than in the setup logic.
 *
 * Note that this keys on all three resolved languages, not on the two the UI
 * has tables for: a Simplified Chinese user reads an English interface (there
 * is no zh-Hans UI table) but should still get Simplified folder names and a
 * Simplified template, because those are what they will be typing into.
 */
export interface DailyNotePreset {
  folder: string;
  templatePath: string;
  templateBody: string;
}

/**
 * The template deliberately uses all four of this plugin's lunar variables, so
 * that pressing the button once shows their real values in today's note without
 * the user having to read the documentation first.
 * `{{date:...}}` belongs to obsidian-daily-notes-interface, not to this plugin.
 */
const ZH_HANT_TEMPLATE = `---
date: {{date:YYYY-MM-DD dddd}}
tags: [diary]
---

# {{date:YYYY-MM-DD dddd}}

> 農曆 {{lunar}}\u3000{{ganzhi}}年
> 節氣：{{solarTerm}}
> 節慶／假日：{{festivals}}

## 今日重點

## 隨手記
`;

const ZH_HANS_TEMPLATE = `---
date: {{date:YYYY-MM-DD dddd}}
tags: [diary]
---

# {{date:YYYY-MM-DD dddd}}

> 农历 {{lunar}}\u3000{{ganzhi}}年
> 节气：{{solarTerm}}
> 节庆／假日：{{festivals}}

## 今日重点

## 随手记
`;

const EN_TEMPLATE = `---
date: {{date:YYYY-MM-DD dddd}}
tags: [diary]
---

# {{date:YYYY-MM-DD dddd}}

> Lunar: {{lunar}} ({{ganzhi}})
> Solar term: {{solarTerm}}
> Festivals / holidays: {{festivals}}

## Highlights

## Notes
`;

export const DAILY_NOTE_PRESETS: Record<ResolvedLanguage, DailyNotePreset> = {
  "zh-Hant": {
    folder: "日誌/日記",
    templatePath: "日誌/範本/每日.md",
    templateBody: ZH_HANT_TEMPLATE,
  },
  "zh-Hans": {
    folder: "日志/日记",
    templatePath: "日志/模板/每日.md",
    templateBody: ZH_HANS_TEMPLATE,
  },
  en: {
    folder: "Journal/Daily",
    templatePath: "Journal/Templates/Daily.md",
    templateBody: EN_TEMPLATE,
  },
};
