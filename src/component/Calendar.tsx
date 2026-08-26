import React, { useCallback, useMemo, useState } from "react";
import classNames from "classnames";
import type { Moment } from "moment";
import { moment } from "obsidian";
import "moment/locale/zh-tw";
import type { PaneType } from "obsidian";
import { formatLabel, formatDate, formatMonth } from "../note/format";
import { noteExists } from "../note/noteOps";
import { granularityDisabledHint } from "../note/periodicNotes";
import { useNotes } from "../state/notes";
import type { NoteIndex } from "../state/notes";
import { LayoutMode, useSetting } from "../state/settings";
import { NoteType } from "../enum";
import { getLocale, t } from "../i18n";
import type { TranslationKey } from "../i18n";
import CellLabel from "./CellLabel";
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
    notes: NoteIndex
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
}

const Calendar: React.FC<CalendarProps> = ({
  openOrCreateNote,
  onContextMenu,
  onHoverPreview,
  isNoteTypeEnabled,
  onOpenSettings,
}) => {
  const notes = useNotes((state) => state);

  // Settings are subscribed rather than read once. A plain read would leave
  // React unaware that anything changed, and the floating panel — which does
  // not listen for the settings-updated workspace event — would go on showing
  // the old layout until it was closed and reopened.
  const layout = useSetting((state) => state.appearance.layout);
  const pastTimeTransparent = useSetting(
    (state) => state.appearance.pastTimeTransparent
  );
  const holidayOverrides = useSetting((state) => state.holidayOverrides);

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
        onMouseOver: (event) =>
          onHoverPreview(
            event.nativeEvent,
            event.currentTarget,
            date,
            type,
            index
          ),
      };
    },
    [notes, isNoteTypeEnabled, openOrCreateNote, onContextMenu, onHoverPreview]
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
    const isToday = date.isSame(moment(), "day");
    const { disabled, ...handlers } = cellHandlers(date, NoteType.DAILY);
    return (
      <div
        key={date.format("YYYY-MM-DD")}
        className={classNames("otc-cell", "otc-day", {
          "is-today": isToday,
          "is-holiday": isHoliday && !isWork,
          "is-workday": isWork,
          "is-weekend": !isWork && (date.day() === 0 || date.day() === 6),
          "is-outside": !date.isSame(anchor, "month"),
          // Fading is purely cosmetic; a past day's note stays openable
          "is-past": pastTimeTransparent && date.isBefore(moment(), "day"),
          "is-disabled": disabled,
          "has-note": noteExists(date, NoteType.DAILY, notes[NoteType.DAILY]),
        })}
        {...handlers}
      >
        <span className="otc-day-number">{date.date()}</span>
        <CellLabel className="otc-lunar" text={dateStr} />
        {isToday && <span className="otc-badge">{t("calendar.badgeToday")}</span>}
        {isHoliday && !isWork && (
          <span className="otc-badge">{t("calendar.badgeHoliday")}</span>
        )}
        {isWork && <span className="otc-badge">{t("calendar.badgeWorkday")}</span>}
      </div>
    );
  };

  const renderMonth = (date: Moment) => {
    const { disabled, ...handlers } = cellHandlers(date, NoteType.MONTHLY);
    return (
      <div
        key={date.format("YYYY-MM")}
        className={classNames("otc-cell", "otc-month", {
          "is-current": date.isSame(moment(), "month"),
          "is-disabled": disabled,
          "has-note": noteExists(
            date,
            NoteType.MONTHLY,
            notes[NoteType.MONTHLY]
          ),
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
      className={classNames("otc-calendar", {
        "otc-compact": layout === LayoutMode.Small,
      })}
    >
      <div className="otc-toolbar">
        <IconButton
          icon="settings"
          label={t("calendar.settings")}
          className="otc-settings-button"
          onClick={onOpenSettings}
        />
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
