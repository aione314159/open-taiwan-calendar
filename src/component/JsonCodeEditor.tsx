import React, {
  ChangeEvent,
  FocusEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { tokenizeJson, JsonTokenType } from "src/util/jsonTokenize";

/**
 * A minimal JSON editor: a line-number gutter, syntax colouring, and an
 * editable textarea.
 *
 * Why three stacked layers instead of an off-the-shelf editor package:
 * 1. CodeMirror is present at runtime inside Obsidian, but
 *    @codemirror/lang-json is **not** — using it would mean bundling a JSON
 *    language module ourselves.
 * 2. This plugin publicly claims zero outbound requests and its bundle is
 *    already over a million characters; carrying another 30KB of dependency for
 *    one input box on the settings page is not a good trade.
 *
 * How the stack works: a <pre> underneath holds the coloured text, and the
 * <textarea> on top has its own text made transparent with
 * -webkit-text-fill-color (color itself is kept, so the caret and the IME
 * composition underline stay visible). The two layers have their font, line
 * height and padding aligned item by item, so they read as one piece of text.
 * That alignment is pure CSS, and changing either side's font or padding throws
 * it off immediately — to touch the styling, read the whole .otc-json-editor-*
 * block of comments in styles.css first.
 *
 * No wrapping (white-space: pre) is deliberate: allow soft wrapping and one
 * logical line occupies two visual lines, at which point the gutter's line
 * numbers no longer line up and would have to be rebuilt by measuring each
 * line's real height. Horizontal scrolling is what every code editor does, so
 * that is what is used here.
 */

const TOKEN_CLASS: Record<JsonTokenType, string> = {
  key: "otc-json-key",
  string: "otc-json-string",
  number: "otc-json-number",
  keyword: "otc-json-keyword",
  punct: "otc-json-punct",
  plain: "otc-json-plain",
};

export default function JsonCodeEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: (e: FocusEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  id?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const tokens = useMemo(() => tokenizeJson(value), [value]);
  const lineCount = useMemo(() => value.split("\n").length, [value]);

  /** The textarea is the layer that actually scrolls; the other two follow it */
  const syncScroll = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    if (highlightRef.current) {
      highlightRef.current.scrollTop = textarea.scrollTop;
      highlightRef.current.scrollLeft = textarea.scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = textarea.scrollTop;
  }, []);

  // When the content is replaced from outside (formatting, inserting the
  // example, a settings change) the browser resets the textarea's scroll
  // position, so the layers have to be realigned or the colouring layer stays
  // stuck at the old offset
  useEffect(() => {
    syncScroll();
  }, [value, syncScroll]);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="otc-json-editor">
      {/* The line numbers are decorative; read out to a screen reader they
          would only prefix every line with an extra number */}
      <div className="otc-json-editor-gutter" ref={gutterRef} aria-hidden="true">
        {Array.from({ length: lineCount }, (_, index) => (
          <span className="otc-json-editor-line-no" key={index}>
            {index + 1}
          </span>
        ))}
      </div>
      <div className="otc-json-editor-scroll">
        {/* WARNING: this order must not be swapped. The textarea goes
            underneath and the highlight layer on top.
            The other way round (highlight layer below), the opaque yellow
            composition background the browser paints on the textarea during
            Zhuyin/Pinyin IME composition covers the coloured text underneath
            completely, and the user cannot see the characters they are
            currently typing — observed directly in a CDP screenshot.
            The highlight layer carries pointer-events: none, so sitting on top
            does not block clicking or selection. */}
        <textarea
          id={id}
          ref={textareaRef}
          className="otc-json-editor-input"
          spellCheck={false}
          value={value}
          onChange={handleChange}
          onBlur={onBlur}
          onScroll={syncScroll}
          placeholder={placeholder}
        />
        <pre className="otc-json-editor-highlight" ref={highlightRef} aria-hidden="true">
          {tokens.map((token, index) => (
            <span className={TOKEN_CLASS[token.type]} key={index}>
              {token.text}
            </span>
          ))}
          {/* When the content ends with a newline, the final empty line needs
              something holding it open to occupy space; otherwise, scrolled to
              the bottom, the highlight layer is one line shorter than the
              textarea */}
          {"\n"}
        </pre>
      </div>
    </div>
  );
}
