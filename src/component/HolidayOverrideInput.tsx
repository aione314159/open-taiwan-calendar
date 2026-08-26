import React, { ReactNode, useEffect, useId, useRef, useState } from "react";
import { sanitizeOverrides } from "src/holiday/rocHoliday";
import type { RocHolidayEntry } from "src/holiday/types";
import { t } from "src/i18n";
import JsonCodeEditor from "./JsonCodeEditor";

export default function HolidayOverrideInput({
  title,
  subTitle,
  value,
  onChange,
}: {
  title: ReactNode;
  subTitle: ReactNode;
  value: Record<number, RocHolidayEntry[]>;
  onChange: (value: Record<number, RocHolidayEntry[]>) => void;
}) {
  const serialized = JSON.stringify(value, null, 2);
  const [text, setText] = useState(serialized);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // useState's lazy initializer runs once at mount, so a later change to the
  // external value would leave what is displayed out of step; this resyncs it
  const lastSerializedRef = useRef(serialized);
  const editorId = useId();

  useEffect(() => {
    if (lastSerializedRef.current !== serialized) {
      lastSerializedRef.current = serialized;
      setText(serialized);
    }
  }, [serialized]);

  const commit = (next: Record<number, RocHolidayEntry[]>, dropped: number) => {
    const nextText = JSON.stringify(next, null, 2);
    lastSerializedRef.current = nextText;
    setText(nextText);
    setError("");
    setNotice(
      dropped > 0 ? t("holidayOverride.droppedNotice", { count: dropped }) : ""
    );
    onChange(next);
  };

  /**
   * Produce a valid example so the user can see the field shapes before editing
   * them. The shape of this JSON (years as keys, four fields per entry) is hard
   * to picture from prose alone, and one sample that actually runs beats three
   * more lines of explanation.
   *
   * Tomorrow rather than today: today's cell already carries the "today" badge
   * and the highlight border, so laying the example holiday's red text and
   * "day off" badge on top of it makes it impossible to tell which effect came
   * from the example. Tomorrow is a clean control, and the difference is
   * obvious at a glance once it is applied.
   * The date is not hard-coded either — a fixed one would force the user to
   * page to that month before seeing any effect at all.
   */
  const fillExample = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const dd = String(tomorrow.getDate()).padStart(2, "0");
    const example: Record<number, RocHolidayEntry[]> = {
      [yyyy]: [
        {
          date: `${mm}-${dd}`,
          name: t("holidayOverride.exampleName"),
          isHoliday: true,
          isMakeupWorkday: false,
        },
      ],
    };
    setText(JSON.stringify(example, null, 2));
    setError("");
    setNotice(t("holidayOverride.exampleNotice"));
  };

  /**
   * Re-indent. Layout only; nothing is applied — applying still happens in one
   * place, on blur. That keeps the "Format" button's behaviour identical to
   * what its label says, so nobody presses it for tidier indentation and
   * accidentally has their malformed entries thrown away.
   *
   * On a parse failure the original text is kept: someone pressing this button
   * wants to tidy up what they have, and clearing the box at that moment would
   * delete what they typed.
   */
  const formatJson = () => {
    if (!text.trim()) {
      setNotice("");
      setError(t("holidayOverride.emptyError"));
      return;
    }
    try {
      const parsed: unknown = JSON.parse(text);
      setText(JSON.stringify(parsed, null, 2));
      setError("");
      setNotice(t("holidayOverride.reindentNotice"));
    } catch (e) {
      setNotice("");
      setError(
        t("holidayOverride.formatError", { message: (e as Error).message })
      );
    }
  };

  const onBlur = () => {
    if (!text.trim()) {
      commit({}, 0);
      return;
    }
    try {
      const parsed: unknown = JSON.parse(text);
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        throw new Error(t("holidayOverride.shapeError"));
      }
      // Checked entry by entry: bad ones are dropped rather than the batch
      // being rejected, so pasting roughly correct data still takes effect
      const { value: sanitized, dropped } = sanitizeOverrides(parsed);
      commit(sanitized, dropped);
    } catch (e) {
      setNotice("");
      setError(t("holidayOverride.parseError", { message: (e as Error).message }));
    }
  };

  /**
   * Pressing a toolbar button must not blur the input. A blur triggers the
   * entry-by-entry validation and application in onBlur, so someone who only
   * meant to press "Format" would first have some half-edited entries thrown
   * away — very hard to make sense of.
   * Preventing mousedown's default keeps the focus inside the input.
   * Keyboard operation (Tab to the button, then Enter) blurs anyway, and that
   * behaviour is unchanged.
   */
  const keepFocus = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div className="otc-holiday-override">
      <div className="otc-holiday-override-head">
        <div className="setting-item-info">
          <label className="setting-item-name" htmlFor={editorId}>
            {title}
          </label>
          <div className="setting-item-description">{subTitle}</div>
        </div>
        <div className="setting-item-control otc-holiday-override-actions">
          <button
            type="button"
            className="otc-json-toolbar-btn"
            onMouseDown={keepFocus}
            onClick={formatJson}
            aria-label={t("holidayOverride.formatButtonAria")}
          >
            {t("holidayOverride.formatButton")}
          </button>
          <button
            type="button"
            className="otc-json-toolbar-btn"
            onMouseDown={keepFocus}
            onClick={fillExample}
            aria-label={t("holidayOverride.exampleButtonAria")}
          >
            {t("holidayOverride.exampleButton")}
          </button>
        </div>
      </div>
      <JsonCodeEditor
        id={editorId}
        value={text}
        onChange={setText}
        onBlur={onBlur}
        placeholder={t("holidayOverride.placeholder")}
      />
      {/* These messages are the result of an action and the caret is usually
          still inside the input, so they have to be announced actively to be
          heard at all */}
      <div aria-live="polite">
        {error && <div className="otc-holiday-override-error">{error}</div>}
        {notice && <div className="otc-holiday-override-notice">{notice}</div>}
      </div>
    </div>
  );
}
