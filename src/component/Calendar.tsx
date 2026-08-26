import React, { useCallback, useEffect, useMemo, useState } from "react";
import classNames from "classnames";
import { moment } from "src/util/moment";
import type { Moment } from "src/util/moment";
import "moment/locale/zh-tw";
import type { PaneType } from "obsidian";
import { eventsOnDate, hasEventInMonth, useEvents } from "../event/store";
import { formatLabel, formatDate, formatMonth } from "../note/format";
import { noteExists } from "../note/noteOps";
import { granularityDisabledHint } from "../note/periodicNotes";
import { useNotes } from "../state/notes";
import type { NoteIndex } from "../state/notes";
import { DotSize, LayoutMode, useSetting } from "../state/settings";
import { NoteType } from "../enum";
import { getLocale, t } from "../i18n";
import type { TranslationKey } from "../i18n";
import CellLabel from "./CellLabel";
import EventBars from "./EventBars";
import IconButton from "./IconButton";

/**
 * Follow the plugin's locale and start the week on Monday.
 *
 * This mutates the moment instance Obsidian shares out, which is why the locale
 * name has to track the plugin's own: pinning it to Chinese would leave an
 * English vault with Chinese weekday names inside daily note filenames built
 * from a `dddd` token. Monday as the first day of the week is a deliberate
 * product decision, not a locale default.
 */
moment.locale(getLocale() === "zh-TW" ? "zh-tw" : "en", { week: { dow: 1 } });

/** A month grid always draws six whole weeks, so the height never jumps. */
const WEEKS_IN_GRID = 6;
const DAYS_IN_WEEK = 7;
const MONTHS_IN_YEAR = 12;
const QUARTERS_IN_YEAR = 4;

const QUARTER_KEYS: TranslationKey[] = [
  "calendar.quarterCell1",
  "calendar.quarterCell2",
  "calendar.quarterCell3",
  "calendar.quarterCell4",
];

type ViewMode = "month" | "year";

/**
 * The dot size lands as a class on the calendar root, and styles.css turns it
 * into a custom property every dot reads. Keeping the pixel values in the
 * stylesheet is what lets the compact layout shrink each step by one pixel
 * without this file knowing anything about it.
 */
const DOT_SIZE_CLASS: Record<DotSize, string> = {
  [DotSize.Small]: "is-dots-small",
  [DotSize.Medium]: "is-dots-medium",
  [DotSize.Large]: "is-dots-large",
};

/** How often the clock is checked for having crossed into a new day. */
const DAY_CHECK_INTERVAL_MS = 60_000;

/**
 * The current day, kept fresh while the panel stays open.
 *
 * A `moment()` read during render is only as recent as the last render, so a
 * calendar left open past midnight goes on badging yesterday as today until
 * something unrelated — a settings change, a new note — happens to re-render
 * it. Opening a note does not, which is exactly the case where the stale badge
 * is noticed. The interval returns the previous moment untouched whenever the
 * day has not changed, so the common tick costs a comparison and no re-render.
 */
