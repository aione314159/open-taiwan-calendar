import { App, Notice } from "obsidian";
import { addDays, diffDays } from "../event/dateMath";
import { setEventDone } from "../event/commands";
import { readEvents } from "../event/store";
import { ReminderChannel } from "../event/types";
import type { CalendarEvent } from "../event/types";
import { t } from "../i18n";
import {
  patchSettings,
  replaceReminderState,
  replaceSnoozeState,
  settingsStore,
} from "../state/settings";
import { moment } from "../util/moment";
import { commitEventEdit } from "../event/commands";
import { openDailyNote } from "../event/noteStore";
import { MissedReminderModal, ReminderModal } from "../view/ReminderModal";
import type { DueReminder } from "../view/ReminderModal";

/**
 * When reminders fire, and how they announce themselves.
 *
 * Deliberately the simplest thing that works: one sweep a minute over a list
 * that is a handful of entries long. There is no timer per reminder and no
 * wake-from-sleep bookkeeping, because a per-reminder timer is exactly what
 * breaks when the laptop lid is closed over the firing time — the timer never
 * runs and the reminder is silently lost. A sweep only has to notice that the
 * moment has passed, which it does on the next tick after the machine wakes.
 */

const TICK_MS = 60_000;

/** How long a corner notice stays before fading. */
const NOTICE_TIMEOUT_MS = 15_000;

/** One reminder occurrence: an event plus which of its offsets fired. */
const fireKey = (eventId: string, offset: number): string =>
  `${eventId}#${offset}`;

/**
 * What the plugin has to offer for reminders to work.
 *
 * A structural interface rather than the plugin class: importing
 * `OpenTaiwanCalendarPlugin` here would close a cycle (main → scheduler →
 * main), which eslint's import-x/no-cycle rejects and which shows up at runtime
 * as an undefined import rather than as a type error.
 */
export interface SchedulerHost {
  app: App;
  saveOptions(): void;
  registerInterval(id: number): number;
}

/**
 * Occurrences the user pushed back, and until when (epoch ms).
 *
 * Kept in memory on purpose. A snooze is a decision about the next few minutes;
 * persisting it would mean a reminder snoozed just before a restart stays
 * silent afterwards, which is the one outcome a snooze must never produce.
 */
const snoozedUntil = new Map<string, number>();

const isSnoozed = (key: string, now: number): boolean => {
  const persisted = settingsStore.read().snoozeState[key];
  if (persisted !== undefined && persisted > now) return true;
  const until = snoozedUntil.get(key);
  if (until === undefined) return false;
  if (until > now) return true;
  snoozedUntil.delete(key);
  return false;
};

/** Snoozes at least this long are written to data.json and survive a restart. */
const PERSIST_SNOOZE_MS = 60 * 60_000;

/**
 * Push occurrences back until `until` (epoch ms).
 *
 * The fired record is cleared so the sweep picks them up again once the snooze
 * ends.
 */
const snooze = (host: SchedulerHost, keys: string[], until: number): void => {
  const settings = settingsStore.read();
  const reminderState = { ...settings.reminderState };
  const snoozeState = { ...settings.snoozeState };
  const persist = until - Date.now() >= PERSIST_SNOOZE_MS;
  for (const key of keys) {
    delete reminderState[key];
    if (persist) {
      snoozeState[key] = until;
      snoozedUntil.delete(key);
    } else {
      snoozedUntil.set(key, until);
      delete snoozeState[key];
    }
  }
  replaceReminderState(reminderState);
  replaceSnoozeState(snoozeState);
  host.saveOptions();
};

/** Every occurrence key an event currently defines. */
const keysOf = (event: CalendarEvent): string[] =>
  event.reminder ? event.reminder.offsets.map((o) => fireKey(event.id, o)) : [];

/** The desktop notification channel, guarded on both sides. */
const notifySystem = (event: CalendarEvent, meta: string): void => {
  // Notification is a browser API the Electron renderer provides; it is a local
  // call and reaches no network, so it does not breach the plugin's zero
  // outbound requests promise (cli/check_network_gate.sh checks the bundle for
  // exactly that). It is still absent in some embeddings, hence the guard.
  if (typeof Notification === "undefined") return;
  if (Notification.permission === "denied") {
    new Notice(t("reminder.systemPermissionDenied"));
    return;
  }
  const show = () => new Notification(event.title, { body: meta });
  if (Notification.permission === "granted") {
    show();
    return;
  }
  void Notification.requestPermission().then((result) => {
    if (result === "granted") show();
  });
};

