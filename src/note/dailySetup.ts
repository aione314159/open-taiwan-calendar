import { App, TFolder, moment, normalizePath } from "obsidian";
import { NoteType } from "../enum";
import {
  DAILY_NOTE_PRESETS,
  detectObsidianLanguage,
  resolveLanguage,
  t,
} from "../i18n";
import type { ResolvedLanguage } from "../i18n";
import { readNotes, refreshNotes } from "../state/notes";
import { settingsStore } from "../state/settings";
import {
  communityPluginInstalled,
  getCoreDailyNotesPlugin,
  getPeriodicNotesPlugin,
} from "./periodicNotes";
import type { PeriodicNoteGranularitySetting } from "./periodicNotes";
import { openOrCreateNote } from "./noteOps";

/**
 * The difference calculation and the execution behind "Set up daily notes".
 *
 * This module is split deliberately into build (pure calculation, writes
 * nothing) and run (writes exactly what was calculated). What the preview modal
 * shows *is* build's output, not a separately written blurb — two copies would
 * drift, and they always drift in the direction of the preview promising
 * something the run cannot deliver.
 *
 * Safety premises shared by the whole module:
 * - Only create, never overwrite. If the folder, the template or today's note
 *   already exists, that step is skipped.
 * - Before touching the Periodic Notes settings, deep-copy them in memory; if
 *   any step throws, restore the whole copy.
 */

// ---------------------------------------------------------------- language

/** Language of the default folder and template names this setup proposes. */
export type SetupLocale = ResolvedLanguage;

/** Filename format is language-independent: `dddd` itself renders the weekday name in the moment locale */
const DEFAULT_DAILY_FORMAT = "YYYY-MM-DD dddd";

// ---------------------------------------------------------------- the plan

export type SetupStepId =
  | "folder"
  | "enable"
  | "format"
  | "template"
  | "todayNote";

export type SetupStepStatus = "todo" | "satisfied";

export interface SetupStep {
  id: SetupStepId;
  /** What this run will actually do (shown when status is todo) */
  action: string;
  /** How it reads when already in place (shown when status is satisfied) */
  satisfied: string;
  status: SetupStepStatus;
}

export interface SetupBlocker {
  title: string;
  detail: string;
}

export interface DailySetupPlan {
  /** Which provider is being configured. Without Periodic Notes installed this falls back to Obsidian's core Daily Notes */
  provider: "periodic-notes" | "core-daily-notes";
  locale: SetupLocale;
  language: string;
  folder: string;
  format: string;
  templatePath: string;
  steps: SetupStep[];
  blockers: SetupBlocker[];
}

const withMarkdownExt = (path: string): string =>
  path.endsWith(".md") ? path : `${path}.md`;

const isFolder = (app: App, path: string): boolean =>
  app.vault.getAbstractFileByPath(normalizePath(path)) instanceof TFolder;

const fileExists = (app: App, path: string): boolean =>
  !!app.vault.getFileByPath(normalizePath(path));

/** The provider's current settings for the "daily" granularity; the core plugin stores its template path without an extension */
const readCurrentDailySetting = (
  app: App,
  provider: DailySetupPlan["provider"]
): PeriodicNoteGranularitySetting => {
  if (provider === "periodic-notes") {
    return getPeriodicNotesPlugin(app)?.settings?.[NoteType.DAILY] ?? {};
  }
  const core = getCoreDailyNotesPlugin(app);
  return { ...core?.instance?.options, enabled: core?.enabled };
};

const providerLabel = (provider: DailySetupPlan["provider"]): string =>
  t(
    provider === "periodic-notes"
      ? "dailySetup.providerPeriodicNotes"
      : "dailySetup.providerCoreDailyNotes"
  );

/**
 * Work out what pressing the button will actually do. **Writes nothing.**
 *
 * Every step's wording is decided by the current state: whether the folder
 * exists, whether the setting is filled in, and whether the template file
 * exists are three independent facts. Collapsing them into one line such as
 * "create the folder and the template" is how you end up saying you will create
 * something you do not create.
 */
