import { App, Modal, Setting } from "obsidian";
import { convertInlineDirectly } from "../event/inlineConvert";
import type { InlineReminder } from "../event/inlineReminders";
import { t } from "../i18n";
import { createConfirmationDialog } from "./ConfirmModal";

/** Every upcoming inline reminder, selectable, converted in one go after a count check. */
export class InlineConvertModal extends Modal {
  private readonly selected: Set<InlineReminder>;
  private removeMarks = false;

  constructor(app: App, private readonly items: InlineReminder[]) {
    super(app);
    this.selected = new Set(items);
  }

  onOpen(): void {
    this.setTitle(t("inline.batchTitle"));
    this.modalEl.addClass("otc-carry-over-modal");
    const list = this.contentEl.createDiv({ cls: "otc-carry-over-list" });
    for (const item of this.items) {
      const row = list.createEl("label", { cls: "otc-carry-over-row" });
      const box = row.createEl("input", { type: "checkbox" });
      box.checked = true;
      box.addEventListener("change", () => {
        if (box.checked) this.selected.add(item);
        else this.selected.delete(item);
      });
      row.createSpan({ text: item.text });
      row.createSpan({
        cls: "otc-carry-over-children",
        text: `${item.date} ${item.time ?? ""}`.trim(),
      });
    }
    new Setting(this.contentEl)
      .setName(t("inline.batchRemoveMarks"))
      .addToggle((toggle) => toggle.setValue(false).onChange((v) => (this.removeMarks = v)));
    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText(t("common.cancel")).onClick(() => this.close()))
      .addButton((button) =>
        button
          .setButtonText(t("inline.convert"))
          .setCta()
          .onClick(() => {
            const chosen = this.items.filter((item) => this.selected.has(item));
            if (chosen.length === 0) return;
            createConfirmationDialog({
              ctx: this.app,
              title: t("inline.batchTitle"),
              text: t("inline.batchConfirm", { count: chosen.length }),
              cta: t("inline.convert"),
              onAccept: async () => {
                this.close();
                await convertInlineDirectly(this.app, chosen, this.removeMarks);
              },
            });
          })
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
