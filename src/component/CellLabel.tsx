import React, { useEffect, useRef } from "react";
import { setTooltip } from "obsidian";
import { truncateDisplayLabel } from "../note/format";

/**
 * The single line of label inside a date cell (festival / solar term / lunar
 * day).
 *
 * Long names must be truncated. The longest name in the bundled holiday data —
 * the Taiwan Retrocession memorial on 10/25 — is 15 characters, and left alone
 * it wraps to three lines inside the cell, pushing the rest of the dates in
 * that row out of place and breaking the whole row's layout.
 *
 * The full name goes through Obsidian's native setTooltip rather than the HTML
 * title attribute: the native tooltip follows the theme, whereas title is an
 * operating-system box that is slow to appear and ignores the theme entirely.
 */
const CellLabel: React.FC<{ text: string; className?: string }> = ({
  text,
  className,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const display = truncateDisplayLabel(text);
  const truncated = display !== text;

  useEffect(() => {
    if (!ref.current) return;
    // No tooltip when nothing was truncated: the full name is already on
    // screen, and a popup repeating it verbatim is just noise
    setTooltip(ref.current, truncated ? text : "");
  }, [text, truncated]);

  return (
    <div ref={ref} className={className}>
      {display}
    </div>
  );
};

export default CellLabel;
