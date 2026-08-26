import type { Moment } from "src/util/moment";
import { App, Notice, TFile } from "obsidian";
import type { PaneType } from "obsidian";
import * as dni from "obsidian-daily-notes-interface";
import { NoteType } from "../enum";
import { noteTypeLabel } from "../enum/noteConfig";
import { t } from "../i18n";
import type { Notes } from "../state/notes";
import { settingsStore } from "../state/settings";
import { createConfirmationDialog } from "../view/ConfirmModal";
import { getRocFestivalLabel } from "../holiday/rocHoliday";
import { buildLunarFields } from "./format";
import { granularityDisabledHint, granularityEnabled } from "./periodicNotes";
import { stripTemplateSyntax } from "../util/templateSafe";

/**
 * Everything obsidian-daily-notes-interface offers, gathered per granularity.
 *
 * The interface exposes fifteen separate free functions named after the five
 * granularities; this table is the one place that spells them out, so no caller
 * has to carry its own five-way switch around.
 */
const NOTE_API: Record<
  NoteType,
  {
    find: typeof dni.getDailyNote;
    create: typeof dni.createDailyNote;
    settings: typeof dni.getDailyNoteSettings;
  }
> = {
  [NoteType.DAILY]: {
    find: dni.getDailyNote,
    create: dni.createDailyNote,
    settings: dni.getDailyNoteSettings,
  },
  [NoteType.WEEKLY]: {
    find: dni.getWeeklyNote,
    create: dni.createWeeklyNote,
    settings: dni.getWeeklyNoteSettings,
  },
  [NoteType.MONTHLY]: {
    find: dni.getMonthlyNote,
    create: dni.createMonthlyNote,
    settings: dni.getMonthlyNoteSettings,
  },
  [NoteType.QUARTERLY]: {
    find: dni.getQuarterlyNote,
    create: dni.createQuarterlyNote,
    settings: dni.getQuarterlyNoteSettings,
  },
  [NoteType.YEARLY]: {
    find: dni.getYearlyNote,
    create: dni.createYearlyNote,
    settings: dni.getYearlyNoteSettings,
  },
};

export const noteExists = (
  date: Moment,
  type: NoteType,
  notes: Notes[NoteType]
) => (notes ? NOTE_API[type].find(date, notes) : null);

/**
 * The span a granularity covers, and the granularity nested inside it.
 *
 * Daily notes are absent on purpose: a day is not a range, and its extra
 * fields are the lunar ones instead.
 */
const PERIOD_RANGE: Partial<
  Record<
    NoteType,
    {
      unit: "week" | "month" | "quarter" | "year";
      inner: typeof dni.getDailyNoteSettings;
    }
  >
> = {
  [NoteType.WEEKLY]: { unit: "week", inner: dni.getDailyNoteSettings },
  [NoteType.MONTHLY]: { unit: "month", inner: dni.getWeeklyNoteSettings },
  [NoteType.QUARTERLY]: { unit: "quarter", inner: dni.getMonthlyNoteSettings },
  [NoteType.YEARLY]: { unit: "year", inner: dni.getQuarterlyNoteSettings },
};

/**
 * The parameters handed to QuickAdd.
 * Written as a typed interface rather than `any` on purpose: adding a field
 * forces the question "who controls this value?". festivals and dateStr carry
 * festival names the user can override, and are therefore untrusted input.
 */
export interface QuickAddParams {
  filename: string;
  year: number;
  month: number;
  label: string;
  /** Daily-note-only fields follow */
  chineseYear?: string;
  chineseMonth?: string;
  chineseDay?: string;
  /** Sexagenary year: the two-character cyclic year label */
  ganzhi?: string;
  solarTerm?: string;
  /** Untrusted: comes from the user-editable holiday override JSON */
  festivals?: string;
  lunar?: string;
  /** Untrusted: contains festivals */
  dateStr?: string;
  /** Weekly / monthly / quarterly / yearly-only fields follow */
  start?: string;
  end?: string;
  prevStart?: string;
  prevEnd?: string;
}