const announce = (
  app: App,
  due: DueReminder[],
  channels: ReminderChannel[],
  snoozeMinutes: number,
  onSnooze: (keys: string[], until: number) => void
): void => {
  // One global choice, so every due item goes through the same channels
  const wants = (channel: ReminderChannel) => () => channels.includes(channel);

  for (const item of due.filter(wants(ReminderChannel.NOTICE))) {
    // Times out rather than waiting to be clicked away. A sticky notice was the
    // first attempt — the reasoning being that a toast which fades can be
    // missed — but several due at once then stack up in the corner and stay
    // there over the calendar until each is dismissed by hand. The channel that
    // is meant to be impossible to miss is the dialog; this one is the glance.
    new Notice(item.event.title, NOTICE_TIMEOUT_MS);
  }

  for (const item of due.filter(wants(ReminderChannel.SYSTEM))) {
    notifySystem(
      item.event,
      item.daysUntil <= 0
        ? t("reminder.dueToday")
        : t("reminder.dueInDays", { count: item.daysUntil })
    );
  }

  const modalItems = due.filter(wants(ReminderChannel.MODAL));
  if (modalItems.length === 0) return;
  new ReminderModal(app, modalItems, snoozeMinutes, {
    onSnooze: (items, until) =>
      onSnooze(
        items.map((item) => fireKey(item.event.id, item.offset)),
        until
      ),
    onDone: (event) => setEventDone(app, event, true),
    onOpenNote: (event) => openDailyNote(app, event.start),
  }).open();
};

/**
 * Entries whose start has passed without any of their reminders firing.
 *
 * Limited to entries that were not yet over at the last sweep: anything older
 * was already in the past then and was seen, or deliberately skipped, at the
 * time. With no previous sweep — the first run after upgrading — nothing is
 * reported, rather than every expired entry in the vault's history.
 */
const collectMissed = (
  events: CalendarEvent[],
  state: Record<string, string>,
  lastSweep: string,
  today: string
): CalendarEvent[] =>
  lastSweep === ""
    ? []
    : events.filter(
        (event) =>
          event.reminder !== null &&
          !event.done &&
          event.start < today &&
          event.start >= lastSweep &&
          !keysOf(event).some((key) => state[key])
      );

/** Move a missed entry to today, keeping its length, so its day-of reminder fires. */
const rescheduleToday = async (app: App, event: CalendarEvent): Promise<void> => {
  const today = moment().format("YYYY-MM-DD");
  const span = diffDays(event.start, event.end);
  await commitEventEdit(app, event, { ...event, start: today, end: addDays(today, span) });
};

/**
 * One sweep.
 *
 * Exported so the plugin can run it once the layout is ready as well as on the
 * interval: a reminder set for 09:00 in a vault that was not open at 09:00 has
 * to appear when the vault opens, not be skipped for the day.
 */
export const runReminderSweep = (
  host: SchedulerHost,
  options: { startup?: boolean } = {}
): void => {
  const settings = settingsStore.read();
  if (!settings.reminder.enabled) return;

  const now = moment();
  const today = now.format("YYYY-MM-DD");
  const nowTime = now.format("HH:mm");
  const nowMs = now.valueOf();
  const events = readEvents();

  const state = { ...settings.reminderState };
  const due: DueReminder[] = [];
  let changed = false;

  // Read before this sweep records anything, so "never fired" means never
  const missed = options.startup
    ? collectMissed(events, state, settings.lastSweepDate, today)
    : [];
  const sweepDateChanged = settings.lastSweepDate !== today;

  for (const event of events) {
    const rule = event.reminder;
    if (!rule || event.done) continue;
    for (const offset of rule.offsets) {
      const key = fireKey(event.id, offset);
      if (state[key]) continue;
      if (isSnoozed(key, nowMs)) continue;

      const fireDate = addDays(event.start, -offset);
      // Not yet due, or due later today
      if (fireDate > today) continue;
      if (fireDate === today && nowTime < rule.time) continue;
      // The event has already begun. A "three days before" reminder that was
      // missed because the vault was closed all week is noise now, not a
      // reminder, and the offset-0 occurrence covers the day itself.
      if (today > event.start) continue;

      state[key] = today;
      changed = true;
      due.push({ event, daysUntil: diffDays(today, event.start), offset });
    }
  }

  // Prune the occurrences of events that no longer exist, or whose offsets
  // changed. Without this the record only ever grows, for the life of the vault.
  const live = new Set(events.flatMap(keysOf));
  for (const key of Object.keys(state)) {
    if (!live.has(key)) {
      delete state[key];
      changed = true;
    }
  }

  // Persisted snoozes that have ended, or whose entry is gone
  const snoozes = { ...settings.snoozeState };
  for (const [key, until] of Object.entries(snoozes)) {
    if (until <= nowMs || !live.has(key)) {
      delete snoozes[key];
      changed = true;
    }
  }
  if (changed) {
    replaceReminderState(state);
    replaceSnoozeState(snoozes);
  }
  if (sweepDateChanged) patchSettings({ lastSweepDate: today });
  if (changed || sweepDateChanged) host.saveOptions();

  if (missed.length > 0) {
    new MissedReminderModal(
      host.app,
      missed.map((event) => ({ event, daysAgo: diffDays(event.start, today) })),
      (event) => rescheduleToday(host.app, event),
      (event) => openDailyNote(host.app, event.start)
    ).open();
  }
  if (due.length === 0) return;

  announce(host.app, due, settings.reminder.channels, settings.reminder.snoozeMinutes, (keys, until) =>
    snooze(host, keys, until)
  );
};

/** Start sweeping. The interval is owned by Obsidian and cleared on unload. */
export const startReminderScheduler = (host: SchedulerHost): void => {
  host.registerInterval(
    window.setInterval(() => runReminderSweep(host), TICK_MS)
  );
};
