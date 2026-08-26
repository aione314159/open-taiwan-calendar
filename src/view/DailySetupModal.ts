import { App, Modal, Notice, setIcon } from "obsidian";
import {
  DailySetupError,
  buildDailySetupPlan,
  runDailySetup,
} from "../note/dailySetup";
import type { DailySetupPlan, SetupStep } from "../note/dailySetup";
import { t } from "../i18n";
import { closePluginSettings } from "../util/pluginSettings";

/**
 * The preview modal for "Set up daily notes".
 *
 * This button writes into the user's vault and changes the settings of
 * Periodic Notes — somebody else's plugin — so the preview is a safety valve
 * rather than decoration: **everything it shows comes from the real difference
 * calculation in buildDailySetupPlan**, with not one hard-coded line claiming
 * that something "will be done". Items already in place honestly read as
 * "no change".
 *
 * An Obsidian native Modal rather than React: the settings page is DOM built by
 * the Obsidian API anyway, and standing up a React tree here for one dialog
 * would only add another lifecycle that has to be unmounted.
 */
export class DailySetupModal extends Modal {
  private plan: DailySetupPlan;

  constructor(app: App, private readonly onDone: () => void) {
    super(app);
    this.plan = buildDailySetupPlan(app);
  }

  onOpen(): void {
    const { contentEl, plan } = this;
    contentEl.addClass("otc-daily-setup");

    this.setTitle(t("dailySetup.title"));
    contentEl.createEl("p", {
      cls: "otc-daily-setup-lead",
      text: t("dailySetup.lead", {
        language: plan.language,
        localeName: this.localeName(),
      }),
    });

    this.renderSteps(plan.steps);
    this.renderBlockers();
    this.renderSafetyNote();
    this.renderButtons();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private localeName(): string {
    const KEYS = {
      "zh-Hant": "dailySetup.localeZhHant",
      "zh-Hans": "dailySetup.localeZhHans",
      en: "dailySetup.localeEn",
    } as const;
    return t(KEYS[this.plan.locale]);
  }

  private renderSteps(steps: SetupStep[]): void {
    const section = this.contentEl.createDiv({ cls: "otc-daily-setup-section" });
    section.createDiv({
      cls: "otc-daily-setup-heading",
      text: t("dailySetup.stepsHeading"),
    });
    const list = section.createEl("ul", { cls: "otc-daily-setup-list" });
    steps.forEach((step) => {
      const todo = step.status === "todo";
      const item = list.createEl("li", {
        cls: todo ? "otc-daily-setup-item" : "otc-daily-setup-item is-satisfied",
      });
      setIcon(
        item.createSpan({ cls: "otc-daily-setup-mark" }),
        todo ? "check" : "minus"
      );
      item.createSpan({ text: todo ? step.action : step.satisfied });
    });
  }

  private renderBlockers(): void {
    const { blockers } = this.plan;
    if (!blockers.length) return;
    const section = this.contentEl.createDiv({
      cls: "otc-daily-setup-section otc-daily-setup-blockers",
    });
    section.createDiv({
      cls: "otc-daily-setup-heading",
      text: t("dailySetup.blockersHeading"),
    });
    const list = section.createEl("ul", { cls: "otc-daily-setup-list" });
    blockers.forEach((blocker) => {
      const item = list.createEl("li", { cls: "otc-daily-setup-item" });
      setIcon(item.createSpan({ cls: "otc-daily-setup-mark" }), "alert-triangle");
      const body = item.createDiv();
      body.createDiv({
        cls: "otc-daily-setup-blocker-title",
        text: blocker.title,
      });
      body.createDiv({
        cls: "otc-daily-setup-blocker-detail",
        text: blocker.detail,
      });
    });
  }

  private renderSafetyNote(): void {
    this.contentEl.createEl("p", {
      cls: "otc-daily-setup-lead",
      text: t("dailySetup.safetyNote"),
    });
  }

  private renderButtons(): void {
    this.contentEl.createDiv("modal-button-container", (buttonsEl) => {
      buttonsEl
        .createEl("button", { text: t("common.cancel") })
        .addEventListener("click", () => this.close());

      const runEl = buttonsEl.createEl("button", {
        cls: "mod-cta",
        text: t("dailySetup.start"),
      });
      runEl.addEventListener("click", () => {
        void this.run(runEl);
      });
    });
  }

  private async run(runEl: HTMLButtonElement): Promise<void> {
    // Guard against a double submit: the whole thing is async, and a second
    // press would have two runs racing to write the same settings
    runEl.disabled = true;
    try {
      const executed = await runDailySetup(this.app, this.plan);
      new Notice(
        executed.length
          ? t("dailySetup.doneWithSteps", { count: executed.length })
          : t("dailySetup.doneNoChange")
      );
      this.close();
      this.onDone();
      // With the settings window still covering the screen, the note that was
      // just opened is not visible to the user at all
      closePluginSettings(this.app);
    } catch (error) {
      runEl.disabled = false;
      const message =
        error instanceof DailySetupError
          ? t("dailySetup.stoppedAt", { message: error.message })
          : String(error);
      new Notice(t("dailySetup.failedNotice", { message }), 10000);
      this.contentEl
        .createDiv({ cls: "otc-daily-setup-error" })
        .setText(t("dailySetup.failedInline", { message }));
    }
  }
}