interface QuickAddApi {
  executeChoice: (
    choice: string,
    params: Record<string, string | number>
  ) => Promise<void> | void;
}

/**
 * QuickAdd is optional, and when it is not installed the whole
 * `app.plugins.plugins.quickadd` path is absent. Collapsing that into one named
 * adapter means "the plugin may not be there" is handled in exactly one place.
 */
export const getQuickAddApi = (app: App): QuickAddApi | null => {
  const api = (
    app as unknown as {
      plugins?: { plugins?: Record<string, { api?: QuickAddApi } | undefined> };
    }
  ).plugins?.plugins?.quickadd?.api;
  return api ?? null;
};

/** Escaping at the exit: every string value going to QuickAdd has its template delimiters stripped first */
const escapeParams = (
  params: QuickAddParams
): Record<string, string | number> => {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      out[key] = stripTemplateSyntax(value);
    } else if (typeof value === "number") {
      out[key] = value;
    }
  }
  return out;
};

/**
 * Build the parameter set available to a periodic note.
 *
 * This definition is the **single** source for both the QuickAdd path and the
 * template-token substitution path. The logic used to live inside
 * createNoteQuickAdd, which meant the lunar date, solar term and festival the
 * plugin had already computed only reached users who had QuickAdd installed —
 * anyone going through createDailyNote received not one word of it.
 */
export const buildNoteParams = (
  sourceDate: Moment,
  type: NoteType,
  filename: string
): QuickAddParams => {
  const date = sourceDate.clone();
  const holidayOverrides = settingsStore.read().holidayOverrides;
  const params: QuickAddParams = {
    filename,
    year: date.year(),
    month: date.month(),
    label: noteTypeLabel(type),
  };

  if (type === NoteType.DAILY) {
    const { chineseYear, chineseMonth, chineseDay, ganzhi, solarTerm, lunar } =
      buildLunarFields(date.toDate());
    params.chineseYear = chineseYear;
    params.chineseMonth = chineseMonth;
    params.chineseDay = chineseDay;
    params.ganzhi = ganzhi;
    params.solarTerm = solarTerm;
    const festivals =
      getRocFestivalLabel(date.toDate(), holidayOverrides) || "";
    params.festivals = festivals;
    params.lunar = lunar;
    params.dateStr = festivals ? `${filename} ${festivals}` : filename;
  }
  const range = PERIOD_RANGE[type];
  if (range) {
    // start/end are written in the daily format, and prevStart/prevEnd in the
    // format of the granularity one step down — that pair is what a template
    // links to when it wants "the notes this period is made of"
    const { format } = dni.getDailyNoteSettings();
    const { format: innerFormat } = range.inner();
    const from = date.clone().startOf(range.unit);
    const to = date.clone().endOf(range.unit);
    params.start = from.format(format);
    params.end = to.format(format);
    params.prevStart = from.format(innerFormat);
    params.prevEnd = to.format(innerFormat);
  }

  return params;
};

export const createNoteQuickAdd = async (
  date: Moment,
  type: NoteType,
  filename: string,
  quickAddChoice: string,
  ctx: App
) => {
  const api = getQuickAddApi(ctx);
  if (!api) {
    new Notice(t("notice.quickAddMissing"));
    return;
  }
  await api.executeChoice(
    quickAddChoice,
    escapeParams(buildNoteParams(date, type, filename))
  );
};

/**
 * The template tokens this plugin itself supports.
 * Deliberately **excluding** {{date}} / {{time}} / {{title}} / {{yesterday}} /
 * {{tomorrow}}: those five are handled by obsidian-daily-notes-interface at
 * creation time, and touching them here would only break existing behaviour.
 */
const LUNAR_TOKEN_KEYS = [
  "lunar",
  "solarTerm",
  "festivals",
  "ganzhi",
  "chineseYear",
  "chineseMonth",
  "chineseDay",
  "dateStr",
] as const;

