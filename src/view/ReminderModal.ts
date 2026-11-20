import { App, Menu, Modal, Setting, setIcon, setTooltip } from "obsidian";
import { settingsStore } from "../state/settings";
import { moment } from "../util/moment";
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
/** What the dialog can ask its owner to do. */
export interface ReminderActions {
  /** Push these items back until `until` (epoch ms). */
  onSnooze: (items: DueReminder[], until: number) => void;
  /** Mark one item handled, so its later occurrences stay silent. */
  onDone: (event: CalendarEvent) => Promise<void>;
  /** Open the daily note of the item's start date. */
  onOpenNote: (event: CalendarEvent) => Promise<void>;
}

/** "Later today" is this hour, offered only while it is still ahead. */
const LATER_TODAY_HOUR = 18;

export class ReminderModal extends Modal {
  constructor(
    app: App,
    private readonly items: DueReminder[],
    private readonly snoozeMinutes: number,
    private readonly actions: ReminderActions
  ) {
    super(app);
  }

  /** The snooze choices, as label and end time; "later today" drops out once past. */
  private snoozeChoices(): Array<[string, number]> {
    const now = moment();
    const choices: Array<[string, number]> = [
      [
        t("reminder.snooze", { minutes: this.snoozeMinutes }),
        now.clone().add(this.snoozeMinutes, "minutes").valueOf(),
      ],
      [t("reminder.snoozeHour"), now.clone().add(1, "hour").valueOf()],
    ];
    const laterToday = now.clone().startOf("day").add(LATER_TODAY_HOUR, "hours");
    if (laterToday.isAfter(now)) {
      choices.push([
        t("reminder.snoozeLaterToday", { time: laterToday.format("HH:mm") }),
        laterToday.valueOf(),
      ]);
    }
    const [hour, minute] = settingsStore.read().reminder.defaultTime.split(":").map(Number);
    const tomorrow = now.clone().add(1, "day").startOf("day").add(hour, "hours").add(minute, "minutes");
    choices.push([
      t("reminder.snoozeTomorrow", { time: tomorrow.format("HH:mm") }),
      tomorrow.valueOf(),
    ]);
    return choices;
  }

  private showSnoozeMenu(event: MouseEvent, items: DueReminder[], after: () => void): void {
    const menu = new Menu();
    for (const [label, until] of this.snoozeChoices()) {
      menu.addItem((item) =>
        item.setTitle(label).onClick(() => {
          this.actions.onSnooze(items, until);
          after();
        })
      );
    }
    menu.showAtMouseEvent(event);
  }

  onOpen(): void {
    this.setTitle(t("reminder.modalTitle"));
    this.modalEl.addClass("otc-reminder-modal");

    const list = this.contentEl.createDiv({ cls: "otc-reminder-list" });
    for (const item of this.items) {
      const { event, daysUntil } = item;
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

      const buttons: HTMLButtonElement[] = [];
      const settle = (cls: string) => {
        row.addClass(cls);
        buttons.forEach((b) => (b.disabled = true));
      };
      const rowActions: Array<[string, string, (e: MouseEvent) => void]> = [
        ["file-text", t("reminder.openNote"), () => void this.actions.onOpenNote(event)],
        [
          "alarm-clock",
          t("reminder.snoozeMenu"),
          (e) => this.showSnoozeMenu(e, [item], () => settle("is-snoozed")),
        ],
        [
          "check-circle",
          t("eventList.markDone"),
          () => void this.actions.onDone(event).then(() => settle("is-done")),
        ],
      ];
      for (const [icon, label, run] of rowActions) {
        const button = row.createEl("button", { cls: "clickable-icon otc-reminder-done" });
        setIcon(button, icon);
        setTooltip(button, label);
        button.setAttr("aria-label", label);
        button.addEventListener("click", (e) => run(e));
        buttons.push(button);
      }
    }

    new Setting(this.contentEl)
      .addButton((button) =>
        button.setButtonText(t("reminder.snoozeAll")).onClick((e) =>
          this.showSnoozeMenu(e, this.items, () => this.close())
        )
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

/** One entry whose reminders all passed while Obsidian was closed. */
export interface MissedReminder {
  event: CalendarEvent;
  /** Days since the entry started. */
  daysAgo: number;
}

/**
 * "You missed these" — shown once, on the first sweep after a gap.
 *
 * The regular sweep stays silent about an entry that has already begun; this
 * is the one place that says so, so a reminder lost to a closed laptop is not
 * lost without a trace.
 */
export class MissedReminderModal extends Modal {
  constructor(
    app: App,
    private readonly items: MissedReminder[],
    private readonly onRemindToday: (event: CalendarEvent) => Promise<void>,
    private readonly onOpenNote: (event: CalendarEvent) => Promise<void>
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(t("reminder.missedTitle"));
    this.modalEl.addClass("otc-reminder-modal");

    const list = this.contentEl.createDiv({ cls: "otc-reminder-list" });
    for (const { event, daysAgo } of this.items) {
      const row = list.createDiv({ cls: "otc-reminder-row" });
      row.createDiv({ cls: "otc-reminder-dot" }).style.setProperty(
        "--otc-event-color",
        event.color
      );
      const text = row.createDiv({ cls: "otc-reminder-text" });
      text.createDiv({ cls: "otc-reminder-title", text: event.title });
      text.createDiv({
        cls: "otc-reminder-meta",
        text: t("reminder.missedMeta", { date: shortDate(event.start), count: daysAgo }),
      });
      const actions: Array<[string, string, () => Promise<void>]> = [
        ["alarm-clock", t("reminder.remindToday"), () => this.onRemindToday(event)],
        ["file-text", t("reminder.openNote"), () => this.onOpenNote(event)],
      ];
      for (const [icon, label, run] of actions) {
        const button = row.createEl("button", { cls: "clickable-icon otc-reminder-done" });
        setIcon(button, icon);
        setTooltip(button, label);
        button.setAttr("aria-label", label);
        button.addEventListener("click", () => {
          button.disabled = true;
          void run().then(() => row.addClass("is-done"));
        });
      }
    }

    new Setting(this.contentEl).addButton((button) =>
      button
        .setButtonText(t("reminder.acknowledge"))
        .setCta()
        .onClick(() => this.close())
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
