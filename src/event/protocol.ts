import { App, Notice } from "obsidian";
import { t } from "../i18n";
import { settingsStore } from "../state/settings";
import { moment } from "../util/moment";
import { commitNewEvent, openQuickAddEvent } from "./commands";
import { diffDays } from "./dateMath";
import { MAX_EVENT_DAYS } from "./noteStore";
import { parseOffsets } from "./offsets";
import { parseNaturalLanguage } from "./parseNaturalLanguage";
import { EVENT_TITLE_MAX_LENGTH, sanitizeEvent, sanitizeTitle, toIsoDate } from "./sanitize";
import type { QuickAddPreset } from "../view/QuickAddEventModal";

/**
 * The `obsidian://open-taiwan-calendar` action.
 *
 * Lets a script or command-line tool hand an entry to the plugin instead of
 * writing frontmatter itself, so there is one parser and one set of rules.
 *
 * Everything in the URL is untrusted: anything on the machine can open an
 * `obsidian://` link. So the default is to open the dialog pre-filled and let
 * the user press Add; writing straight to the vault needs both `save=1` in the
 * URL and the "allow direct add" setting turned on.
 */
export const PROTOCOL_ACTION = "open-taiwan-calendar";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const TRUE_VALUES = new Set(["1", "true", "yes"]);

type Params = Record<string, string | undefined>;

/** A validated request, or the reason it was refused. */
type Parsed = { ok: true; preset: QuickAddPreset } | { ok: false; error: string };

const flag = (value: string | undefined): boolean | undefined =>
  value === undefined ? undefined : TRUE_VALUES.has(value.toLowerCase());

/** Turn the URL parameters into a dialog preset, checking every field. */
export const parseProtocolParams = (params: Params, today: string): Parsed => {
  const preset: QuickAddPreset = {};
  const bad = (field: string): Parsed => ({
    ok: false,
    error: t("protocol.badParam", { field }),
  });

  if (params.sentence?.trim()) {
    // The parser's reading of the sentence is the base; explicit fields win
    const parsed = parseNaturalLanguage(params.sentence, today);
    preset.title = parsed.title;
    preset.date = parsed.start;
    preset.end = parsed.end;
    if (parsed.isReminder) preset.remind = true;
    if (parsed.time) preset.time = parsed.time;
    if (parsed.offsets) preset.offsets = parsed.offsets;
  }
  if (params.title !== undefined) preset.title = params.title;
  if (preset.title !== undefined) {
    preset.title = sanitizeTitle(preset.title).slice(0, EVENT_TITLE_MAX_LENGTH);
  }

  if (params.start !== undefined) {
    const start = toIsoDate(params.start);
    if (!start) return bad("start");
    preset.date = start;
    // A new start with no end given is a single-day entry, not one that keeps
    // the sentence's end
    if (params.end === undefined) preset.end = start;
  }
  if (params.end !== undefined) {
    const end = toIsoDate(params.end);
    if (!end) return bad("end");
    preset.end = end;
  }
  const start = preset.date ?? today;
  const end = preset.end ?? start;
  if (end < start) return bad("end");
  if (diffDays(start, end) + 1 > MAX_EVENT_DAYS) {
    return { ok: false, error: t("protocol.tooLong", { max: MAX_EVENT_DAYS }) };
  }

  const remind = flag(params.remind);
  if (remind !== undefined) preset.remind = remind;
  if (params.time !== undefined) {
    if (!TIME_PATTERN.test(params.time)) return bad("time");
    preset.time = params.time;
  }
  if (params.offsets !== undefined) {
    const offsets = parseOffsets(params.offsets);
    if (!offsets) return bad("offsets");
    preset.offsets = offsets;
  }
  if (params.color !== undefined) {
    if (!COLOR_PATTERN.test(params.color)) return bad("color");
    preset.color = params.color.toLowerCase();
  }
  return { ok: true, preset };
};

/** Write the request straight to the vault, through the same path the dialog uses. */
const saveDirectly = async (app: App, preset: QuickAddPreset, today: string): Promise<void> => {
  const { reminder, eventDefaults } = settingsStore.read();
  const remind = preset.remind ?? reminder.enabled;
  const start = preset.date ?? today;
  // The frontmatter shape on purpose: sanitizeEvent is the one gate every
  // entry passes, whichever way it arrives
  const event = sanitizeEvent({
    id: crypto.randomUUID(),
    title: preset.title ?? "",
    start,
    end: preset.end ?? start,
    color:
      preset.color ?? (remind ? eventDefaults.reminderColor : eventDefaults.eventColor),
    ...(remind
      ? {
          remindDaysBefore: preset.offsets ?? reminder.defaultOffsets,
          remindTime: preset.time ?? reminder.defaultTime,
        }
      : {}),
    createdAt: new Date().toISOString(),
  });
  if (!event) {
    new Notice(t("protocol.badParam", { field: "title" }));
    return;
  }
  await commitNewEvent(app, event);
};

/** Handle one `obsidian://open-taiwan-calendar?...` request. */
export const handleProtocol = (app: App, params: Params): void => {
  const today = moment().format("YYYY-MM-DD");
  const parsed = parseProtocolParams(params, today);
  if (!parsed.ok) {
    new Notice(parsed.error);
    return;
  }
  const wantsSave = flag(params.save) === true;
  if (wantsSave && settingsStore.read().protocol.allowDirectAdd) {
    void saveDirectly(app, parsed.preset, today);
    return;
  }
  openQuickAddEvent(app, parsed.preset);
};
