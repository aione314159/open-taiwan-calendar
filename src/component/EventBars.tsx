import React, { useEffect, useRef } from "react";
import classNames from "classnames";
import { setTooltip } from "obsidian";
import { shortDate } from "../event/dateMath";
import type { CalendarEvent } from "../event/types";
import { t } from "../i18n";

/**
 * How many event dots fit in a date cell beside the note dot.
 *
 * A day cell is 42px square and already carries the date, the lunar label and
 * sometimes a badge. Four 4px dots and a note dot, with gaps, is what the
 * bottom edge holds without the row reaching the cell's sides.
 *
 * Beyond that the last slot becomes a muted "there is more" dot. Dropping the
 * extras with no sign of it would be the calendar quietly lying about the day.
 */
const MAX_DOTS = 4;

/**
 * The marks a day cell draws for the events covering it.
 *
 * Every entry is a dot, single-day and multi-day alike, laid out in one row
 * beside the "this day has a note" dot. An earlier version drew a multi-day
 * event as a continuous band across the row, because a band is the one shape
 * that can show an entry carrying on into the next cell — but two dots
 * positioned independently overlapped, and a band beneath the lunar line read
 * as a stray underline. One row that owns every mark is what keeps them in
 * order and apart, and it is where any future status dot belongs too.
 *
 * The cost is real and worth naming: nine days of one trip are nine identical
 * dots with nothing to say they are the same entry. The tooltip carries the
 * date range, and the settings list and the daily-note block both spell it out.
 *
 * The colour arrives as a CSS custom property rather than as a `background`.
 * The value has already been forced to `#rrggbb` by sanitizeEvents, and keeping
 * it a property means styles.css stays in charge of how a dot is drawn — size,
 * radius, opacity — while this component only says which hue.
 *
 * The titles live in the tooltip. Obsidian's native `setTooltip` is used rather
 * than `title` for the same reason CellLabel gives: the native one follows the
 * theme, and `title` is an operating-system box that is slow and does not.
 */
const EventBars: React.FC<{
  events: CalendarEvent[];
  /**
   * Whether the day already has a periodic note.
   *
   * Drawn here rather than left to the `.otc-cell.has-note::after` pseudo
   * element that every other cell type uses, so that it shares this row instead
   * of being positioned into the middle of it.
   */
  hasNote: boolean;
}> = ({ events, hasNote }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    setTooltip(
      ref.current,
      events
        .map((event) =>
          event.start === event.end
            ? event.title
            : `${event.title}（${t("event.dateRange", {
                start: shortDate(event.start),
                end: shortDate(event.end),
              })}）`
        )
        .join("\n")
    );
  }, [events]);

  if (events.length === 0 && !hasNote) return null;

  const shown = events.slice(0, MAX_DOTS);

  return (
    <div
      ref={ref}
      className={classNames("otc-event-marks", {
        "is-truncated": events.length > shown.length,
      })}
    >
      {/* The note dot leads, because it is about the day itself rather than
          about anything on it, and a fixed position keeps the row from
          reshuffling as events come and go */}
      {hasNote && <span className="otc-event-dot is-note" />}
      {shown.map((event) => (
        <span
          key={event.id}
          className="otc-event-dot"
          style={{ "--otc-event-color": event.color } as React.CSSProperties}
        />
      ))}
    </div>
  );
};

export default EventBars;
