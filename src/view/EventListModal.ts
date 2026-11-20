import { App, Modal, setIcon, setTooltip } from "obsidian";
import { shortDate } from "../event/dateMath";
import { formatReminderSummary } from "../event/offsets";
import { PHASE_ORDER, phaseOf } from "../event/phase";
import { eventsStore, problemsStore, readEvents } from "../event/store";
import { inlineRemindersStore } from "../event/inlineReminders";
import { duplicateKey, findDuplicates } from "../event/duplicates";
import { convertInline } from "../event/inlineConvert";
import { patchSettings } from "../state/settings";
import { setDisplayMonth } from "../state/view";
import { selectDate } from "../state/selection";
import { readNotes } from "../state/notes";
import { openOrCreateNote } from "../note/noteOps";
import { NoteType } from "../enum";
import { settingsStore } from "../state/settings";
import type { EntryProblemReason } from "../event/sanitize";
import type { CalendarEvent } from "../event/types";
import { t } from "../i18n";
import type { TranslationKey } from "../i18n";
import { moment } from "../util/moment";

type TabKey = "reminders" | "events" | "inline";

const PROBLEM_LABELS: Record<EntryProblemReason, TranslationKey> = {
  notObject: "problem.notObject",
  title: "problem.title",
  start: "problem.start",
  colorDefaulted: "problem.colorDefaulted",
};

/**
 * Everything the user has entered, in one place.
 *
 * The calendar answers "what is on this day"; this answers "what have I got".
 * They are different questions — the second one is the reason a dot on a grid
 * is not enough, and it is what a list can do that a month view cannot: show
 * the entries that have not happened yet without knowing which month to look in.
 *
 * Split into two tabs because a reminder and a marker are used differently: one
 * is going to interrupt you, the other is context. Ordering is by phase, so the
 * running and the upcoming stay at the top and everything finished sinks below
 * them, greyed — visible, because "did I already have that trip" is a real
 * question, but never in the way.
 */
export class EventListModal extends Modal {
  private tab: TabKey = "reminders";
  private listEl: HTMLElement | null = null;
  private query = "";
  private showPast = false;
  private tabButtons: Array<[HTMLButtonElement, TabKey]> = [];
  private problemsEl: HTMLElement | null = null;
  private unwatchProblems: (() => void) | null = null;
  private unwatchInline: (() => void) | null = null;
  private unwatch: (() => void) | null = null;