export const buildDailySetupPlan = (app: App): DailySetupPlan => {
  const language = detectObsidianLanguage();
  const locale = resolveLanguage(language);
  const preset = DAILY_NOTE_PRESETS[locale];

  const pnInstalled = communityPluginInstalled(app, "periodic-notes");
  const provider: DailySetupPlan["provider"] =
    pnInstalled && getPeriodicNotesPlugin(app)
      ? "periodic-notes"
      : "core-daily-notes";
  const current = readCurrentDailySetting(app, provider);

  // Anything the user has already configured always wins; a default is only
  // filled in where the field is empty
  const configuredFolder = current.folder?.trim() ?? "";
  const configuredFormat = current.format?.trim() ?? "";
  const configuredTemplate = current.template?.trim() ?? "";
  const folder = configuredFolder || preset.folder;
  const format = configuredFormat || DEFAULT_DAILY_FORMAT;
  const templatePath = configuredTemplate
    ? withMarkdownExt(configuredTemplate)
    : preset.templatePath;

  const folderOnDisk = isFolder(app, folder);
  const templateOnDisk = fileExists(app, templatePath);
  const enabled = !!current.enabled;

  /**
   * Whether today's note exists has to be answered by joining **the folder and
   * format computed in this very plan**, not by asking
   * obsidian-daily-notes-interface.
   *
   * The trap, hit for real: while Periodic Notes' daily note is turned off,
   * dni's `shouldUsePeriodicNotesSettings()` falls back to the core Daily Notes
   * folder. So in the state "the PN folder is empty, the core folder has
   * today's file" the preview would announce "today's note already exists" —
   * but this run enables PN, so the file is actually created in the PN folder
   * and is an entirely different file. The preview would have stated something
   * that stops being true the moment the run starts.
   */
  const todayFilename = moment().format(format);
  const todayPath = normalizePath(`${folder}/${todayFilename}.md`);
  const todayExists = fileExists(app, todayPath);

  const steps: SetupStep[] = [
    {
      id: "folder",
      status: configuredFolder && folderOnDisk ? "satisfied" : "todo",
      action: !folderOnDisk
        ? configuredFolder
          ? t("dailySetup.stepFolderCreateMissing", { folder })
          : t("dailySetup.stepFolderCreateAndSet", { folder })
        : t("dailySetup.stepFolderSetExisting", { folder }),
      satisfied: t("dailySetup.stepFolderSatisfied", { folder }),
    },
    {
      id: "enable",
      status: enabled ? "satisfied" : "todo",
      action: t("dailySetup.stepEnableAction", { provider: providerLabel(provider) }),
      satisfied: t("dailySetup.stepEnableSatisfied", {
        provider: providerLabel(provider),
      }),
    },
    {
      id: "format",
      status: configuredFormat ? "satisfied" : "todo",
      action: t("dailySetup.stepFormatAction", { format }),
      satisfied: t("dailySetup.stepFormatSatisfied", { format }),
    },
    {
      id: "template",
      status: configuredTemplate && templateOnDisk ? "satisfied" : "todo",
      action: !templateOnDisk
        ? configuredTemplate
          ? t("dailySetup.stepTemplateCreateMissing", { path: templatePath })
          : t("dailySetup.stepTemplateCreateAndSet", { path: templatePath })
        : t("dailySetup.stepTemplateSetExisting", { path: templatePath }),
      satisfied: t("dailySetup.stepTemplateSatisfied", { path: templatePath }),
    },
    {
      id: "todayNote",
      // Even when it exists it still has to be opened, so this step always
      // runs; only what it does differs
      status: "todo",
      action: todayExists
        ? t("dailySetup.stepTodayOpen", { path: todayPath })
        : t("dailySetup.stepTodayCreate", { path: todayPath }),
      satisfied: "",
    },
  ];

  return {
    provider,
    locale,
    language,
    folder,
    format,
    templatePath,
    steps,
    blockers: buildBlockers(app, pnInstalled),
  };
};

/**
 * "The things that cannot be done."
 *
 * Why plugins are not installed automatically: `app.plugins.installPlugin`, an
 * **undocumented** internal function, does exist on Obsidian 1.13.7 (verified
 * over CDP: arity 3, and internally it issues HTTP requests to GitHub for the
 * manifest and the release archive). There are three reasons not to use it, and
 * any one of them settles it:
 * 1. It makes outbound requests, breaking this plugin's "zero outbound
 *    requests" claim outright (cli/check_network_gate.sh guards that claim).
 * 2. It downloads and executes third-party code, far beyond what a user expects
 *    when pressing a one-click setup button.
 * 3. It is not in obsidian.d.ts, so it can be renamed or removed at any time.
 */
const buildBlockers = (app: App, pnInstalled: boolean): SetupBlocker[] => {
  const cannotInstall = t("dailySetup.cannotInstall");
  const blockers: SetupBlocker[] = [];

  if (!pnInstalled) {
    blockers.push({
      title: t("dailySetup.blockerPnMissingTitle"),
      detail: t("dailySetup.blockerPnMissingDetail", { cannotInstall }),
    });
  }

  const quickAddInstalled = communityPluginInstalled(app, "quickadd");
  if (!quickAddInstalled) {
    blockers.push({
      title: t("dailySetup.blockerQuickAddMissingTitle"),
      detail: t("dailySetup.blockerQuickAddMissingDetail", { cannotInstall }),
    });
  }

  const daily = settingsStore.read()[NoteType.DAILY];
  if (daily?.useQuickAdd && daily.quickAddChoice && !quickAddInstalled) {
    blockers.push({
      title: t("dailySetup.blockerQuickAddConfiguredTitle"),
      detail: t("dailySetup.blockerQuickAddConfiguredDetail"),
    });
  }

  return blockers;
};

