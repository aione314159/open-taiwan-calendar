import { App, DropdownComponent, Modal, Setting } from "obsidian";
import { t } from "../i18n";
import { captureTask, sectionsForDate } from "../note/captureTask";
import { patchSettings, settingsStore } from "../state/settings";
import { moment } from "../util/moment";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * "Note a to-do on this day": one line of text, a date and a section.
 *
 * The section list comes from the target note's headings, or from the latest
 * daily note when the target does not exist yet. The last section used is
 * remembered.
 */
export class CaptureTaskModal extends Modal {
  private text = "";
  private day: string;
  private section = "";
  private dropdown: DropdownComponent | null = null;
  private error: HTMLElement | null = null;

  constructor(app: App, day?: string) {
    super(app);
    this.day = day ?? moment().format("YYYY-MM-DD");
  }

  onOpen(): void {
    this.setTitle(t("capture.title"));
    this.modalEl.addClass("otc-quick-add-modal");

    new Setting(this.contentEl).setName(t("capture.text")).addText((text) => {
      text.onChange((value) => (this.text = value));
      window.setTimeout(() => text.inputEl.focus(), 0);
      text.inputEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.isComposing) void this.submit();
      });
    });

    new Setting(this.contentEl).setName(t("capture.date")).addText((text) => {
      text.inputEl.type = "date";
      text.setValue(this.day).onChange((value) => {
        this.day = value.trim();
        this.fillSections();
      });
    });

    new Setting(this.contentEl).setName(t("capture.section")).addDropdown((dropdown) => {
      this.dropdown = dropdown;
      dropdown.onChange((value) => (this.section = value));
    });
    this.fillSections();

    this.error = this.contentEl.createDiv({ cls: "otc-quick-add-error" });

    new Setting(this.contentEl)
      .addButton((button) =>
        button.setButtonText(t("common.cancel")).onClick(() => this.close())
      )
      .addButton((button) =>
        button
          .setButtonText(t("capture.submit"))
          .setCta()
          .onClick(() => void this.submit())
      );
  }

  /** Rebuild the section choices for the current date, keeping the last pick. */
  private fillSections(): void {
    const dropdown = this.dropdown;
    if (!dropdown || !ISO_DATE_PATTERN.test(this.day)) return;
    const sections = sectionsForDate(this.app, this.day);
    const remembered = settingsStore.read().lastCaptureSection;
    dropdown.selectEl.empty();
    for (const section of sections) dropdown.addOption(section, section);
    if (remembered && !sections.includes(remembered)) {
      dropdown.addOption(remembered, remembered);
    }
    this.section =
      remembered && (sections.includes(remembered) || sections.length === 0)
        ? remembered
        : (sections[0] ?? remembered);
    dropdown.setValue(this.section);
  }

  private showError(message: string): void {
    this.error?.setText(message);
    this.error?.toggleClass("is-visible", message.length > 0);
  }

  private async submit(): Promise<void> {
    const text = this.text.trim();
    if (!text) return this.showError(t("capture.errorEmpty"));
    if (!ISO_DATE_PATTERN.test(this.day)) return this.showError(t("quickAdd.errorBadDate"));
    if (!this.section) return this.showError(t("capture.errorNoSection"));
    patchSettings({ lastCaptureSection: this.section });
    this.close();
    await captureTask(this.app, this.day, this.section, text);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
