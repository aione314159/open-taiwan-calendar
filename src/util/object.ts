/** A JSON-ish object: not null, not an array, not a class instance we care about. */
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Fold a patch into a base object, recursing into nested objects.
 *
 * Arrays are replaced outright rather than merged element by element. Pairing
 * them up by index would mean a shorter replacement leaves the tail of the old
 * one in place, and an empty one changes nothing at all — neither of which is
 * what a settings patch should do.
 *
 * `undefined` in the patch means "not specified" and leaves the base value
 * alone, so a caller can build a patch object without having to strip the keys
 * it has no opinion about.
 */
export const deepMerge = <T>(base: T, patch: unknown): T => {
  if (patch === undefined) return base;
  if (!isPlainObject(patch) || !isPlainObject(base)) return patch as T;
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    merged[key] = isPlainObject(value) ? deepMerge(merged[key], value) : value;
  }
  return merged as T;
};

/**
 * Read a dotted path out of an object, e.g. `readPath(settings, "appearance.layout")`.
 *
 * Returns `undefined` the moment the path leaves the object graph, so a missing
 * intermediate key is not an error — the settings page asks for paths that a
 * partially written data.json may not have yet.
 */
export const readPath = (source: unknown, path: string): unknown =>
  path
    .split(".")
    .reduce<unknown>(
      (current, key) => (isPlainObject(current) ? current[key] : undefined),
      source
    );
