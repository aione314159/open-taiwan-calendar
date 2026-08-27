import { App, Modal, Setting, TextComponent, ToggleComponent } from "obsidian";
import { addDays, diffDays } from "../event/dateMath";
import { formatOffsets, parseOffsets } from "../event/offsets";
import { parseNaturalLanguage } from "../event/parseNaturalLanguage";
import type { CalendarEvent } from "../event/types";
import { t } from "../i18n";
import { settingsStore } from "../state/settings";
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
      title: existing?.title ?? "",
      start: today,
      end: existing?.end ?? today,
      // The colour follows the kind of entry it is, unless the user has already
      // chosen one for this entry
      color:
        existing?.color ??
        ((preset.remind ?? reminder.enabled)
          ? eventDefaults.reminderColor
          : eventDefaults.eventColor),
      remind: existing
        ? existing.reminder !== null
        : (preset.remind ?? reminder.enabled),
      offsets: formatOffsets(existing?.reminder?.offsets ?? reminder.defaultOffsets),
      time: existing?.reminder?.time ?? reminder.defaultTime,
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
        text.inputEl.addEventListener("keydown", (event) => {
          if (event.key === "Enter") this.submit();
        });
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
        });
      });
    if (this.endField) {
      addDatePickerButton(endRow, this.endField.inputEl);
      this.endField.inputEl.min = this.draft.start;
    }

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
      .addText((text) =>
        text.setValue(this.draft.offsets).onChange((value) => {
          this.draft.offsets = value;
        })
      );

    new Setting(this.contentEl)
      .setName(t("quickAdd.fieldTime"))
      .addText((text) =>
        text
          .setPlaceholder(t("quickAdd.timePlaceholder"))
          .setValue(this.draft.time)
          .onChange((value) => {
            this.draft.time = value.trim();
          })
      );

    // Created empty and filled on failure, rather than created on demand: a row
    // that appears between two fields shifts everything below it, and the
    // button the user was about to press moves out from under the pointer
    this.error = this.contentEl.createDiv({ cls: "otc-quick-add-error" });

    new Setting(this.contentEl)
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

    this.titleField?.setValue(parsed.title);
    this.startField?.setValue(parsed.start);
    this.endField?.setValue(parsed.end);
    if (this.endField) this.endField.inputEl.min = parsed.start;
    this.remindToggle?.setValue(this.draft.remind);
    this.showError("");
  }

  private showError(message: string): void {
    if (!this.error) return;
    this.error.setText(message);
    this.error.toggleClass("is-visible", message.length > 0);
  }

  private submit(): void {
    const { title, start, end, color, remind, offsets, time } = this.draft;
    const cleanTitle = title.trim();
    if (cleanTitle.length === 0) {
      this.showError(t("quickAdd.errorEmptyTitle"));
      return;
    }
    if (!ISO_DATE_PATTERN.test(start) || !ISO_DATE_PATTERN.test(end)) {
      this.showError(t("quickAdd.errorBadDate"));
      return;
    }
    if (end < start) {
      this.showError(t("quickAdd.errorEndBeforeStart"));
      return;
    }

    let reminder: CalendarEvent["reminder"] = null;
    if (remind) {
      if (!TIME_PATTERN.test(time)) {
        this.showError(t("quickAdd.errorBadTime"));
        return;
      }
      const parsedOffsets = parseOffsets(offsets);
      if (!parsedOffsets) {
        this.showError(t("quickAdd.errorNoOffset"));
        return;
      }
      reminder = { offsets: parsedOffsets, time };
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
    });
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
