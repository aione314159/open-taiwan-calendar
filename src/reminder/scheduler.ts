import { App, Notice } from "obsidian";
import { addDays, diffDays } from "../event/dateMath";
import { readEvents } from "../event/store";
import { ReminderChannel } from "../event/types";
import type { CalendarEvent } from "../event/types";
import { t } from "../i18n";
import { replaceReminderState, settingsStore } from "../state/settings";
import { moment } from "../util/moment";
import { ReminderModal } from "../view/ReminderModal";
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
  const until = snoozedUntil.get(key);
  if (until === undefined) return false;
  if (until > now) return true;
  snoozedUntil.delete(key);
  return false;
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
  onSnooze: (keys: string[]) => void
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
  new ReminderModal(app, modalItems, snoozeMinutes, () =>
    onSnooze(modalItems.map((item) => fireKey(item.event.id, item.offset)))
  ).open();
};

/**
 * One sweep.
 *
 * Exported so the plugin can run it once the layout is ready as well as on the
 * interval: a reminder set for 09:00 in a vault that was not open at 09:00 has
 * to appear when the vault opens, not be skipped for the day.
 */
export const runReminderSweep = (host: SchedulerHost): void => {
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

  for (const event of events) {
    const rule = event.reminder;
    if (!rule) continue;
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

  if (changed) {
    replaceReminderState(state);
    host.saveOptions();
  }
  if (due.length === 0) return;

  announce(host.app, due, settings.reminder.channels, settings.reminder.snoozeMinutes, (keys) => {
    const until = Date.now() + settings.reminder.snoozeMinutes * 60_000;
    const next = { ...settingsStore.read().reminderState };
    for (const key of keys) {
      snoozedUntil.set(key, until);
      // Clearing the fired record is what lets the sweep pick the occurrence up
      // again once the snooze expires
      delete next[key];
    }
    replaceReminderState(next);
    host.saveOptions();
  });
};

/** Start sweeping. The interval is owned by Obsidian and cleared on unload. */
export const startReminderScheduler = (host: SchedulerHost): void => {
  host.registerInterval(
    window.setInterval(() => runReminderSweep(host), TICK_MS)
  );
};
