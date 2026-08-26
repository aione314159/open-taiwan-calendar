import { App, Modal, Setting } from "obsidian";
import { shortDate } from "../event/dateMath";
import type { CalendarEvent } from "../event/types";
import { t } from "../i18n";

/** One event that has come due, with how far off it still is. */
export interface DueReminder {
  event: CalendarEvent;
  /** Days from today to the event's start. 0 is today, negative once begun. */
  daysUntil: number;
  /** Which of the rule's offsets fired, so a snooze can re-arm that one. */
  offset: number;
}

/**
 * The "alert window" the feature was asked for.
 *
 * A modal rather than a notice because the whole point of this channel is that
 * it does not go away on its own: a reminder that fades after four seconds is
 * one the user can miss by being away from the keyboard, which is exactly when
 * a reminder matters.
 *
 * Every due item goes into one dialog rather than one dialog each. Three
 * reminders landing at 09:00 would otherwise stack three modals on top of one
 * another, and Obsidian gives the user no way to see past the top one.
 */
export class ReminderModal extends Modal {
  constructor(
    app: App,
    private readonly items: DueReminder[],
    private readonly snoozeMinutes: number,
    /** Called instead of a plain dismissal; the scheduler re-arms the items. */
    private readonly onSnooze: () => void
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(t("reminder.modalTitle"));
    this.modalEl.addClass("otc-reminder-modal");

    const list = this.contentEl.createDiv({ cls: "otc-reminder-list" });
    for (const { event, daysUntil } of this.items) {
      const row = list.createDiv({ cls: "otc-reminder-row" });
      // The colour is the same one the calendar draws, so the reminder and the
      // bar the user has been looking at are recognisably the same thing. It is
      // set as a custom property rather than as a colour: styles.css owns how
      // the dot is drawn, this only says which colour to draw it in.
      row.createDiv({ cls: "otc-reminder-dot" }).style.setProperty(
        "--otc-event-color",
        event.color
      );
      const text = row.createDiv({ cls: "otc-reminder-text" });
      text.createDiv({ cls: "otc-reminder-title", text: event.title });
      text.createDiv({
        cls: "otc-reminder-meta",
        text: this.metaLine(event, daysUntil),
      });
    }

    new Setting(this.contentEl)
      .addButton((button) =>
        button
          .setButtonText(t("reminder.snooze", { minutes: this.snoozeMinutes }))
          .onClick(() => {
            this.onSnooze();
            this.close();
          })
      )
      .addButton((button) =>
        button
          .setButtonText(t("reminder.acknowledge"))
          .setCta()
          .onClick(() => this.close())
      );
  }

  /** "Today · 10/24" or "In 3 d · 10/24 – 11/01". */
  private metaLine(event: CalendarEvent, daysUntil: number): string {
    const when =
      daysUntil <= 0
        ? t("reminder.dueToday")
        : t("reminder.dueInDays", { count: daysUntil });
    const range =
      event.start === event.end
        ? shortDate(event.start)
        : t("event.dateRange", {
            start: shortDate(event.start),
            end: shortDate(event.end),
          });
    return `${when} · ${range}`;
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
