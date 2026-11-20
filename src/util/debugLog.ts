import type { DataAdapter } from "obsidian";
import { moment } from "./moment";

/**
 * Replaced by esbuild at build time (see `define` in esbuild.config.mjs).
 *
 * Release builds leave it false, and every call below then does nothing, so the
 * published plugin writes no log. Build with `OTC_DEBUG_LOG=1` to turn it on
 * for a local install while chasing a bug that only shows up in a live vault.
 */
declare const __OTC_DEBUG_LOG__: boolean;

export const DEBUG_LOG_ENABLED = __OTC_DEBUG_LOG__;

/** Past this size the log is moved to `debug.log.1` and a new one is started. */
const MAX_BYTES = 2 * 1024 * 1024;

/** Lines are batched: a sync can fire hundreds of vault events in a second. */
const FLUSH_MS = 1000;

let adapter: DataAdapter | null = null;
let logPath = "";
let pending: string[] = [];
let timer: number | null = null;
// Writes are chained so two flushes can never interleave or race a rotation
let writing: Promise<void> = Promise.resolve();

/** Point the log at `<plugin dir>/debug.log`. Does nothing in a release build. */
export const initDebugLog = (vaultAdapter: DataAdapter, pluginDir: string): void => {
  if (!DEBUG_LOG_ENABLED) return;
  adapter = vaultAdapter;
  logPath = `${pluginDir}/debug.log`;
};

const write = async (target: DataAdapter, text: string): Promise<void> => {
  const stat = await target.stat(logPath);
  if (stat && stat.size > MAX_BYTES) {
    const previous = `${logPath}.1`;
    if (await target.exists(previous)) await target.remove(previous);
    await target.rename(logPath, previous);
  }
  if (await target.exists(logPath)) {
    await target.append(logPath, text);
  } else {
    await target.write(logPath, text);
  }
};

/** Write out everything queued so far. */
export const flushDebugLog = (): Promise<void> => {
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
  if (!adapter || pending.length === 0) return writing;
  const target = adapter;
  const text = `${pending.join("\n")}\n`;
  pending = [];
  writing = writing.then(() =>
    write(target, text).catch((err) => {
      // The log must never take the plugin down with it
      console.error("[open-taiwan-calendar] debug log write failed", err);
    })
  );
  return writing;
};

/**
 * Queue one log line: a local timestamp, an event name and a flat JSON payload.
 *
 * One JSON object per line, so the file can be read with grep or parsed line by
 * line without a custom format.
 */
export const debugLog = (event: string, data: Record<string, unknown> = {}): void => {
  if (!DEBUG_LOG_ENABLED || !adapter) return;
  let line: string;
  try {
    line = JSON.stringify({
      t: moment().format("YYYY-MM-DD HH:mm:ss.SSS"),
      event,
      ...data,
    });
  } catch {
    line = JSON.stringify({ event, error: "payload not serialisable" });
  }
  pending.push(line);
  if (timer === null) {
    timer = window.setTimeout(() => void flushDebugLog(), FLUSH_MS);
  }
};

/** An error as a plain object: `JSON.stringify` turns an Error into `{}`. */
export const describeError = (err: unknown): Record<string, unknown> =>
  err instanceof Error
    ? { error: err.message, stack: err.stack }
    : { error: String(err) };
