import { t } from "../i18n";
import type { ReminderRule } from "./types";

/**
 * "How many days before" as a user types it, and as it reads back.
 *
 * The offsets are a list of small integers, and a comma-separated line is the
 * shortest honest control for that: a set of checkboxes would have to guess
 * which values matter, and a number field can only hold one. Shared by the
 * quick-add dialog and the settings page so the two never disagree about what
 * "1, 0" means.
 */

/** A reminder more than a year ahead of its event is a typo, not an intention. */
const MAX_OFFSET_DAYS = 365;

/** `null` when the text is not a usable list, which the caller reports inline. */
export const parseOffsets = (raw: string): number[] | null => {
  const parts = raw
    .split(/[,，\s]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) return null;
  const values: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const value = Number(part);
    if (value > MAX_OFFSET_DAYS) return null;
    values.push(value);
  }
  // Sorted furthest-out first, deduplicated: "0, 1, 1" and "1, 0" are the same
  // rule, and storing them differently would show as two different summaries
  return Array.from(new Set(values)).sort((a, b) => b - a);
};

export const formatOffsets = (offsets: number[]): string => offsets.join(", ");

/** One offset in words: "on the day" / "3 d before". */
const offsetLabel = (offset: number): string =>
  offset === 0
    ? t("event.offsetSameDay")
    : t("event.offsetDaysBefore", { count: offset });

/** A whole rule in one line, for a list row that has no space for controls. */
export const formatReminderSummary = (rule: ReminderRule | null): string =>
  rule === null
    ? t("event.noReminder")
    : t("event.reminderSummary", {
        time: rule.time,
        offsets: rule.offsets.map(offsetLabel).join(t("event.offsetSeparator")),
      });
