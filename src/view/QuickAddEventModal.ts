import { App, Modal, Setting, TextComponent, ToggleComponent } from "obsidian";
import { addDays, diffDays } from "../event/dateMath";
import { dailyNoteExists, MAX_EVENT_DAYS } from "../event/noteStore";
import { formatOffsets, parseOffsets } from "../event/offsets";
import { parseNaturalLanguage } from "../event/parseNaturalLanguage";
import { findDuplicates } from "../event/duplicates";
import { inlineRemindersStore } from "../event/inlineReminders";
import type { CalendarEvent } from "../event/types";
import { t } from "../i18n";
import { settingsStore } from "../state/settings";
import { buildOffsetPicker } from "./offsetPicker";
import type { OffsetPicker } from "./offsetPicker";
import { markSettingRowShapes } from "./settingRowShape";
import { moment } from "../util/moment";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Turn a text field into a date field.
 *
 * Obsidian's TextComponent only builds `input[type="text"]`, so the type is
 * switched on the element it already made. `input[type="date"]` stores and
 * reports `YYYY-MM-DD` — exactly the stored format — so nothing is converted in
 * either direction, and typing is still allowed and still validated.
 */
const asDateInput = (text: TextComponent): TextComponent => {
  text.inputEl.type = "date";
  text.inputEl.addClass("otc-date-input");
  return text;
};

/**
 * The calendar button beside a date field.
 *
 * The browser draws its own picker button, but Chromium lays it out to the left
 * of the date here and will not be moved: `position` has no effect on
 * `::-webkit-calendar-picker-indicator` in this layout. So the native one is
 * hidden in styles.css and this stands in — an Obsidian icon button, which
 * lands to the right of the field, follows the theme, and opens the very same
 * picker through `showPicker()`.
 */
const addDatePickerButton = (setting: Setting, input: HTMLInputElement): void => {
  setting.addExtraButton((button) =>
    button
      .setIcon("calendar")
      .setTooltip(t("quickAdd.pickDate"))
      .onClick(() => {
        // Not in every embedding, and it throws if the element is not visible
        try {
          input.showPicker();
        } catch {
          input.focus();
        }
      })
  );
};

/** What the caller already knows when the dialog opens. */
export interface QuickAddPreset {
  /** From a right-click on a calendar cell. */
  date?: string;
  /** From text selected in the editor. */
  sentence?: string;
  /**
   * From the two separate editor-menu items ("add a reminder" / "add an
   * event"), so the choice the user already made is not one they make twice.
   */
  remind?: boolean;
  /** From an `obsidian://` link, which can fill every field. */
  title?: string;
  /** `YYYY-MM-DD`, inclusive. Defaults to the start date. */
  end?: string;
  /** `#rrggbb` */
  color?: string;
  /** Days before the start to fire on. */
  offsets?: number[];
  /** `HH:mm` */
  time?: string;
  /** When editing: removes the entry. Shown as a Delete button in the dialog. */
  onDelete?: () => void;
  /**
   * The inline reminder this entry is being converted from. It is the same
   * thing by design, so the duplicate warning leaves it out.
   */
  fromInline?: { path: string; line: number };
  /**
   * When set, the dialog edits this entry rather than creating one. Every
   * field starts at its current value and the id is carried through, which is
   * what makes the settings list's rows editable without a second dialog.
   */
  existing?: CalendarEvent;
}

/** Everything the dialog holds while the user is still editing it. */
interface Draft {
  title: string;
  start: string;
  end: string;
  color: string;
  remind: boolean;
  /** Kept as the raw text so a half-typed "1, " is not thrown away mid-keystroke. */
  offsets: string;
  time: string;
}

/**
 * One sentence in, one event out.
 *
 * The natural-language box is the headline, but the fields below it are not a
 * fallback for when parsing fails — they are the point. The parser is a set of
 * regular expressions over the handful of ways a date is normally written, and
 * showing what it read, editable, is what lets it stay that small: a sentence
 * it gets wrong costs one correction rather than a wrong entry in the vault.
 *
 * Typing in the sentence box overwrites the fields; typing in a field does not
 * touch the sentence. That is the only ordering that does not fight the user —
 * the alternative re-parses over an edit that was made precisely because the
 * parse was wrong.
 */
export class QuickAddEventModal extends Modal {
  private draft: Draft;
  private error: HTMLElement | null = null;
  private titleField: TextComponent | null = null;
  private startField: TextComponent | null = null;
  private endField: TextComponent | null = null;
  private remindToggle: ToggleComponent | null = null;
  private offsetsPicker: OffsetPicker | null = null;
  private timeField: TextComponent | null = null;
  private notesInfo: HTMLElement | null = null;
  /** Set once the duplicate warning has been shown; the next Add goes through. */
  private duplicateAcknowledged = false;

