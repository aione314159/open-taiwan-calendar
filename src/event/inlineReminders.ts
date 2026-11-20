import { Plugin, TFile } from "obsidian";
import { settingsStore } from "../state/settings";
import { Store, useStoreValue } from "../state/store";

/**
 * Read-only view of the Reminder plugin's inline syntax: `(@2026-12-29)` or
 * `(@2026-12-29 09:30)` after an open to-do.
 *
 * Shown on the calendar so a day does not look empty when the other plugin has
 * something on it. Nothing here notifies, and nothing is ever written back.
 */

export interface InlineReminder {
  /** `YYYY-MM-DD` */
  date: string;
  /** `HH:mm`, or null for a date-only mark. */
  time: string | null;
  /** The to-do text, without the checkbox and without the mark. */
  text: string;
  path: string;
  /** 0-based line in the file. */
  line: number;
}

const MARK = /\(@(\d{4}-\d{2}-\d{2})(?:\s+([01]\d|2[0-3]):([0-5]\d))?\)/;
const OPEN_TASK = /^\s*[-*+] \[ \] /;

/** The date and time of the inline mark on one line, or null when there is none. */
export const parseInlineReminder = (
  line: string
): { date: string; time: string | null } | null => {
  const match = MARK.exec(line);
  if (!match) return null;
  return { date: match[1], time: match[2] ? `${match[2]}:${match[3]}` : null };
};

export const inlineRemindersStore = new Store<InlineReminder[]>([]);

/** Per file, so a change to one note re-reads only that note. */
const byPath = new Map<string, InlineReminder[]>();

const publish = (): void => {
  inlineRemindersStore.write(
    [...byPath.values()].flat().sort((a, b) =>
      a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "")
    )
  );
};

const enabled = (): boolean => settingsStore.read().appearance.inlineReminders;

/** The inline reminders of one file, from its open tasks only. */
const readFile = async (plugin: Plugin, file: TFile): Promise<InlineReminder[]> => {
  const items = plugin.app.metadataCache.getFileCache(file)?.listItems ?? [];
  const openLines = items.filter((item) => item.task === " ").map((item) => item.position.start.line);
  if (openLines.length === 0) return [];
  const lines = (await plugin.app.vault.cachedRead(file)).split("\n");
  const found: InlineReminder[] = [];
  for (const index of openLines) {
    const text = lines[index] ?? "";
    if (!OPEN_TASK.test(text)) continue;
    const mark = parseInlineReminder(text);
    if (!mark) continue;
    found.push({
      ...mark,
      text: text.replace(OPEN_TASK, "").replace(MARK, "").trim(),
      path: file.path,
      line: index,
    });
  }
  return found;
};

const refreshFile = async (plugin: Plugin, file: TFile): Promise<void> => {
  const found = await readFile(plugin, file);
  if (found.length > 0) byPath.set(file.path, found);
  else byPath.delete(file.path);
  publish();
};

const scanAll = async (plugin: Plugin): Promise<void> => {
  byPath.clear();
  for (const file of plugin.app.vault.getMarkdownFiles()) {
    const found = await readFile(plugin, file);
    if (found.length > 0) byPath.set(file.path, found);
  }
  publish();
};

/**
 * Keep the store current while the setting is on. With it off nothing is
 * scanned and the store stays empty.
 */
export const startInlineReminders = (plugin: Plugin): void => {
  let wasEnabled = enabled();
  if (wasEnabled) void scanAll(plugin);

  plugin.register(
    settingsStore.watch(() => {
      const now = enabled();
      if (now === wasEnabled) return;
      wasEnabled = now;
      if (now) {
        void scanAll(plugin);
      } else {
        byPath.clear();
        publish();
      }
    })
  );
  plugin.registerEvent(
    plugin.app.metadataCache.on("changed", (file) => {
      if (enabled()) void refreshFile(plugin, file);
    })
  );
  plugin.registerEvent(
    plugin.app.vault.on("delete", (file) => {
      if (byPath.delete(file.path)) publish();
    })
  );
  plugin.registerEvent(
    plugin.app.vault.on("rename", (file, oldPath) => {
      if (!byPath.delete(oldPath)) return;
      if (file instanceof TFile && enabled()) void refreshFile(plugin, file);
      else publish();
    })
  );
};

export const useInlineReminders = <S>(select: (items: InlineReminder[]) => S): S =>
  useStoreValue(inlineRemindersStore, select);
