import React, { useEffect, useMemo, useRef, useState } from "react";
import classNames from "classnames";
import { moment } from "src/util/moment";
import type { Moment } from "src/util/moment";
import { parseNaturalLanguage } from "../event/parseNaturalLanguage";
import { t } from "../i18n";
import type { NoteIndex } from "../state/notes";
import IconButton from "./IconButton";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS_IN_YEAR = 12;

/**
 * The months that have at least one daily or monthly note.
 *
 * The index keys are obsidian-daily-notes-interface UIDs such as
 * `day-2026-11-20T00:00:00+08:00`, so the month is read straight out of the
 * key rather than by asking for every day of the year.
 */
const monthsWithNotes = (daily: NoteIndex, monthly: NoteIndex): Set<string> => {
  const months = new Set<string>();
  for (const index of [daily, monthly]) {
    for (const key of Object.keys(index ?? {})) {
      const match = /^[a-z]+-(\d{4}-\d{2})/.exec(key);
      if (match) months.add(match[1]);
    }
  }
  return months;
};

/**
 * A small picker for going straight to a year and month, or to a date.
 *
 * The year, month and quarter in the header open their periodic notes when
 * clicked, so this lives behind its own button instead of taking those clicks
 * over.
 */
const JumpToDate: React.FC<{
  anchor: Moment;
  daily: NoteIndex;
  monthly: NoteIndex;
  /** `day` is set when the user typed a specific date, so it can be marked. */
  onPick: (month: Moment, day: string | null) => void;
  onClose: () => void;
}> = ({ anchor, daily, monthly, onPick, onClose }) => {
  const [year, setYear] = useState(anchor.year());
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLInputElement>(null);
  const withNotes = useMemo(() => monthsWithNotes(daily, monthly), [daily, monthly]);

  useEffect(() => {
    textRef.current?.focus();
    // Clicking anywhere outside the picker closes it, the way a menu does
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onPointer, true);
    return () => document.removeEventListener("pointerdown", onPointer, true);
  }, [onClose]);

  const submitText = () => {
    const value = text.trim();
    if (!value) return;
    const today = moment().format("YYYY-MM-DD");
    let iso: string | null = null;
    if (ISO_DATE_PATTERN.test(value) && moment(value, "YYYY-MM-DD", true).isValid()) {
      iso = value;
    } else {
      const parsed = parseNaturalLanguage(value, today);
      if (parsed.matchedDate) iso = parsed.start;
    }
    if (!iso) {
      setError(t("jump.unrecognised"));
      return;
    }
    onPick(moment(iso, "YYYY-MM-DD"), iso);
  };

  return (
    <div
      ref={rootRef}
      className="otc-jump"
      role="dialog"
      aria-label={t("jump.title")}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <input
        ref={textRef}
        type="text"
        className="otc-jump-text"
        placeholder={t("jump.placeholder")}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setError("");
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") submitText();
        }}
      />
      <div className="otc-jump-error" aria-live="polite">
        {error}
      </div>
      <div className="otc-jump-year">
        <IconButton
          icon="chevron-left"
          label={t("calendar.prevYear")}
          className="otc-nav-button"
          onClick={() => setYear((y) => y - 1)}
        />
        <input
          type="number"
          className="otc-jump-year-input"
          aria-label={t("jump.year")}
          value={year}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isInteger(next) && next > 0 && next < 10000) setYear(next);
          }}
        />
        <IconButton
          icon="chevron-right"
          label={t("calendar.nextYear")}
          className="otc-nav-button"
          onClick={() => setYear((y) => y + 1)}
        />
      </div>
      <div className="otc-jump-months">
        {Array.from({ length: MONTHS_IN_YEAR }, (_, index) => {
          const month = moment({ year, month: index, day: 1 });
          const key = month.format("YYYY-MM");
          return (
            <button
              key={key}
              type="button"
              className={classNames("otc-jump-month", {
                "is-current": month.isSame(anchor, "month"),
                "has-note": withNotes.has(key),
              })}
              onClick={() => onPick(month, null)}
            >
              {month.format(t("calendar.monthCellFormat"))}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default JumpToDate;