  constructor(
    app: App,
    private readonly onSubmit: (event: CalendarEvent) => void,
    private readonly preset: QuickAddPreset = {}
  ) {
    super(app);
    const { reminder, eventDefaults } = settingsStore.read();
    const existing = preset.existing;
    const today = existing?.start ?? preset.date ?? moment().format("YYYY-MM-DD");
    this.draft = {
      title: existing?.title ?? preset.title ?? "",
      start: today,
      end: existing?.end ?? preset.end ?? today,
      // The colour follows the kind of entry it is, unless the user has already
      // chosen one for this entry
      color:
        existing?.color ??
        preset.color ??
        ((preset.remind ?? reminder.enabled)
          ? eventDefaults.reminderColor
          : eventDefaults.eventColor),
      remind: existing
        ? existing.reminder !== null
        : (preset.remind ?? reminder.enabled),
      offsets: formatOffsets(
        existing?.reminder?.offsets ?? preset.offsets ?? reminder.defaultOffsets
      ),
      time: existing?.reminder?.time ?? preset.time ?? reminder.defaultTime,
    };
  }

  onOpen(): void {
    this.setTitle(
      this.preset.existing ? t("quickAdd.editTitle") : t("quickAdd.title")
    );
    this.modalEl.addClass("otc-quick-add-modal");

    new Setting(this.contentEl)
      .setName(t("quickAdd.inputLabel"))
      .setDesc(t("quickAdd.inputHint"))
      .setClass("otc-quick-add-sentence")
      .addText((text) => {
        text
          .setPlaceholder(t("quickAdd.inputPlaceholder"))
          .onChange((value) => this.applySentence(value));
        // Text selected in the editor arrives as the sentence, already parsed,
        // so "select the line, right-click, add" is one gesture
        if (this.preset.sentence) {
          text.setValue(this.preset.sentence);
          this.applySentence(this.preset.sentence);
        }
        // The sentence box is what the dialog is for, so it starts focused and
        // the user can type straight after the command without reaching for the
        // mouse
        window.setTimeout(() => text.inputEl.focus(), 0);
      });

    new Setting(this.contentEl)
      .setName(t("quickAdd.fieldTitle"))
      .addText((text) => {
        this.titleField = text;
        text.setValue(this.draft.title).onChange((value) => {
          this.draft.title = value;
        });
      });

    const startRow = new Setting(this.contentEl)
      .setName(t("quickAdd.fieldStart"))
      .addText((text) => {
        this.startField = asDateInput(text);
        text.setValue(this.draft.start).onChange((value) => {
          this.moveStart(value.trim());
        });
      });
    if (this.startField) addDatePickerButton(startRow, this.startField.inputEl);

    const endRow = new Setting(this.contentEl)
      .setName(t("quickAdd.fieldEnd"))
      .addText((text) => {
        this.endField = asDateInput(text);
        text.setValue(this.draft.end).onChange((value) => {
          // Clamped rather than rejected: the picker's `min` already stops the
          // calendar from offering an earlier day, so anything that reaches
          // here was typed, and snapping it to the start is a smaller
          // interruption than an error the user has to read and undo
          const next = value.trim();
          this.draft.end =
            ISO_DATE_PATTERN.test(next) && next < this.draft.start
              ? this.draft.start
              : next;
          if (this.draft.end !== next) this.endField?.setValue(this.draft.end);
          this.updateNotesInfo();
        });
      });
    if (this.endField) {
      addDatePickerButton(endRow, this.endField.inputEl);
      this.endField.inputEl.min = this.draft.start;
    }

    // Which daily notes this entry lands in, and which of them do not exist
    // yet: a nine-day trip silently creating six template-only notes is what
    // the user only found out about afterwards
    this.notesInfo = this.contentEl.createDiv({ cls: "otc-quick-add-notes" });
    this.updateNotesInfo();

    new Setting(this.contentEl)
      .setName(t("quickAdd.fieldColor"))
      .addColorPicker((picker) =>
        picker.setValue(this.draft.color).onChange((value) => {
          this.draft.color = value;
        })
      );

    new Setting(this.contentEl)
      .setName(t("quickAdd.fieldReminder"))
      .addToggle((toggle) => {
        this.remindToggle = toggle;
        toggle.setValue(this.draft.remind).onChange((value) => {
          this.draft.remind = value;
        });
      });

    new Setting(this.contentEl)
      .setName(t("quickAdd.fieldOffsets"))
      .setDesc(t("quickAdd.fieldOffsetsDesc"))
      .then((setting) => {
        this.offsetsPicker = buildOffsetPicker(
          setting.controlEl,
          parseOffsets(this.draft.offsets) ?? [],
          (offsets) => {
            // An unreadable custom field is kept as text, so submit reports it
            this.draft.offsets = offsets ? formatOffsets(offsets) : "x";
          }
        );
      });

    new Setting(this.contentEl)
      .setName(t("quickAdd.fieldTime"))
      .addText((text) => {
        this.timeField = text;
        // A native time input: it cannot hold 25:00, and it reports HH:mm
        text.inputEl.type = "time";
        text
          .setPlaceholder(t("quickAdd.timePlaceholder"))
          .setValue(this.draft.time)
          .onChange((value) => {
            this.draft.time = value.trim();
          });
      });

    // Created empty and filled on failure, rather than created on demand: a row
    // that appears between two fields shifts everything below it, and the
    // button the user was about to press moves out from under the pointer
    this.error = this.contentEl.createDiv({
      cls: "otc-quick-add-error",
      // Read out by screen readers as soon as it changes
      attr: { role: "alert", "aria-live": "assertive" },
    });

    // Enter in any single-line field submits; Ctrl/Cmd+Enter anywhere does.
    // An Enter that picks a candidate in an input method is not a submit.
    this.contentEl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || event.isComposing) return;
      const target = event.target as HTMLElement;
      const singleLine =
        target.instanceOf(HTMLInputElement) &&
        ["text", "date", "time", "search", "number"].includes(target.type);
      if (event.ctrlKey || event.metaKey || singleLine) {
        event.preventDefault();
        this.submit();
      }
    });

    const buttons = new Setting(this.contentEl);
    const onDelete = this.preset.onDelete;
    if (this.preset.existing && onDelete) {
      buttons.addButton((button) =>
        button
          .setButtonText(t("settings.eventDeleteAction"))
          .setDestructive()
          .onClick(() => {
            this.close();
            onDelete();
          })
      );
    }
    buttons
      .addButton((button) =>
        button.setButtonText(t("common.cancel")).onClick(() => this.close())
      )
      .addButton((button) =>
        button
          .setButtonText(
            this.preset.existing ? t("quickAdd.save") : t("quickAdd.submit")
          )
          .setCta()
          .onClick(() => this.submit())
      );

    // The rows are built once and never change shape, so one pass here is the
    // whole of what `:has()` used to do continuously. See settingRowShape.ts.
    markSettingRowShapes(this.contentEl);
  }

  /**
   * Move the start date, taking the end date with it.
   *
   * The length of an entry is what the user set; the start is what they are
   * moving. Dragging a three-day trip from Monday to Wednesday should still be
   * three days, so the end shifts by the same amount rather than staying put
   * and silently shortening the entry — or worse, ending up before the start.
   */
  private moveStart(next: string): void {
    const previous = this.draft.start;
    this.draft.start = next;
    if (this.endField) this.endField.inputEl.min = next;
    if (!ISO_DATE_PATTERN.test(next) || !ISO_DATE_PATTERN.test(previous)) return;

    const span = ISO_DATE_PATTERN.test(this.draft.end)
      ? Math.max(0, diffDays(previous, this.draft.end))
      : 0;
    this.draft.end = addDays(next, span);
    this.endField?.setValue(this.draft.end);
    this.updateNotesInfo();
  }

  /**
   * Say how many daily notes the entry covers and which ones saving creates.
   *
   * Reads the note index only; nothing is created until the user saves.
   */
  private updateNotesInfo(): void {
    const el = this.notesInfo;
    if (!el) return;
    const { start, end } = this.draft;
    if (!ISO_DATE_PATTERN.test(start) || !ISO_DATE_PATTERN.test(end) || end < start) {
      el.setText("");
      el.removeClass("is-warning");
      return;
    }
    const span = Math.min(diffDays(start, end) + 1, MAX_EVENT_DAYS);
    const missing = Array.from({ length: span }, (_, i) => addDays(start, i)).filter(
      (day) => !dailyNoteExists(day)
    );
    const listed = missing.slice(0, 3).join(t("event.offsetSeparator"));
    const more = missing.length > 3 ? t("quickAdd.notesMore", { count: missing.length - 3 }) : "";
    let text =
      missing.length === 0
        ? t("quickAdd.notesNoneNew", { days: span })
        : t("quickAdd.notesNew", { days: span, count: missing.length, dates: listed + more });
    const existing = this.preset.existing;
    if (existing && (existing.start !== start || existing.end !== end)) {
      text += t("quickAdd.notesOldRange");
    }
    el.setText(text);
    el.toggleClass("is-warning", missing.length > 7);
  }

  /**
   * Re-read the sentence and push what it found into the fields.
   *
   * Safe to call before the fields exist, which is what the preset path does:
   * the draft is updated either way, and each field below is built from the
   * draft, so the optional chaining is the mechanism rather than a precaution.
   */
  private applySentence(sentence: string): void {
    if (sentence.trim().length === 0) return;
    const parsed = parseNaturalLanguage(
      sentence,
      moment().format("YYYY-MM-DD")
    );
    this.draft.title = parsed.title;
    this.draft.start = parsed.start;
    this.draft.end = parsed.end;
    // A sentence that opened with "remind me" says so; one that did not leaves
    // the toggle wherever the caller or the default put it
    if (parsed.isReminder) this.draft.remind = true;
    // A time or lead time the sentence named replaces the default; one it did
    // not name leaves the field as it is
    if (parsed.time) {
      this.draft.time = parsed.time;
      this.timeField?.setValue(parsed.time);
    }
    if (parsed.offsets) {
      this.draft.offsets = formatOffsets(parsed.offsets);
      this.offsetsPicker?.setValue(parsed.offsets);
    }

    this.titleField?.setValue(parsed.title);
    this.startField?.setValue(parsed.start);
    this.endField?.setValue(parsed.end);
    if (this.endField) this.endField.inputEl.min = parsed.start;
    this.updateNotesInfo();
    this.remindToggle?.setValue(this.draft.remind);
    this.showError("");
  }

  private showError(message: string, field?: HTMLElement | null): void {
    // The first field with the problem gets the focus
    field?.focus();
    if (!this.error) return;
    this.error.setText(message);
    this.error.toggleClass("is-visible", message.length > 0);
  }

  private submit(): void {
    const { title, start, end, color, remind, offsets, time } = this.draft;
    const cleanTitle = title.trim();
    if (cleanTitle.length === 0) {
      this.showError(t("quickAdd.errorEmptyTitle"), this.titleField?.inputEl);
      return;
    }
    if (!ISO_DATE_PATTERN.test(start) || !ISO_DATE_PATTERN.test(end)) {
      this.showError(
        t("quickAdd.errorBadDate"),
        ISO_DATE_PATTERN.test(start) ? this.endField?.inputEl : this.startField?.inputEl
      );
      return;
    }
    if (end < start) {
      this.showError(t("quickAdd.errorEndBeforeStart"), this.endField?.inputEl);
      return;
    }
    // The store writes at most this many notes; a longer entry would be cut
    // short without a word, so it is refused here instead
    if (diffDays(start, end) + 1 > MAX_EVENT_DAYS) {
      this.showError(t("quickAdd.errorTooLong", { max: MAX_EVENT_DAYS }), this.endField?.inputEl);
      return;
    }

    let reminder: CalendarEvent["reminder"] = null;
    if (remind) {
      if (!TIME_PATTERN.test(time)) {
        this.showError(t("quickAdd.errorBadTime"), this.timeField?.inputEl);
        return;
      }
      const parsedOffsets = parseOffsets(offsets);
      if (!parsedOffsets) {
        this.showError(
          t("quickAdd.errorNoOffset"),
          this.contentEl.querySelector<HTMLElement>(".otc-offset-chip input")
        );
        return;
      }
      reminder = { offsets: parsedOffsets, time };
    }

    const candidate = {
      id: this.preset.existing?.id ?? "",
      title: cleanTitle,
      start,
      end,
      reminder,
    };
    const settings = settingsStore.read();
    const duplicates = settings.appearance.inlineReminders
      ? findDuplicates(candidate, inlineRemindersStore.read(), settings.ignoredDuplicates).filter(
          (item) =>
            !(item.path === this.preset.fromInline?.path && item.line === this.preset.fromInline?.line)
        )
      : [];
    if (duplicates.length > 0 && !this.duplicateAcknowledged) {
      this.duplicateAcknowledged = true;
      this.showError(
        t("duplicate.beforeSave", { items: duplicates.map((d) => d.text).join(t("event.offsetSeparator")) })
      );
      return;
    }

    this.onSubmit({
      // The id is carried through when editing, so the entry keeps its place
      // in the list and its already-fired reminder record
      id: this.preset.existing?.id ?? crypto.randomUUID(),
      title: cleanTitle,
      start,
      end,
      color,
      reminder,
      createdAt: this.preset.existing?.createdAt ?? new Date().toISOString(),
      done: this.preset.existing?.done ?? false,
    });
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
