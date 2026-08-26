import { App, Modal, Setting } from "obsidian";
import { t } from "../i18n";

interface ConfirmationDialogParams {
  /** Label on the confirming button. */
  cta: string;
  /**
   * Runs when the confirming button is pressed. It receives the click event;
   * an implementation with no use for it can simply take no parameters.
   */
  onAccept: (event: MouseEvent) => Promise<void>;
  text: string;
  title: string;
}

/**
 * A two-button confirmation dialog.
 *
 * The content is built in `onOpen` rather than in the constructor so that a
 * dialog which is constructed but never opened costs nothing, and so that the
 * elements are created against a contentEl Obsidian has already prepared.
 */
class ConfirmationModal extends Modal {
  constructor(
    app: App,
    private readonly params: ConfirmationDialogParams
  ) {
    super(app);
  }

  onOpen(): void {
    const { cta, onAccept, text, title } = this.params;
    this.setTitle(title);
    this.contentEl.createEl("p", { text });

    new Setting(this.contentEl)
      .addButton((button) =>
        button.setButtonText(t("common.cancel")).onClick(() => this.close())
      )
      .addButton((button) =>
        button
          .setButtonText(cta)
          .setCta()
          .onClick(async (event) => {
            // Closing goes in `finally`: were onAccept to throw, the user would
            // otherwise be left staring at a dialog that refuses to dismiss
            try {
              await onAccept(event);
            } finally {
              this.close();
            }
          })
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export const createConfirmationDialog = ({
  ctx,
  ...params
}: ConfirmationDialogParams & { ctx: App }): void => {
  new ConfirmationModal(ctx, params).open();
};
