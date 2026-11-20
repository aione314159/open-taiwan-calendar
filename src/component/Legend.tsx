import React, { useEffect, useRef } from "react";
import { t } from "../i18n";
import type { TranslationKey } from "../i18n";
import { useSetting } from "../state/settings";

type Sample = { key: string; label: TranslationKey; render: () => React.ReactNode };

/**
 * What every mark on the grid means.
 *
 * Each sample is drawn with the grid's own classes, inside the calendar, so it
 * follows the dot-size setting and the theme instead of being a picture of
 * them that goes stale.
 */
const Legend: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const reminderColor = useSetting((s) => s.eventDefaults.reminderColor);
  const eventColor = useSetting((s) => s.eventDefaults.eventColor);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    rootRef.current?.focus();
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onPointer, true);
    return () => document.removeEventListener("pointerdown", onPointer, true);
  }, [onClose]);

  const dot = (cls: string, color?: string) => (
    <span
      className={`otc-event-dot ${cls}`}
      style={color ? ({ "--otc-event-color": color } as React.CSSProperties) : undefined}
    />
  );
  const samples: Sample[] = [
    { key: "note", label: "legend.note", render: () => dot("is-note") },
    { key: "open", label: "legend.noteOpen", render: () => dot("is-note has-open-tasks") },
    { key: "done-tasks", label: "legend.noteDone", render: () => dot("is-note is-all-done") },
    { key: "reminder", label: "legend.reminder", render: () => dot("", reminderColor) },
    { key: "event", label: "legend.event", render: () => dot("is-event", eventColor) },
    { key: "handled", label: "legend.handled", render: () => dot("is-done", reminderColor) },
    { key: "inline", label: "legend.inline", render: () => dot("is-inline") },
    {
      key: "more",
      label: "legend.more",
      render: () => <span className="otc-event-marks is-truncated otc-legend-marks" />,
    },
    {
      key: "has-event",
      label: "legend.hasEvent",
      render: () => <span className="otc-cell otc-day has-event otc-legend-cell" />,
    },
    {
      key: "today",
      label: "legend.today",
      render: () => <span className="otc-cell otc-day is-today otc-legend-cell" />,
    },
    {
      key: "holiday",
      label: "legend.holiday",
      render: () => <span className="otc-badge is-holiday">{t("calendar.badgeHoliday")}</span>,
    },
    {
      key: "workday",
      label: "legend.workday",
      render: () => <span className="otc-badge is-workday">{t("calendar.badgeWorkday")}</span>,
    },
  ];

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      className="otc-jump otc-legend"
      role="dialog"
      aria-label={t("legend.title")}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="otc-legend-title">{t("legend.title")}</div>
      <ul className="otc-legend-list">
        {samples.map((sample) => (
          <li key={sample.key} className="otc-legend-item">
            <span className="otc-legend-sample">{sample.render()}</span>
            <span>{t(sample.label)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Legend;