const useToday = (): Moment => {
  const [today, setToday] = useState<Moment>(() => moment().startOf("day"));
  useEffect(() => {
    const timer = window.setInterval(() => {
      setToday((current) =>
        current.isSame(moment(), "day") ? current : moment().startOf("day")
      );
    }, DAY_CHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);
  return today;
};

export interface CalendarProps {
  openOrCreateNote: (
    date: Moment,
    type: NoteType,
    notes: NoteIndex,
    newLeaf?: PaneType | false
  ) => void;
  onContextMenu: (
    event: MouseEvent,
    date: Moment,
    type: NoteType,
    notes: NoteIndex,
    /**
     * True when Periodic Notes has this granularity switched off, so the menu
     * leaves out the items that would open or create a note. Adding an event
     * has nothing to do with Periodic Notes and stays available either way.
     */
    noteActionsDisabled?: boolean
  ) => void;
  onHoverPreview: (
    event: MouseEvent,
    targetEl: HTMLElement,
    date: Moment,
    type: NoteType,
    notes: NoteIndex
  ) => void;
  isNoteTypeEnabled: (type: NoteType) => boolean;
  onOpenSettings: () => void;
  /** Opens the quick-add dialog with the clicked day already filled in. */
  onAddEvent: (date: Moment) => void;
  /** Opens the list of every entry, split into reminders and events. */
  onShowEventList: () => void;
}

const Calendar: React.FC<CalendarProps> = ({
  openOrCreateNote,
  onContextMenu,
  onHoverPreview,
  isNoteTypeEnabled,
  onOpenSettings,
  onAddEvent,
  onShowEventList,
}) => {
  const notes = useNotes((state) => state);
  const events = useEvents((state) => state);

  // Settings are subscribed rather than read once. A plain read would leave
  // React unaware that anything changed, and the floating panel — which does
  // not listen for the settings-updated workspace event — would go on showing
  // the old layout until it was closed and reopened.
  const layout = useSetting((state) => state.appearance.layout);
  const pastTimeTransparent = useSetting(
    (state) => state.appearance.pastTimeTransparent
  );
  const hoverPreview = useSetting((state) => state.appearance.hoverPreview);
  const dotSize = useSetting((state) => state.appearance.dotSize);
  const holidayOverrides = useSetting((state) => state.holidayOverrides);

  const today = useToday();
  const [anchor, setAnchor] = useState<Moment>(() => moment());
  const [mode, setMode] = useState<ViewMode>("month");

  const shift = (direction: 1 | -1, unit: "month" | "year") =>
    setAnchor((current) => current.clone().add(direction, unit));

  /**
   * The event handlers for one granularity's cell.
   *
   * A granularity Periodic Notes has switched off must stay visible but inert:
   * no handlers at all, `aria-disabled` set, and a tooltip carrying both the
   * reason and the way out. Leaving the click handler attached turns the week
   * column into a trap — it falls back to the interface defaults and drops a
   * brand new file into the vault root.
   */
  const cellHandlers = useCallback(
    (
      date: Moment,
      type: NoteType
    ): React.HTMLAttributes<HTMLDivElement> & { disabled: boolean } => {
      const index = notes[type];
      if (!isNoteTypeEnabled(type)) {
        return {
          disabled: true,
          "aria-disabled": true,
          title: granularityDisabledHint(type),
        };
      }
      return {
        disabled: false,
        // Ctrl/Cmd click opens a split, so someone with the panel parked in a
        // corner keeps the tab they were working in
        onClick: (event) =>
          openOrCreateNote(
            date,
            type,
            index,
            event.ctrlKey || event.metaKey ? "split" : false
          ),
        onContextMenu: (event) => {
          event.preventDefault();
          onContextMenu(event.nativeEvent, date, type, index);
        },
        // Left off entirely rather than attached and made to return early: the
        // popup belongs to Obsidian and is triggered by the event this handler
        // fires, so not firing it is the only way to be sure none appears
        onMouseOver: hoverPreview
          ? (event: React.MouseEvent<HTMLDivElement>) =>
              onHoverPreview(
                event.nativeEvent,
                event.currentTarget,
                date,
                type,
                index
              )
          : undefined,
      };
    },
    [
      notes,
      isNoteTypeEnabled,
      openOrCreateNote,
      onContextMenu,
      onHoverPreview,
      hoverPreview,
    ]
  );

  const weekdayNames = useMemo(() => moment.weekdaysMin(true), []);

  /** Six weeks of days, starting from the Monday on or before the 1st. */
  const gridDays = useMemo(() => {
    const first = anchor.clone().startOf("month").startOf("week");
    return Array.from({ length: WEEKS_IN_GRID * DAYS_IN_WEEK }, (_, offset) =>
      first.clone().add(offset, "day")
    );
  }, [anchor]);

  const monthsOfYear = useMemo(() => {
    const january = anchor.clone().startOf("year");
    return Array.from({ length: MONTHS_IN_YEAR }, (_, offset) =>
      january.clone().add(offset, "month")
    );
  }, [anchor]);

  const renderDay = (date: Moment) => {
    const { dateStr, isWork, isHoliday } = formatDate(date, holidayOverrides);
    const isToday = date.isSame(today, "day");
    const iso = date.format("YYYY-MM-DD");
    const dayEvents = eventsOnDate(events, iso);
    const hasNote = !!noteExists(date, NoteType.DAILY, notes[NoteType.DAILY]);
    const { disabled, ...handlers } = cellHandlers(date, NoteType.DAILY);
    // A day is never both a holiday and a make-up workday, so at most two of
    // these are ever present at once
    const badges: Array<[string, string]> = [
      ...(isToday ? [["today", t("calendar.badgeToday")] as [string, string]] : []),
      ...(isHoliday && !isWork
        ? [["holiday", t("calendar.badgeHoliday")] as [string, string]]
        : []),
      ...(isWork ? [["workday", t("calendar.badgeWorkday")] as [string, string]] : []),
    ];
    return (
      <div
        key={iso}
        className={classNames("otc-cell", "otc-day", {
          "is-today": isToday,
          "is-holiday": isHoliday && !isWork,
          "is-workday": isWork,
          "is-weekend": !isWork && (date.day() === 0 || date.day() === 6),
          "is-outside": !date.isSame(anchor, "month"),
          // Fading is purely cosmetic; a past day's note stays openable
          "is-past": pastTimeTransparent && date.isBefore(today, "day"),
          "is-disabled": disabled,
          "has-note": hasNote,
          "has-event": dayEvents.length > 0,
        })}
        {...handlers}
        /* Declared after the spread so it wins: a granularity Periodic Notes
           has switched off leaves the cell inert for note actions, but adding
           an event is this plugin's own feature and must stay reachable. */
        onContextMenu={(event) => {
          event.preventDefault();
          onContextMenu(
            event.nativeEvent,
            date,
            NoteType.DAILY,
            notes[NoteType.DAILY],
            disabled
          );
        }}
      >
        <span className="otc-day-number">{date.date()}</span>
        <CellLabel className="otc-lunar" text={dateStr} />
        {/* One row rather than three absolutely positioned spans: each badge
            used to be pinned to the same corner, so a day that is both today
            and a public holiday drew one on top of the other. */}
        {badges.length > 0 && (
          <div className="otc-badges">
            {badges.map(([key, label]) => (
              <span key={key} className={classNames("otc-badge", `is-${key}`)}>
                {label}
              </span>
            ))}
          </div>
        )}
        <EventBars events={dayEvents} hasNote={hasNote} />
      </div>
    );
  };

  const renderMonth = (date: Moment) => {
    const { disabled, ...handlers } = cellHandlers(date, NoteType.MONTHLY);
    return (
      <div
        key={date.format("YYYY-MM")}
        className={classNames("otc-cell", "otc-month", {
          "is-current": date.isSame(today, "month"),
          "is-disabled": disabled,
          "has-note": noteExists(
            date,
            NoteType.MONTHLY,
            notes[NoteType.MONTHLY]
          ),
          // A dot rather than bars: a month cell has no room to draw a band,
          // and the month view is for navigating, not for reading the detail
          "has-event": hasEventInMonth(events, date.format("YYYY-MM")),
        })}
        {...handlers}
      >
        {t("calendar.monthCell", {
          month: date.format(t("calendar.monthCellFormat")),
          // A solar month straddles two lunar months; the earlier one wins
          lunar: formatMonth(date),
        })}
      </div>
    );
  };

  /** One entry per row of the grid, so the numbers line up with the weeks beside them. */
  const weekColumn = useMemo(
    () =>
      Array.from({ length: WEEKS_IN_GRID }, (_, row) => {
        const day = gridDays[row * DAYS_IN_WEEK];
        const { disabled, ...handlers } = cellHandlers(day, NoteType.WEEKLY);
        return (
          <div
            key={`${day.weekYear()}-${day.week()}`}
            className={classNames("otc-cell", "otc-side-cell", {
              "is-disabled": disabled,
              "has-note": noteExists(
                day,
                NoteType.WEEKLY,
                notes[NoteType.WEEKLY]
              ),
            })}
            {...handlers}
          >
            {day.week()}
          </div>
        );
      }),
    [gridDays, notes, cellHandlers]
  );

  const quarterColumn = useMemo(
    () =>
      Array.from({ length: QUARTERS_IN_YEAR }, (_, index) => {
        const start = anchor.clone().startOf("year").add(index, "quarter");
        const { disabled, ...handlers } = cellHandlers(start, NoteType.QUARTERLY);
        const unit = t("calendar.quarterCellUnit");
        return (
          <div
            key={index}
            className={classNames("otc-cell", "otc-side-cell", "otc-quarter", {
              "is-disabled": disabled,
              "has-note": noteExists(
                start,
                NoteType.QUARTERLY,
                notes[NoteType.QUARTERLY]
              ),
            })}
            {...handlers}
          >
            {t(QUARTER_KEYS[index])}
            {/* Locales where the label already carries the unit ("Q1") leave
                this empty, and an empty line would still claim its height */}
            {unit && <span>{unit}</span>}
          </div>
        );
      }),
    [anchor, notes, cellHandlers]
  );

  const titleParts: Array<[NoteType, string]> = [
    [NoteType.YEARLY, anchor.format(t("calendar.headerYearFormat"))],
    [NoteType.MONTHLY, anchor.format(t("calendar.headerMonthFormat"))],
    [NoteType.QUARTERLY, t("calendar.headerQuarter", { quarter: anchor.format("Q") })],
  ];

  const modeButtons: Array<[string, string, () => void, boolean]> = [
    ["today", t("calendar.modeToday"), () => setAnchor(moment()), false],
    ["month", t("calendar.modeMonth"), () => setMode("month"), mode === "month"],
    ["year", t("calendar.modeYear"), () => setMode("year"), mode === "year"],
  ];

  return (
    <div
      className={classNames("otc-calendar", DOT_SIZE_CLASS[dotSize], {
        "otc-compact": layout === LayoutMode.Small,
      })}
    >
      <div className="otc-toolbar">
        {/* Grouped so the three sit together on the left. Left loose in a
            space-between row, the middle one drifts to the centre and reads as
            unrelated to the other two. */}
        <div className="otc-toolbar-actions">
          <IconButton
            icon="settings"
            label={t("calendar.settings")}
            className="otc-settings-button"
            onClick={onOpenSettings}
          />
          <IconButton
            icon="calendar-plus"
            label={t("command.quickAddEvent")}
            className="otc-settings-button"
            // Today rather than the month being browsed: the button is a
            // shortcut for "put this somewhere", and the dialog's date fields
            // are right there for anything else. Right-clicking a cell is the
            // way to add one on a specific day.
            onClick={() => onAddEvent(moment())}
          />
          <IconButton
            icon="list-checks"
            label={t("command.showEventList")}
            className="otc-settings-button"
            onClick={onShowEventList}
          />
        </div>
        <div className="otc-modes" role="group">
          {modeButtons.map(([key, label, onPick, active]) => (
            <button
              key={key}
              type="button"
              className={classNames("otc-mode-button", { "is-active": active })}
              aria-pressed={active}
              onClick={onPick}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="otc-nav">
        <IconButton
          icon="chevrons-left"
          label={t("calendar.prevYear")}
          className="otc-nav-button"
          onClick={() => shift(-1, "year")}
        />
        <IconButton
          icon="chevron-left"
          label={t("calendar.prevMonth")}
          className="otc-nav-button"
          onClick={() => shift(-1, "month")}
        />
        <div className="otc-nav-title">
          <div className="otc-title-row">
            {titleParts.map(([type, label]) => {
              // The header pieces go through the same enablement check as the
              // cells, so a disabled granularity behaves identically here
              const { disabled, ...handlers } = cellHandlers(anchor, type);
              return (
                <span
                  key={type}
                  className={classNames("otc-title-item", {
                    "is-disabled": disabled,
                    "has-note": noteExists(anchor, type, notes[type]),
                  })}
                  {...handlers}
                >
                  {label}
                </span>
              );
            })}
          </div>
          <div className="otc-title-lunar">{formatLabel(anchor)}</div>
        </div>
        <IconButton
          icon="chevron-right"
          label={t("calendar.nextMonth")}
          className="otc-nav-button"
          onClick={() => shift(1, "month")}
        />
        <IconButton
          icon="chevrons-right"
          label={t("calendar.nextYear")}
          className="otc-nav-button"
          onClick={() => shift(1, "year")}
        />
      </div>

      <div className="otc-body">
        {mode === "month" ? (
          <div className="otc-side">
            <div className="otc-side-head">{t("calendar.weekColumnHeader")}</div>
            {weekColumn}
          </div>
        ) : (
          <div className="otc-side otc-side-quarters">{quarterColumn}</div>
        )}
        {mode === "month" ? (
          <div className="otc-grid">
            <div className="otc-weekdays">
              {weekdayNames.map((name) => (
                <div key={name} className="otc-weekday">
                  {name}
                </div>
              ))}
            </div>
            <div className="otc-days">{gridDays.map(renderDay)}</div>
          </div>
        ) : (
          <div className="otc-grid otc-grid-months">
            {monthsOfYear.map(renderMonth)}
          </div>
        )}
      </div>
    </div>
  );
};

export default Calendar;