  constructor(
    app: App,
    private readonly onEdit: (event: CalendarEvent) => void,
    private readonly onDelete: (event: CalendarEvent) => void,
    private readonly onAdd: () => void,
    private readonly onToggleDone: (event: CalendarEvent) => Promise<void>
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(t("eventList.title"));
    this.modalEl.addClass("otc-event-list-modal");

    // Entries the plugin could not use as written. Above the tabs, because they
    // belong to neither tab: they are the ones missing from both
    this.problemsEl = this.contentEl.createDiv({ cls: "otc-entry-problems" });
    this.renderProblems();
    this.unwatchProblems = problemsStore.watch(() => this.renderProblems());

    const search = this.contentEl.createEl("input", {
      cls: "otc-event-search",
      type: "search",
      attr: { placeholder: t("eventList.search"), "aria-label": t("eventList.search") },
    });
    search.addEventListener("input", () => {
      this.query = search.value.trim().toLowerCase();
      this.renderList();
    });

    const tabs = this.contentEl.createDiv({ cls: "otc-event-tabs", attr: { role: "tablist" } });
    const buttons: Array<[TabKey, string]> = [
      ["reminders", t("eventList.tabReminders")],
      ["events", t("eventList.tabEvents")],
      // Only while the setting is on; otherwise there is nothing to list
      ...(settingsStore.read().appearance.inlineReminders
        ? ([["inline", t("eventList.tabInline")]] as Array<[TabKey, string]>)
        : []),
    ];
    const select = (key: TabKey, focus = false) => {
      this.tab = key;
      this.tabButtons.forEach(([b, k]) => {
        const active = k === key;
        b.toggleClass("is-active", active);
        b.setAttr("aria-selected", String(active));
        b.tabIndex = active ? 0 : -1;
        if (active && focus) b.focus();
      });
      this.renderList();
    };
    this.tabButtons = buttons.map(([key, label]) => {
      const button = tabs.createEl("button", {
        cls: "otc-event-tab",
        attr: { role: "tab" },
      });
      button.dataset.label = label;
      button.addEventListener("click", () => select(key));
      // Left and right move between tabs, the way a tab list is used from the keyboard
      button.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        event.preventDefault();
        const keys = this.tabButtons.map(([, k]) => k);
        const at = keys.indexOf(this.tab);
        const next = keys[(at + (event.key === "ArrowRight" ? 1 : keys.length - 1)) % keys.length];
        select(next, true);
      });
      return [button, key] as [HTMLButtonElement, TabKey];
    });
    this.tabButtons.forEach(([b, k]) => {
      b.toggleClass("is-active", k === this.tab);
      b.setAttr("aria-selected", String(k === this.tab));
      b.tabIndex = k === this.tab ? 0 : -1;
    });

    this.listEl = this.contentEl.createDiv({ cls: "otc-event-list" });
    this.renderList();
    // A write lands in the store only after Obsidian re-parses the note, a
    // moment after the write returns, so the list follows the store rather
    // than re-reading right after its own action
    this.unwatch = eventsStore.watch(() => this.renderList());
    this.unwatchInline = inlineRemindersStore.watch(() => this.renderList());

    const footer = this.contentEl.createDiv({ cls: "otc-event-list-footer" });
    const add = footer.createEl("button", {
      cls: "mod-cta",
      text: t("settings.eventListAdd"),
    });
    add.addEventListener("click", () => {
      this.close();
      this.onAdd();
    });
  }

  private renderProblems(): void {
    const el = this.problemsEl;
    if (!el) return;
    el.empty();
    const problems = problemsStore.read();
    if (problems.length === 0) return;
    const details = el.createEl("details");
    details.createEl("summary", {
      text: t("eventList.problemsSummary", { count: problems.length }),
    });
    for (const problem of problems) {
      const row = details.createDiv({ cls: "otc-entry-problem" });
      const link = row.createEl("a", {
        text: t("eventList.problemWhere", {
          path: problem.path,
          index: problem.index + 1,
        }),
      });
      link.addEventListener("click", () => {
        this.close();
        void this.app.workspace.openLinkText(problem.path, "", false);
      });
      row.createSpan({ text: ` ${t(PROBLEM_LABELS[problem.reason])}` });
    }
  }

  /** Rebuilt from scratch on every change; the list is a few dozen rows at most. */
  private renderList(): void {
    const el = this.listEl;
    if (!el) return;
    // Rebuilding empties the list, which would throw the scroll position away
    const scroller = this.contentEl;
    const scrollTop = scroller.scrollTop;
    window.requestAnimationFrame(() => (scroller.scrollTop = scrollTop));
    el.empty();

    const today = moment().format("YYYY-MM-DD");
    // Each tab is labelled with how many of its entries are not over yet
    const openCount = (key: TabKey): number =>
      key === "inline"
        ? inlineRemindersStore.read().length
        : readEvents().filter(
            (e) =>
              (key === "reminders" ? e.reminder !== null : e.reminder === null) &&
              phaseOf(e, today) !== "past"
          ).length;
    for (const [button, key] of this.tabButtons) {
      button.setText(`${button.dataset.label ?? ""} (${openCount(key)})`);
    }

    if (this.tab === "inline") {
      this.renderInline(el);
      return;
    }

    const all = readEvents().filter((e) =>
      this.tab === "reminders" ? e.reminder !== null : e.reminder === null
    );
    const rows = all
      .filter((e) => !this.query || e.title.toLowerCase().includes(this.query))
      .map((event) => ({ event, phase: phaseOf(event, today) }))
      .sort(
        (a, b) =>
          PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase] ||
          // Inside "past", the most recent first: what just finished is more
          // interesting than what finished last year
          (a.phase === "past"
            ? b.event.start.localeCompare(a.event.start)
            : a.event.start.localeCompare(b.event.start))
      );

    if (rows.length === 0) {
      el.createDiv({
        cls: "otc-event-list-empty",
        text: this.query && all.length > 0 ? t("eventList.noMatch", { query: this.query }) : t("eventList.empty"),
      });
      return;
    }

    // Finished entries fold into one line unless searching or opened
    const pastCount = rows.filter((r) => r.phase === "past").length;
    const folded = !this.query && !this.showPast;
    let pastToggleDrawn = false;
    for (const { event, phase } of rows) {
      if (phase === "past" && !pastToggleDrawn && !this.query) {
        pastToggleDrawn = true;
        const toggle = el.createEl("button", {
          cls: "otc-event-past-toggle",
          text: t(folded ? "eventList.pastFolded" : "eventList.pastOpen", { count: pastCount }),
          attr: { "aria-expanded": String(!folded) },
        });
        toggle.addEventListener("click", () => {
          this.showPast = !this.showPast;
          this.renderList();
        });
      }
      if (phase === "past" && folded) continue;
      const row = el.createDiv({ cls: `otc-event-row is-${phase}` });
      row.toggleClass("is-done", event.done);
      // Over and never marked handled: the one row in this list that may still
      // need doing
      const unhandled = event.reminder !== null && !event.done && event.end < today;
      row.toggleClass("is-unhandled", unhandled);
      const rowDot = row.createDiv({ cls: "otc-event-row-dot" });
      rowDot.style.setProperty("--otc-event-color", event.color);
      rowDot.toggleClass("is-event", event.reminder === null);

      const text = row.createDiv({ cls: "otc-event-row-text" });
      // The text is the way to the day: close the list, page the calendar to
      // the start date and open that day's note (Ctrl/Cmd: in a split)
      text.setAttr("role", "button");
      text.tabIndex = 0;
      const jump = (split: boolean) => {
        this.close();
        setDisplayMonth(event.start);
        selectDate(event.start);
        void openOrCreateNote(
          moment(event.start, "YYYY-MM-DD"),
          NoteType.DAILY,
          readNotes(NoteType.DAILY),
          this.app,
          split ? "split" : false
        );
      };
      text.addEventListener("click", (e) => jump(e.ctrlKey || e.metaKey));
      text.addEventListener("keydown", (e) => {
        if (e.key === "Enter") jump(e.ctrlKey || e.metaKey);
      });
      const head = text.createDiv({ cls: "otc-event-row-head" });
      head.createSpan({ cls: "otc-event-row-title", text: event.title });
      if (phase === "current") {
        head.createSpan({
          cls: "otc-event-row-badge",
          text: t("eventList.badgeNow"),
        });
      }
      if (unhandled) {
        head.createSpan({
          cls: "otc-event-row-badge is-unhandled",
          text: t("eventList.badgeUnhandled"),
        });
      }
      const settings = settingsStore.read();
      const duplicates = settings.appearance.inlineReminders
        ? findDuplicates(event, inlineRemindersStore.read(), settings.ignoredDuplicates)
        : [];
      if (duplicates.length > 0) {
        const badge = head.createSpan({
          cls: "otc-event-row-badge is-duplicate",
          text: t("duplicate.badge"),
        });
        setTooltip(
          badge,
          t("duplicate.explain", {
            items: duplicates.map((d) => `${d.text}（${d.path}）`).join("\n"),
          })
        );
      }
      text.createDiv({
        cls: "otc-event-row-meta",
        text: `${this.range(event)} · ${formatReminderSummary(event.reminder)}`,
      });

      const actions = row.createDiv({ cls: "otc-event-row-actions" });
      // Page the calendar only, opening nothing
      const show = actions.createEl("button", { cls: "clickable-icon" });
      setIcon(show, "calendar-search");
      setTooltip(show, t("eventList.showOnCalendar"));
      show.setAttr("aria-label", t("eventList.showOnCalendar"));
      show.addEventListener("click", () => {
        this.close();
        setDisplayMonth(event.start);
        selectDate(event.start);
      });
      if (duplicates.length > 0) {
        const mute = actions.createEl("button", { cls: "clickable-icon" });
        setIcon(mute, "bell-off");
        setTooltip(mute, t("duplicate.ignore"));
        mute.addEventListener("click", () => {
          patchSettings({
            ignoredDuplicates: [
              ...settings.ignoredDuplicates,
              ...duplicates.map((d) => duplicateKey(event, d)),
            ],
          });
          this.app.workspace.trigger("open-taiwan-calendar:save-settings");
          this.renderList();
        });
      }
      // Only a reminder has something to be done; a plain marker does not
      if (event.reminder !== null) {
        const toggle = actions.createEl("button", { cls: "clickable-icon" });
        setIcon(toggle, event.done ? "rotate-ccw" : "check-circle");
        setTooltip(toggle, t(event.done ? "eventList.markUndone" : "eventList.markDone"));
        toggle.addEventListener("click", () => {
          toggle.disabled = true;
          // Stays open: the store watch moves the row once the note is re-read
          void this.onToggleDone(event);
        });
      }
      for (const [icon, label, run] of [
        ["pencil", t("settings.eventEditAction"), () => this.onEdit(event)],
        ["trash-2", t("settings.eventDeleteAction"), () => this.onDelete(event)],
      ] as Array<[string, string, () => void]>) {
        const button = actions.createEl("button", { cls: "clickable-icon" });
        setIcon(button, icon);
        setTooltip(button, label);
        // The list stays open: the edit dialog opens on top of it, and a
        // delete shows up through the store watch, tab and scroll kept
        button.addEventListener("click", () => run());
      }
    }
  }

  /** The Reminder plugin's inline marks: read-only rows that open the source line. */
  private renderInline(el: HTMLElement): void {
    const items = inlineRemindersStore.read();
    if (items.length === 0) {
      el.createDiv({ cls: "otc-event-list-empty", text: t("eventList.empty") });
      return;
    }
    for (const item of items) {
      const row = el.createDiv({ cls: "otc-event-row is-inline" });
      row.createDiv({ cls: "otc-event-row-dot otc-event-dot is-inline" });
      const text = row.createDiv({ cls: "otc-event-row-text" });
      const title = text.createEl("a", { cls: "otc-event-row-title", text: item.text });
      text.createDiv({
        cls: "otc-event-row-meta",
        text: t("eventList.inlineMeta", {
          date: shortDate(item.date),
          time: item.time ?? "",
          note: item.path.replace(/\.md$/, ""),
        }),
      });
      title.addEventListener("click", () => {
        this.close();
        void this.app.workspace.openLinkText(item.path, "", false, {
          eState: { line: item.line },
        });
      });
      const actions = row.createDiv({ cls: "otc-event-row-actions" });
      const convert = actions.createEl("button", { cls: "clickable-icon" });
      setIcon(convert, "calendar-check");
      setTooltip(convert, t("inline.convert"));
      convert.addEventListener("click", () => {
        this.close();
        convertInline(this.app, item);
      });
    }
  }

  /** "10/24" for a single day, "10/24 – 11/01" for a range. */
  private range(event: CalendarEvent): string {
    return event.start === event.end
      ? shortDate(event.start)
      : t("event.dateRange", {
          start: shortDate(event.start),
          end: shortDate(event.end),
        });
  }

  onClose(): void {
    this.unwatch?.();
    this.unwatch = null;
    this.unwatchProblems?.();
    this.unwatchProblems = null;
    this.unwatchInline?.();
    this.unwatchInline = null;
    this.contentEl.empty();
  }
}