/** Lookup for case-insensitive matching: lower-cased token -> the real params field name */
const LUNAR_TOKEN_LOOKUP = new Map<string, (typeof LUNAR_TOKEN_KEYS)[number]>(
  LUNAR_TOKEN_KEYS.map((k) => [k.toLowerCase(), k])
);

const LUNAR_TOKEN_PATTERN = new RegExp(
  `\\{\\{\\s*(${LUNAR_TOKEN_KEYS.join("|")})\\s*\\}\\}`,
  "gi"
);

/**
 * Write the lunar / solar-term / festival values into a note that was just
 * created.
 *
 * This has to run after createNote and before leaf.openFile. The other way
 * round, the user first sees the un-substituted template and it only flips to
 * the real content a beat later — a visible flash.
 *
 * Security: every value goes through stripTemplateSyntax first. festivals and
 * dateStr carry festival names the user can override, and not escaping them
 * would open a second path around the escaping done at the QuickAdd exit.
 */
export const applyLunarTokens = async (
  app: App,
  file: TFile,
  params: QuickAddParams
): Promise<void> => {
  // process rather than read-then-modify: it reads and writes as one atomic
  // step, so a template plugin touching the same file cannot land in between
  await app.vault.process(file, (content) =>
    content.replace(LUNAR_TOKEN_PATTERN, (_match, rawKey) => {
      const key = LUNAR_TOKEN_LOOKUP.get(String(rawKey).toLowerCase());
      const value = key ? params[key] : undefined;
      // No value (e.g. {{solarTerm}} on a day that is not a solar term) is
      // replaced with an empty string rather than left as literal text
      return typeof value === "string" ? stripTemplateSyntax(value) : "";
    })
  );
};

export const createNote = async (date: Moment, type: NoteType) =>
  NOTE_API[type].create(date);

export const openOrCreateNote = async (
  date: Moment,
  type: NoteType,
  notes: Notes[NoteType],
  ctx: App,
  newLeaf: PaneType | false = false,
  /**
   * Whether to ask once more before creating the file.
   * A click on a calendar cell should ask (it is quite likely a misclick).
   * "Set up daily notes" already listed "today's note will be created" item by
   * item in its preview modal and had it confirmed, so a second prompt is a
   * duplicate gate — and because that second dialog is not awaited, the caller
   * would lose the answer of whether the file was created at all.
   */
  confirmBeforeCreate = true
) => {
  const { workspace } = ctx;
  const existingFile = noteExists(date, type, notes);
  if (!existingFile) {
    /**
     * A granularity that is not enabled must not create a file.
     * The UI layer already renders those cells unclickable; this is the second
     * gate. Whichever entry point you arrive through, a disabled granularity
     * resolves to dni's default settings (empty folder + default format), and
     * letting that through conjures a file in the vault root out of nowhere.
     */
    if (!granularityEnabled(ctx, type)) {
      new Notice(granularityDisabledHint(type));
      return;
    }
    const { format } = NOTE_API[type].settings();
    const { useQuickAdd, quickAddChoice } = settingsStore.read()[type];
    const filename = date.format(format);

    const createFile = async () => {
      // Decide whether to go through QuickAdd
      if (useQuickAdd && quickAddChoice) {
        await createNoteQuickAdd(date, type, filename, quickAddChoice, ctx);
        return;
      }
      const note = await createNote(date, type);
      // Substitute the tokens before opening the file: the other way round the
      // user sees the raw template first and it then flashes to real content
      await applyLunarTokens(ctx, note, buildNoteParams(date, type, filename));
      const leaf = workspace.getLeaf(newLeaf);

      await leaf.openFile(note, { active: true });
    };

    if (!confirmBeforeCreate) {
      await createFile();
      return;
    }

    createConfirmationDialog({
      cta: t("common.create"),
      onAccept: createFile,
      text: t("confirm.createNoteText", { filename }),
      title: t("confirm.createNoteTitle", { noteType: noteTypeLabel(type) }),
      ctx,
    });
    return;
  }

  const leaf = workspace.getLeaf(newLeaf);
  await leaf.openFile(existingFile, { active: true });
};
