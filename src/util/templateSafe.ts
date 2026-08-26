/**
 * The syntax delimiters of QuickAdd and Templater.
 * QuickAdd's `{{VALUE:x}}` and Templater's `<% %>` / `<%* %>` are both found by
 * a formatter re-scanning the string, so any value that carries these
 * delimiters stands a chance of being executed as syntax.
 */
const TEMPLATE_SYNTAX_PATTERN = /\{\{|\}\}|<%|%>/g;

/**
 * Escaping at the exit: strip template delimiters out of any value on its way
 * to QuickAdd or Templater.
 * This is the second line of defence; the first is the name allow-list in
 * sanitizeOverrides. Removal rather than escaping, because these fields are
 * display text meant for humans and have no need to carry a delimiter through.
 */
export const stripTemplateSyntax = (value: string): string =>
  value.replace(TEMPLATE_SYNTAX_PATTERN, "");
