import { App, Modal, Setting } from "obsidian";
import { commitNewEvent, openQuickAddEvent } from "../event/commands";
import { sanitizeEvent } from "../event/sanitize";
import { t } from "../i18n";
import { findDatedTasks } from "../note/datedTasks";
import type { DatedTask } from "../note/datedTasks";
import { settingsStore } from "../state/settings";
import { createConfirmationDialog } from "./ConfirmModal";

/**
 * "To-dos with a date and no reminder": the results of one scan, each row
 * turned into a reminder through the usual dialog, or skipped.
 */
export class DatedTasksModal extends Modal {
  private tasks: DatedTask[] = [];
  private listEl: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;

  constructor(app: App) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(t("datedTasks.title"));
    this.modalEl.addClass("otc-event-list-modal");
    this.statusEl = this.contentEl.createDiv({ cls: "otc-carry-over-source" });
    this.listEl = this.contentEl.createDiv({ cls: "otc-event-list" });
    void findDatedTasks(this.app, (done, total) =>
      this.statusEl?.setText(t("datedTasks.scanning", { done, total }))
    ).then((tasks) => {
      this.tasks = tasks;
      this.render();
    });
  }

  private render(): void {
    const el = this.listEl;
    if (!el) return;
    el.empty();
    this.statusEl?.setText(t("datedTasks.found", { count: this.tasks.length }));
    if (this.tasks.length === 0) {
      el.createDiv({ cls: "otc-event-list-empty", text: t("datedTasks.empty") });
      return;
    }
    for (const task of this.tasks) {
      const row = el.createDiv({ cls: "otc-event-row" });
      const text = row.createDiv({ cls: "otc-event-row-text" });
      text.createDiv({ cls: "otc-event-row-title", text: task.line });
      text.createDiv({
        cls: "otc-event-row-meta",
        text: t("datedTasks.meta", { date: task.parsed.start, note: task.file.basename }),
      });
      new Setting(row)
        .addButton((button) =>
          button.setButtonText(t("datedTasks.skip")).onClick(() => this.drop(task))
        )
        .addButton((button) =>
          button
            .setButtonText(t("datedTasks.add"))
            .setCta()
            .onClick(() =>
              openQuickAddEvent(this.app, { sentence: task.line, remind: true }, () =>
                this.drop(task)
              )
            )
        );
    }
    new Setting(el).addButton((button) =>
      button.setButtonText(t("datedTasks.addAll", { count: this.tasks.length })).onClick(() =>
        createConfirmationDialog({
          ctx: this.app,
          title: t("datedTasks.addAll", { count: this.tasks.length }),
          text: t("datedTasks.addAllConfirm", { count: this.tasks.length }),
          cta: t("datedTasks.add"),
          onAccept: async () => {
            for (const task of [...this.tasks]) {
              await this.addDirectly(task);
              this.drop(task);
            }
          },
        })
      )
    );
  }

  /** The dialog's defaults, without the dialog: one reminder per row. */
  private async addDirectly(task: DatedTask): Promise<void> {
    const { reminder, eventDefaults } = settingsStore.read();
    const event = sanitizeEvent({
      id: crypto.randomUUID(),
      title: task.parsed.title,
      start: task.parsed.start,
      end: task.parsed.end,
      color: eventDefaults.reminderColor,
      remindDaysBefore: task.parsed.offsets ?? reminder.defaultOffsets,
      remindTime: task.parsed.time ?? reminder.defaultTime,
      createdAt: new Date().toISOString(),
    });
    if (event) await commitNewEvent(this.app, event);
  }

  private drop(task: DatedTask): void {
    this.tasks = this.tasks.filter((other) => other !== task);
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
