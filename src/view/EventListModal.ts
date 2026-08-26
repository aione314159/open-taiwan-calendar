import { App, Modal, setIcon, setTooltip } from "obsidian";
import { shortDate } from "../event/dateMath";
import { formatReminderSummary } from "../event/offsets";
import { readEvents } from "../event/store";
import type { CalendarEvent } from "../event/types";
import { t } from "../i18n";
import { moment } from "../util/moment";

/**
 * Where an entry sits relative to today.
 *
 * Three buckets rather than two, because "running right now" is the state a
 * list like this exists to surface: a nine-day trip on its fourth day is
 * neither upcoming nor over, and burying it under next month's entries would
 * hide the one thing the user opened the list to check.
 */
type Phase = "current" | "upcoming" | "past";

const phaseOf = (event: CalendarEvent, today: string): Phase => {
  if (event.end < today) return "past";
  if (event.start > today) return "upcoming";
  return "current";
};

const PHASE_ORDER: Record<Phase, number> = {
  current: 0,
  upcoming: 1,
  past: 2,
};

type TabKey = "reminders" | "events";

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

  constructor(
    app: App,
    private readonly onEdit: (event: CalendarEvent) => void,
    private readonly onDelete: (event: CalendarEvent) => void,
    private readonly onAdd: () => void
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(t("eventList.title"));
    this.modalEl.addClass("otc-event-list-modal");

    const tabs = this.contentEl.createDiv({ cls: "otc-event-tabs" });
    const buttons: Array<[TabKey, string]> = [
      ["reminders", t("eventList.tabReminders")],
      ["events", t("eventList.tabEvents")],
    ];
    const rendered = buttons.map(([key, label]) => {
      const button = tabs.createEl("button", {
        cls: "otc-event-tab",
        text: label,
      });
      button.addEventListener("click", () => {
        this.tab = key;
        rendered.forEach(([b, k]) => b.toggleClass("is-active", k === this.tab));
        this.renderList();
      });
      return [button, key] as const;
    });
    rendered.forEach(([b, k]) => b.toggleClass("is-active", k === this.tab));

    this.listEl = this.contentEl.createDiv({ cls: "otc-event-list" });
    this.renderList();

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

  /** Rebuilt from scratch on every change; the list is a few dozen rows at most. */
  private renderList(): void {
    const el = this.listEl;
    if (!el) return;
    el.empty();

    const today = moment().format("YYYY-MM-DD");
    const rows = readEvents()
      .filter((e) =>
        this.tab === "reminders" ? e.reminder !== null : e.reminder === null
      )
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
      el.createDiv({ cls: "otc-event-list-empty", text: t("eventList.empty") });
      return;
    }

    for (const { event, phase } of rows) {
      const row = el.createDiv({ cls: `otc-event-row is-${phase}` });
      row.createDiv({ cls: "otc-event-row-dot" }).style.setProperty(
        "--otc-event-color",
        event.color
      );

      const text = row.createDiv({ cls: "otc-event-row-text" });
      const head = text.createDiv({ cls: "otc-event-row-head" });
      head.createSpan({ cls: "otc-event-row-title", text: event.title });
      if (phase === "current") {
        head.createSpan({
          cls: "otc-event-row-badge",
          text: t("eventList.badgeNow"),
        });
      }
      text.createDiv({
        cls: "otc-event-row-meta",
        text: `${this.range(event)} · ${formatReminderSummary(event.reminder)}`,
      });

      const actions = row.createDiv({ cls: "otc-event-row-actions" });
      for (const [icon, label, run] of [
        ["pencil", t("settings.eventEditAction"), () => this.onEdit(event)],
        ["trash-2", t("settings.eventDeleteAction"), () => this.onDelete(event)],
      ] as Array<[string, string, () => void]>) {
        const button = actions.createEl("button", { cls: "clickable-icon" });
        setIcon(button, icon);
        setTooltip(button, label);
        button.addEventListener("click", () => {
          this.close();
          run();
        });
      }
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
    this.contentEl.empty();
  }
}