// ---------------------------------------------------------------- execution

/** A failure carries "which step it stopped at" upwards, so the caller can say so accurately */
export class DailySetupError extends Error {
  constructor(readonly step: SetupStep, readonly cause: unknown) {
    super(
      t("dailySetup.stepErrorMessage", {
        action: step.action,
        message: cause instanceof Error ? cause.message : String(cause),
      })
    );
    this.name = "DailySetupError";
  }
}

/** Merge a patch into the provider's daily settings and save (replaces wholesale, other keys carried through) */
const patchDailySetting = async (
  app: App,
  provider: DailySetupPlan["provider"],
  patch: PeriodicNoteGranularitySetting
): Promise<void> => {
  if (provider === "periodic-notes") {
    const pn = getPeriodicNotesPlugin(app);
    if (!pn?.updateSettings) {
      throw new Error(t("dailySetup.errorNoUpdateSettings"));
    }
    const settings = pn.settings ?? {};
    await pn.updateSettings({
      ...settings,
      [NoteType.DAILY]: { ...(settings[NoteType.DAILY] ?? {}), ...patch },
    });
    return;
  }
  const core = getCoreDailyNotesPlugin(app);
  const options = core?.instance?.options;
  if (!options || !core?.saveData) {
    throw new Error(t("dailySetup.errorNoCoreOptions"));
  }
  // enabled is not a field of the core plugin's options (it lives in
  // core-plugins.json), so it must not be written in here
  const { enabled: _ignored, template, ...rest } = patch;
  Object.assign(options, rest);
  if (template !== undefined) {
    // The core plugin stores the template path without an extension (measured:
    // that is the shape daily-notes.json actually has)
    options.template = template.replace(/\.md$/, "");
  }
  await core.saveData(options);
};

const ensureFolder = async (app: App, folder: string): Promise<void> => {
  const path = normalizePath(folder);
  if (isFolder(app, path)) return;
  await app.vault.createFolder(path);
};

/** Create only, never overwrite: if the file exists it is left untouched, because it is the user's content */
const ensureTemplateFile = async (
  app: App,
  templatePath: string,
  body: string
): Promise<void> => {
  const path = normalizePath(templatePath);
  if (fileExists(app, path)) return;
  const parent = path.split("/").slice(0, -1).join("/");
  if (parent) await ensureFolder(app, parent);
  await app.vault.create(path, body);
};

const openTodayNote = async (app: App): Promise<void> => {
  // The settings were just changed, so dni's note list has to be re-read;
  // otherwise "does today have a note" is answered against the old folder
  refreshNotes(NoteType.DAILY);
  await openOrCreateNote(
    moment(),
    NoteType.DAILY,
    readNotes(NoteType.DAILY),
    app,
    false,
    false
  );
  refreshNotes(NoteType.DAILY);
};

const executeStep = async (
  app: App,
  plan: DailySetupPlan,
  step: SetupStep
): Promise<void> => {
  switch (step.id) {
    case "folder":
      await ensureFolder(app, plan.folder);
      await patchDailySetting(app, plan.provider, { folder: plan.folder });
      return;
    case "enable":
      if (plan.provider === "periodic-notes") {
        await patchDailySetting(app, plan.provider, { enabled: true });
        return;
      }
      getCoreDailyNotesPlugin(app)?.enable?.(true);
      return;
    case "format":
      await patchDailySetting(app, plan.provider, { format: plan.format });
      return;
    case "template":
      await ensureTemplateFile(
        app,
        plan.templatePath,
        DAILY_NOTE_PRESETS[plan.locale].templateBody
      );
      await patchDailySetting(app, plan.provider, {
        template: plan.templatePath,
      });
      return;
    case "todayNote":
      await openTodayNote(app);
      return;
  }
};

/**
 * Run the plan and return the steps that actually ran.
 *
 * If any step throws, stop there (the later steps are not attempted), restore
 * the Periodic Notes settings to exactly what they were on entry, and rethrow
 * wrapped in a DailySetupError. Folders and files already created are not
 * deleted: they are only ever additions, and deleting them back out carries
 * more risk than leaving them.
 */
export const runDailySetup = async (
  app: App,
  plan: DailySetupPlan
): Promise<SetupStep[]> => {
  const pn =
    plan.provider === "periodic-notes" ? getPeriodicNotesPlugin(app) : null;
  // Somebody else's settings: deep-copy them in memory before touching them
  const backup = pn?.settings
    ? (JSON.parse(JSON.stringify(pn.settings)) as Record<string, unknown>)
    : null;

  const executed: SetupStep[] = [];
  for (const step of plan.steps) {
    if (step.status === "satisfied") continue;
    try {
      await executeStep(app, plan, step);
      executed.push(step);
    } catch (error) {
      if (pn?.updateSettings && backup) {
        await pn.updateSettings(backup);
      }
      throw new DailySetupError(step, error);
    }
  }
  return executed;
};
