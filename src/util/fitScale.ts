/**
 * One implementation of "scale the content to fit its container".
 *
 * There used to be two. The floating panel had the fixed version (measured
 * sizes + ResizeObserver); the sidebar was still on the old one, with 400/450
 * hard-coded and only called from onResize/onOpen — so the sidebar's content
 * got clipped off on the right. This is the single home of the fixed version.
 *
 * It imports nothing from the project, so any layer can use it and it can never
 * take part in an import cycle.
 */

export interface FitScaleOptions {
  /**
   * Whether the content may be scaled beyond its natural size.
   * false (the default) -> shrink only: the content never overflows, but it is
   * never enlarged either.
   * true -> scale up proportionally to fill a container that is big enough.
   */
  allowUpscale?: boolean;
  /**
   * Vertical alignment of the content inside the container.
   * "center" (the default) -> for the floating panel: its size hugs the
   *   content, so centring is the right answer.
   * "top" -> for the sidebar: it is tall and narrow, so the ratio is decided by
   *   the width and the height is necessarily left over. Centring splits that
   *   leftover height evenly above and below, leaving a large gap at the top.
   */
  align?: "center" | "top";
}

export interface FitScaleController {
  /** Recompute immediately (call this after a settings change) */
  update(): void;
  /** Stop observing and detach */
  destroy(): void;
}

/**
 * Scale the content proportionally to the container's visible size.
 *
 * - The content size is **measured** with offsetWidth/offsetHeight. When a
 *   hard-coded constant is larger than the real content, the difference turns
 *   into invisible padding that squeezes the calendar down. offset* is not
 *   affected by transform, so it stays safe to re-measure on every pass.
 * - The container's usable size has to have its padding subtracted.
 * - Take the smaller of the width and height ratios: keeps the aspect ratio and
 *   avoids clipping.
 * - The ResizeObserver watches the container *and* the content: switching
 *   between the month and year views changes the content's own height, and the
 *   ratio has to be recomputed when it does.
 *
 * WARNING: contentEl's width must be a fixed value, never max-content — a
 *   grid under max-content has no upper bound to settle on, and the measured
 *   ratio goes with it (the same note is on .otc-floating-scale in styles.css).
 */
export const fitScale = (
  containerEl: HTMLElement,
  contentEl: HTMLElement,
  options: FitScaleOptions = {}
): FitScaleController => {
  const alignTop = options.align === "top";
  /**
   * Alignment is set here in one place rather than being overridden by two
   * separate stylesheets.
   *
   * transform-origin has to change together with align. If the container alone
   * is switched to flex-start and the origin is left at center, scale() still
   * uses the element's centre as its reference, so after scaling the visual top
   * of the content drops by (1 - ratio) x contentHeight / 2 and the gap is
   * still there. That half-fixed state is the most common way this bug comes
   * back.
   */
  containerEl.style.alignItems = alignTop ? "flex-start" : "center";
  contentEl.style.transformOrigin = alignTop ? "top center" : "center center";

  const update = (): void => {
    const contentWidth = contentEl.offsetWidth;
    const contentHeight = contentEl.offsetHeight;
    if (contentWidth <= 0 || contentHeight <= 0) return;
    const style = getComputedStyle(containerEl);
    const paddingX =
      parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const paddingY =
      parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const availWidth = containerEl.clientWidth - paddingX;
    const availHeight = containerEl.clientHeight - paddingY;
    if (availWidth <= 0 || availHeight <= 0) return;
    const fitRatio = Math.min(
      availWidth / contentWidth,
      availHeight / contentHeight
    );
    // Shrinking always applies (that is what guarantees no overflow); only
    // enlarging is gated by allowUpscale
    const ratio = options.allowUpscale ? fitRatio : Math.min(1, fitRatio);
    contentEl.style.transform = `scale(${ratio})`;
  };

  const observer = new ResizeObserver(() => update());
  observer.observe(containerEl);
  observer.observe(contentEl);
  update();

  return {
    update,
    destroy: () => observer.disconnect(),
  };
};
