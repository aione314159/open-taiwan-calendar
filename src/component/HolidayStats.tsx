import React, { useMemo } from "react";
import classNames from "classnames";
import { moment } from "../util/moment";
import type { Moment } from "../util/moment";
import { holidayStats } from "../holiday/holidayStats";
import type { RocHolidayEntry } from "../holiday/types";
import { t } from "../i18n";
import { patchSettings, useSetting } from "../state/settings";

/**
 * Days off and long weekends for what the grid shows: the month in the month
 * view, the whole year in the year view. Read-only; it follows the grid's
 * anchor and the holiday overrides, so it always agrees with the cells above.
 */
const HolidayStats: React.FC<{
  mode: "month" | "year";
  anchor: Moment;
  overrides?: Record<number, RocHolidayEntry[]>;
  onSaveSettings: () => void;
}> = ({ mode, anchor, overrides, onSaveSettings }) => {
  const collapsed = useSetting((state) => state.appearance.holidayStatsCollapsed);
  const unit = mode === "month" ? "month" : "year";
  const startIso = anchor.clone().startOf(unit).format("YYYY-MM-DD");
  const stats = useMemo(() => {
    const start = moment(startIso, "YYYY-MM-DD");
    return holidayStats(
      start.toDate(),
      start.clone().endOf(unit).toDate(),
      overrides
    );
  }, [startIso, unit, overrides]);

  const period = anchor.format(
    t(mode === "month" ? "holidayStats.periodMonth" : "holidayStats.periodYear")
  );
  const dateFormat = t("holidayStats.runDateFormat");
  const day = (iso: string) => moment(iso, "YYYY-MM-DD").format(dateFormat);

  const toggle = () => {
    patchSettings({ appearance: { holidayStatsCollapsed: !collapsed } });
    onSaveSettings();
  };

  return (
    <div className={classNames("otc-holiday-stats", { "is-collapsed": collapsed })}>
      {/* Same fold-to-heading button as the day panel and the upcoming list */}
      <button
        type="button"
        className="otc-upcoming-head otc-holiday-stats-title"
        aria-expanded={!collapsed}
        onClick={toggle}
      >
        {t("holidayStats.title", { period })}
      </button>
      {!collapsed && (
      <>
      <div className="otc-holiday-stats-summary">
        {t("holidayStats.summary", {
          total: stats.daysOff,
          weekend: stats.weekendDays,
          holiday: stats.holidayDays,
        })}
      </div>
      <div className="otc-holiday-stats-summary">
        {stats.runs.length > 0
          ? t("holidayStats.longWeekends", { count: stats.runs.length })
          : t("holidayStats.noLongWeekends")}
      </div>
      {stats.runs.length > 0 && (
        <ul className="otc-holiday-stats-runs">
          {stats.runs.map((run) => (
            <li key={run.start} className="otc-holiday-stats-run">
              <span className="otc-holiday-stats-range">
                {day(run.start)} – {day(run.end)}
              </span>
              <span className="otc-holiday-stats-days">
                {t("holidayStats.runDays", { count: run.days })}
              </span>
              {run.name && <span className="otc-holiday-stats-name">{run.name}</span>}
            </li>
          ))}
        </ul>
      )}
      </>
      )}
    </div>
  );
};

export default HolidayStats;
