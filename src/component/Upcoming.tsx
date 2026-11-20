import React from "react";
import classNames from "classnames";
import { addDays, diffDays, shortDate } from "../event/dateMath";
import { useEvents } from "../event/store";
import type { CalendarEvent } from "../event/types";
import { t } from "../i18n";
import { patchSettings, useSetting } from "../state/settings";
import { useToday } from "./Calendar";

const MAX_DAYS = 90;

/** "Today", "Tomorrow", "In 11 d", or "Ongoing" for an entry that has begun. */
const distanceLabel = (event: CalendarEvent, today: string): string => {
  if (event.start < today) return t("upcoming.ongoing");
  const days = diffDays(today, event.start);
  if (days === 0) return t("reminder.dueToday");
  if (days === 1) return t("upcoming.tomorrow");
  return t("upcoming.inDays", { count: days });
};

/**
 * What is coming up in the next N days, below the sidebar grid.
 *
 * A month grid shows next month's entries only after paging to it; this lists
 * them by date without leaving the current month. Ongoing entries are listed
 * under today.
 */
const Upcoming: React.FC<{
  onEdit: (event: CalendarEvent) => void;
  onSaveSettings: () => void;
}> = ({ onEdit, onSaveSettings }) => {
  const events = useEvents((state) => state);
  const show = useSetting((state) => state.appearance.upcoming);
  const rawDays = useSetting((state) => state.appearance.upcomingDays);
  const collapsed = useSetting((state) => state.appearance.upcomingCollapsed);
  const today = useToday().format("YYYY-MM-DD");
  if (!show) return null;

  const days = Math.min(MAX_DAYS, Math.max(1, Math.round(Number(rawDays) || 14)));
  const last = addDays(today, days - 1);
  const groups = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    if (event.done || event.end < today || event.start > last) continue;
    const key = event.start < today ? today : event.start;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  const dates = [...groups.keys()].sort();

  const toggle = () => {
    patchSettings({ appearance: { upcomingCollapsed: !collapsed } });
    onSaveSettings();
  };

  return (
    <div className={classNames("otc-upcoming", { "is-collapsed": collapsed })}>
      <button type="button" className="otc-upcoming-head" aria-expanded={!collapsed} onClick={toggle}>
        {t("upcoming.title", { days })}
      </button>
      {!collapsed &&
        (dates.length === 0 ? (
          <div className="otc-upcoming-empty">{t("upcoming.empty", { days })}</div>
        ) : (
          dates.map((date) => (
            <div key={date} className="otc-upcoming-group">
              <div className="otc-upcoming-date">{shortDate(date)}</div>
              {(groups.get(date) ?? []).map((event) => (
                <button
                  key={event.id}
                  type="button"
                  className={classNames("otc-upcoming-row", { "is-ongoing": event.start < today })}
                  onClick={() => onEdit(event)}
                >
                  <span
                    className={classNames("otc-upcoming-dot", { "is-event": event.reminder === null })}
                    style={{ "--otc-event-color": event.color } as React.CSSProperties}
                  />
                  <span className="otc-upcoming-title">{event.title}</span>
                  <span className="otc-upcoming-meta">
                    {event.start === event.end
                      ? ""
                      : `${t("event.dateRange", { start: shortDate(event.start), end: shortDate(event.end) })} · `}
                    {distanceLabel(event, today)}
                    {event.reminder ? ` · ${t("upcoming.reminds", { time: event.reminder.time })}` : ""}
                  </span>
                </button>
              ))}
            </div>
          ))
        ))}
    </div>
  );
};

export default Upcoming;
