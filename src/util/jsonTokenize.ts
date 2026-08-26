/**
 * A character-by-character tokenizer for JSON syntax highlighting.
 *
 * Why not use JSON.parse to decide the colours: half-typed content in an input
 * box is almost always invalid JSON (a quote not yet closed, a comma not yet
 * added), so deciding by parse means no colour at all the entire time someone
 * is typing. This scans character by character, produces tokens for any input
 * whatsoever, **never throws**, and never gives up on the rest of the text
 * because something earlier was broken.
 */

export type JsonTokenType =
  /** An object key (a string followed by a colon) */
  | "key"
  /** A string value */
  | "string"
  | "number"
  /** true / false / null */
  | "keyword"
  /** {}[],: */
  | "punct"
  /** Whitespace, newlines, and anything not otherwise recognised */
  | "plain";

export interface JsonToken {
  type: JsonTokenType;
  text: string;
}

const PUNCTUATION = "{}[],:";

const isSpace = (c: string): boolean =>
  c === " " || c === "\t" || c === "\n" || c === "\r";

const isDigit = (c: string): boolean => c >= "0" && c <= "9";

const isWordChar = (c: string): boolean =>
  (c >= "a" && c <= "z") || (c >= "A" && c <= "Z");

/** Find the next non-whitespace character; used to decide whether the string just scanned is a key */
const nextNonSpace = (source: string, from: number): string => {
  let i = from;
  while (i < source.length && isSpace(source[i])) i += 1;
  return source[i] ?? "";
};

export function tokenizeJson(source: string): JsonToken[] {
  const tokens: JsonToken[] = [];

  // Merge adjacent runs of the same type into one token. Without merging the
  // whitespace and indentation, a 30-line JSON document produces well over a
  // thousand <span> elements, all of which are rebuilt on every keystroke.
  const push = (type: JsonTokenType, text: string): void => {
    if (!text) return;
    const last = tokens[tokens.length - 1];
    if (last && last.type === type) last.text += text;
    else tokens.push({ type, text });
  };

  let i = 0;
  while (i < source.length) {
    const ch = source[i];

    if (ch === '"') {
      let j = i + 1;
      let closed = false;
      while (j < source.length) {
        const c = source[j];
        // Skip an escape sequence as a unit, so that \" is not read as the closing quote
        if (c === "\\") {
          j += 2;
          continue;
        }
        if (c === '"') {
          j += 1;
          closed = true;
          break;
        }
        // An unterminated string within a line is treated as half-typed and
        // stops before the newline. Otherwise one missing quote swallows the
        // entire rest of the document into a single string token.
        if (c === "\n") break;
        j += 1;
      }
      const text = source.slice(i, j);
      // Keys and string values get different colours: in this particular JSON
      // the keys are years and the values are festival names, and both are
      // strings — colouring them the same is the same as not colouring at all
      const isKey = closed && nextNonSpace(source, j) === ":";
      push(isKey ? "key" : "string", text);
      i = j;
      continue;
    }

    if (isDigit(ch) || (ch === "-" && isDigit(source[i + 1] ?? ""))) {
      let j = i + 1;
      while (j < source.length) {
        const c = source[j];
        if (isDigit(c) || c === "." || c === "e" || c === "E" || c === "+" || c === "-") j += 1;
        else break;
      }
      push("number", source.slice(i, j));
      i = j;
      continue;
    }

    if (isWordChar(ch)) {
      let j = i;
      while (j < source.length && isWordChar(source[j])) j += 1;
      const word = source.slice(i, j);
      const isLiteral = word === "true" || word === "false" || word === "null";
      push(isLiteral ? "keyword" : "plain", word);
      i = j;
      continue;
    }

    if (PUNCTUATION.includes(ch)) {
      push("punct", ch);
      i += 1;
      continue;
    }

    // Whitespace, CJK, anything unrecognised: emitted verbatim, neither
    // coloured nor dropped
    push("plain", ch);
    i += 1;
  }

  return tokens;
}
