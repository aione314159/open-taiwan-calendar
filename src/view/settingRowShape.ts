/**
 * Write the shape of a settings row onto the row itself.
 *
 * Two layout rules in styles.css need to know what a row contains: a row whose
 * control is a text field wraps, so the field gets the full width instead of
 * the third Obsidian gives it; a control holding a date field needs a gap
 * between the field and the picker button beside it.
 *
 * `:has()` states both in one selector, and that is how they were written. The
 * Obsidian community CSS lint flags it: the browser has to re-check a `:has()`
 * selector against ancestors on every style invalidation, which is a standing
 * cost for rows that never change shape after they are built. So the same fact
 * is written once as a class and the stylesheet matches on that.
 *
 * Safe to call repeatedly on the same container: every row is set *or cleared*
 * on each pass, so a row that loses its text field also loses the class.
 */
export const markSettingRowShapes = (container: HTMLElement): void => {
  container.querySelectorAll<HTMLElement>(".setting-item").forEach((row) => {
    const control = row.querySelector<HTMLElement>(".setting-item-control");
    if (!control) return;
    const hasText = control.querySelector('input[type="text"]') !== null;
    const hasDate = control.querySelector(':scope > input[type="date"]') !== null;
    row.classList.toggle("otc-row-text", hasText);
    control.classList.toggle("otc-control-text", hasText);
    control.classList.toggle("otc-control-date", hasDate);
  });
};
