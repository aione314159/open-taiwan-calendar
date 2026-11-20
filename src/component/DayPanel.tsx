import React, { useEffect, useState } from "react";
import classNames from "classnames";
import type { TFile } from "obsidian";
import * as dni from "obsidian-daily-notes-interface";
import { NoteType } from "../enum";
import { eventsOnDate, useEvents } from "../event/store";
import { formatReminderSummary } from "../event/offsets";
import type { CalendarEvent } from "../event/types";
import { getRocFestivalLabel } from "../holiday/rocHoliday";
import { t } from "../i18n";
import { buildLunarFields } from "../note/format";
import { useTaskStats } from "../note/taskStats";
import { useNotes } from "../state/notes";
import { useSelectedDate } from "../state/selection";
import { patchSettings, useSetting } from "../state/settings";
import { moment } from "../util/moment";

/** How many open to-dos the panel lists before saying "and N more". */
const MAX_TASKS = 10;
const OPEN_TASK = /^\s*[-*+] \[ \] (.*)$/;

export interface DayPanelActions {
  onEdit: (event: CalendarEvent) => void;
  onOpenLine: (file: TFile, line: number) => void;
  onCreateNote: (day: string) => void;
  readFile: (file: TFile) => Promise<string>;
  onSaveSettings: () => void;
}

/**
 * The selected day, below the sidebar grid: its lunar date and festival, its
 * entries, and the first open to-dos of its note.
 */
const DayPanel: React.FC<DayPanelActions> = (actions) => {
  const show = useSetting((state) => state.appearance.dayPanel);
  const collapsed = useSetting((state) => state.appearance.dayPanelCollapsed);
  const overrides = useSetting((state) => state.holidayOverrides);
  const day = useSelectedDate();
  const events = useEvents((state) => state);
  const notes = useNotes((state) => state);
  const counts = useTaskStats((state) => state[day]);
  const [tasks, setTasks] = useState<Array<{ line: number; text: string }>>([]);

  const date = moment(day, "YYYY-MM-DD");
  let file: TFile | null = null;
  try {
    file = dni.getDailyNote(date, notes[NoteType.DAILY] ?? {}) ?? null;
  } catch {
    file = null;
  }

  // Re-read only when the note or its to-do counts change
  useEffect(() => {
    let cancelled = false;
    if (!file || !show) {
      setTasks([]);
      return;
    }
    void actions.readFile(file).then((content) => {
      if (cancelled) return;
      const found: Array<{ line: number; text: string }> = [];
      content.split("\n").forEach((text, line) => {
        const match = OPEN_TASK.exec(text);
        if (match) found.push({ line, text: match[1] });
      });
      setTasks(found);
    });
    return () => {
      cancelled = true;
    };
  }, [file?.path, counts?.open, counts?.done, show]);

  if (!show) return null;

  const { lunar } = buildLunarFields(date.toDate());
  const festival = getRocFestivalLabel(date.toDate(), overrides);
  const dayEvents = eventsOnDate(events, day);
  const toggle = () => {
    patchSettings({ appearance: { dayPanelCollapsed: !collapsed } });
    actions.onSaveSettings();
  };

  return (
    <div className={classNames("otc-day-panel", { "is-collapsed": collapsed })}>
      <button type="button" className="otc-upcoming-head" aria-expanded={!collapsed} onClick={toggle}>
        {t("dayPanel.title", { date: date.format(t("dayPanel.dateFormat")), lunar })}
        {festival ? ` · ${festival}` : ""}
      </button>
      {!collapsed && (
        <div className="otc-day-panel-body">
          {dayEvents.length === 0 ? (
            <div className="otc-upcoming-empty">{t("dayPanel.noEvents")}</div>
          ) : (
            dayEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                className="otc-upcoming-row"
                onClick={() => actions.onEdit(event)}
              >
                <span
                  className="otc-upcoming-dot"
                  style={{ "--otc-event-color": event.color } as React.CSSProperties}
                />
                <span className="otc-upcoming-title">{event.title}</span>
                <span className="otc-upcoming-meta">{formatReminderSummary(event.reminder)}</span>
              </button>
            ))
          )}
          {!file ? (
            <button
              type="button"
              className="otc-day-panel-create"
              onClick={() => actions.onCreateNote(day)}
            >
              {t("dayPanel.createNote")}
            </button>
          ) : tasks.length === 0 ? (
            <div className="otc-upcoming-empty">{t("dayPanel.noTasks")}</div>
          ) : (
            <>
              <div className="otc-upcoming-date">{t("dayPanel.openTasks", { count: tasks.length })}</div>
              {tasks.slice(0, MAX_TASKS).map((task) => (
                <button
                  key={task.line}
                  type="button"
                  className="otc-upcoming-row"
                  onClick={() => file && actions.onOpenLine(file, task.line)}
                >
                  <span className="otc-day-panel-box">☐</span>
                  <span className="otc-upcoming-title">{task.text}</span>
                </button>
              ))}
              {tasks.length > MAX_TASKS && (
                <div className="otc-upcoming-empty">
                  {t("dayPanel.more", { count: tasks.length - MAX_TASKS })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default DayPanel;
