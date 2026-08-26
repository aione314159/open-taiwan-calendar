import React, { useEffect, useRef } from "react";
import { setIcon, setTooltip } from "obsidian";

/**
 * An icon button.
 *
 * `<button>` rather than `<div onClick>`: a button is natively focusable with
 * Tab, is activated by Enter and Space, and carries the right semantics. A div
 * needs tabindex and a keydown handler bolted on to match — and even then the
 * semantics are still wrong.
 *
 * An icon alone has no readable text, so aria-label is mandatory (otherwise a
 * screen reader announces nothing but "button"). The hover hint goes through
 * Obsidian's native setTooltip so that it follows the theme.
 */
const IconButton: React.FC<{
  icon: string;
  label: string;
  className?: string;
  onClick: () => void;
}> = ({ icon, label, className, onClick }) => {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    setIcon(ref.current, icon);
    setTooltip(ref.current, label);
  }, [icon, label]);

  return (
    <button
      ref={ref}
      type="button"
      className={className}
      aria-label={label}
      onClick={onClick}
    />
  );
};

export default IconButton;
