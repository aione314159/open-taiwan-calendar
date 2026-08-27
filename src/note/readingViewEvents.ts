import { MarkdownView, Plugin, TFile } from "obsidian";
import { shortDate } from "../event/dateMath";
import { formatReminderSummary } from "../event/offsets";
import { phaseOf } from "../event/phase";
import { sanitizeEvent, sortEvents } from "../event/sanitize";
import { FRONTMATTER_KEY } from "../event/types";
import type { CalendarEvent } from "../event/types";
import { t } from "../i18n";
import { settingsStore } from "../state/settings";
import { moment } from "../util/moment";

/**
 * What the frontmatter says, rendered the way the rest of the plugin says it.
 *
 * The entries live in the `---` block because that is what makes them sync,
 * version and survive an uninstall (see the comment on FRONTMATTER_KEY). The
 * cost is that reading view shows them as either nothing at all or a raw YAML
 * table, depending on one Obsidian setting, and neither answers "what is on
 * today". So the same row the event list draws is drawn again at the top of the
 * note, from the same helpers, and stays read-only: the frontmatter and the
 * quick-add dialog are the two places an entry is edited, and a third one would
 * have to reconcile the copies a multi-day entry keeps across several notes.
 *
 * Driven by workspace events rather than by registerMarkdownPostProcessor. A
 * post processor renders *markdown content*, and this block is not content: it
 * runs once per section, it hands over the frontmatter's own section first
 * (which Obsidian then hides, taking anything inside it along), and it does not
 * run again when a note is reopened from a cache. Both were observed live.
 * Reacting to the events instead means one rule — "reading view, this file,
 * these entries" — evaluated whenever any of the three can have changed.
 */

/** The container class, which doubles as the "already rendered here" marker. */
const BLOCK_CLASS = "otc-note-events";

/**
 * Where the block is attached: inside reading view's scroll container, ahead of
 * .markdown-preview-sizer.
 *
 * Not inside the sizer. Its children are the renderer's own, rebuilt as the
 * user scrolls and replaced wholesale on a re-render, so a foreign node there
 * lives until the next render pass and no longer. One level up is untouched by
 * that machinery and still scrolls with the note, which is where a header
 * belongs.
 */
const SCROLLER_SELECTOR = ".markdown-preview-view";

/** "10/24" for a single day, "10/24 – 11/01" for a range. */
const rangeOf = (event: CalendarEvent): string =>
  event.start === event.end
    ? shortDate(event.start)
    : t("event.dateRange", {
        start: shortDate(event.start),
        end: shortDate(event.end),
      });

/** The entries of one note, cleaned and ordered, or an empty list. */
const eventsOf = (frontmatter: unknown): CalendarEvent[] => {
  const raw = (frontmatter as Record<string, unknown> | null | undefined)?.[
    FRONTMATTER_KEY
  ];
  if (!Array.isArray(raw)) return [];
  // A fresh set per note: an id repeated inside one note is a copy-paste
  // accident and gets a new id, while the same id in another note is the other
  // half of a multi-day entry and must keep it
  const seenIds = new Set<string>();
  const events = raw
    .map((entry) => sanitizeEvent(entry, seenIds))
    .filter((event): event is CalendarEvent => event !== null);
  return sortEvents(events);
};

const renderBlock = (events: CalendarEvent[]): HTMLElement => {
  const block = createDiv({ cls: BLOCK_CLASS });
  block.createDiv({
    cls: "otc-note-events-heading",
    text: t("noteEvents.heading"),
  });

  const today = moment().format("YYYY-MM-DD");
  for (const event of events) {
    const phase = phaseOf(event, today);
    // Same classes as EventListModal's rows, minus the action buttons: the two
    // are the same object seen in two places, and they should not drift apart
    const row = block.createDiv({ cls: `otc-event-row is-${phase}` });
    row
      .createDiv({ cls: "otc-event-row-dot" })
      .style.setProperty("--otc-event-color", event.color);

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
      text: `${rangeOf(event)} · ${formatReminderSummary(event.reminder)}`,
    });
  }
  return block;
};

/** Bring one markdown view in line with what its file and the settings say. */
const syncView = (view: MarkdownView): void => {
  const scroller = view.containerEl.querySelector(SCROLLER_SELECTOR);
  if (!scroller) return;

  // Rebuilt rather than patched. It is a handful of nodes, the inputs change
  // for reasons this code does not track one by one (an edited title, a colour,
  // the day rolling over), and a stale row is worse than a rebuilt one.
  scroller.querySelector(`.${BLOCK_CLASS}`)?.remove();

  if (!settingsStore.read().appearance.readingViewEvents) return;
  if (view.getMode() !== "preview") return;

  const file: TFile | null = view.file;
  if (!file) return;
  const frontmatter: unknown =
    view.app.metadataCache.getFileCache(file)?.frontmatter;
  const events = eventsOf(frontmatter);
  if (events.length === 0) return;

  scroller.prepend(renderBlock(events));
};

/**
 * Reading view only.
 *
 * Live Preview renders frontmatter through Obsidian's own property widget, and
 * putting anything of ours inside it would mean a CodeMirror extension or a DOM
 * observer against markup that is not part of the public API. Reading view is
 * where a note is read, and it is reachable through the view's own container.
 */
export const registerReadingViewEvents = (plugin: Plugin): void => {
  const syncAll = (): void => {
    for (const leaf of plugin.app.workspace.getLeavesOfType("markdown")) {
      if (leaf.view instanceof MarkdownView) syncView(leaf.view);
    }
  };

  // Every path that can change the answer: which file a leaf shows, whether it
  // is in reading mode, what the frontmatter holds, and whether the user still
  // wants the block. Sweeping every markdown leaf rather than tracking one is
  // deliberate — a split pane can show the same note twice.
  plugin.registerEvent(plugin.app.workspace.on("layout-change", syncAll));
  plugin.registerEvent(plugin.app.workspace.on("active-leaf-change", syncAll));
  plugin.registerEvent(plugin.app.workspace.on("file-open", syncAll));
  plugin.registerEvent(plugin.app.metadataCache.on("changed", syncAll));
  plugin.register(settingsStore.watch(syncAll));

  // The layout is not ready during onload, and a view opened before this has
  // no event coming to announce it
  plugin.app.workspace.onLayoutReady(syncAll);

  // Leave no orphan behind: disabling the plugin must take the block with it.
  plugin.register(() => {
    for (const leaf of plugin.app.workspace.getLeavesOfType("markdown")) {
      if (!(leaf.view instanceof MarkdownView)) continue;
      leaf.view.containerEl
        .querySelector(`${SCROLLER_SELECTOR} > .${BLOCK_CLASS}`)
        ?.remove();
    }
  });
};
