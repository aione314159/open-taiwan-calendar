import { formatOffsets, parseOffsets } from "../event/offsets";
import { t } from "../i18n";

/** The lead times offered as one-click choices; anything else goes in "custom". */
const PRESETS = [0, 1, 2, 3, 7];

export interface OffsetPicker {
  /** Show these offsets: presets ticked, the rest in the custom field. */
  setValue: (offsets: number[]) => void;
}

/**
 * Days-before as ticks plus a free field, shared by the quick-add dialog and
 * the settings page so both enter a reminder rule the same way.
 *
 * `onChange` receives the combined, de-duplicated offsets (largest first), or
 * null while the custom field holds something that is not a list of numbers.
 */
export const buildOffsetPicker = (
  container: HTMLElement,
  initial: number[],
  onChange: (offsets: number[] | null) => void
): OffsetPicker => {
  const root = container.createDiv({ cls: "otc-offset-picker" });
  const boxes = PRESETS.map((offset) => {
    const label = root.createEl("label", { cls: "otc-offset-chip" });
    const box = label.createEl("input", { type: "checkbox" });
    label.appendText(
      offset === 0 ? t("event.offsetSameDay") : t("event.offsetDaysBefore", { count: offset })
    );
    return [offset, box] as const;
  });
  const custom = root.createEl("input", {
    cls: "otc-offset-custom",
    type: "text",
    attr: { placeholder: t("quickAdd.offsetsCustom"), "aria-label": t("quickAdd.offsetsCustom") },
  });

  const emit = () => {
    const ticked = boxes.filter(([, box]) => box.checked).map(([offset]) => offset);
    const extraText = custom.value.trim();
    const extra = extraText ? parseOffsets(extraText) : [];
    if (extra === null) {
      onChange(null);
      return;
    }
    const all = Array.from(new Set([...ticked, ...extra])).sort((a, b) => b - a);
    onChange(all);
  };

  const setValue = (offsets: number[]) => {
    for (const [offset, box] of boxes) box.checked = offsets.includes(offset);
    custom.value = formatOffsets(offsets.filter((o) => !PRESETS.includes(o)));
  };

  boxes.forEach(([, box]) => box.addEventListener("change", emit));
  custom.addEventListener("input", emit);
  setValue(initial);
  return { setValue };
};
