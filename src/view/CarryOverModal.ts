import { App, Modal, Setting, TFile } from "obsidian";
import { t } from "../i18n";
import { carryOver } from "../note/carryOver";
import type { OpenTask } from "../note/carryOver";

/**
 * Preview of the open to-dos about to be carried into today, grouped the way
 * they are in the source note. Every task starts selected.
 */
export class CarryOverModal extends Modal {
  private readonly selected = new Set<OpenTask>();

  constructor(
    app: App,
    private readonly source: TFile,
    private readonly tasks: OpenTask[]
  ) {
    super(app);
    tasks.forEach((task) => this.selected.add(task));
  }

  onOpen(): void {
    this.setTitle(t("carryOver.title"));
    this.modalEl.addClass("otc-carry-over-modal");
    this.contentEl.createDiv({
      cls: "otc-carry-over-source",
      text: t("carryOver.from", { note: this.source.basename }),
    });

    const list = this.contentEl.createDiv({ cls: "otc-carry-over-list" });
    let lastHeading = "";
    for (const task of this.tasks) {
      const heading = [task.section, task.group].filter(Boolean).join(" › ");
      if (heading !== lastHeading) {
        list.createDiv({ cls: "otc-carry-over-heading", text: heading });
        lastHeading = heading;
      }
      const row = list.createEl("label", { cls: "otc-carry-over-row" });
      const box = row.createEl("input", { type: "checkbox" });
      box.checked = true;
      box.addEventListener("change", () => {
        if (box.checked) this.selected.add(task);
        else this.selected.delete(task);
      });
      row.createSpan({ text: task.lines[0].replace(/^- \[ \] /, "") });
      if (task.lines.length > 1) {
        row.createSpan({
          cls: "otc-carry-over-children",
          text: t("carryOver.children", { count: task.lines.length - 1 }),
        });
      }
    }

    new Setting(this.contentEl)
      .addButton((button) =>
        button.setButtonText(t("common.cancel")).onClick(() => this.close())
      )
      .addButton((button) =>
        button
          .setButtonText(t("carryOver.submit"))
          .setCta()
          .onClick(() => {
            const chosen = this.tasks.filter((task) => this.selected.has(task));
            this.close();
            if (chosen.length > 0) void carryOver(this.app, this.source, chosen);
          })
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
