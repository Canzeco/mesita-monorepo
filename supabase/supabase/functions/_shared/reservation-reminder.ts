// WHEN Mesita may ring the guest with a REMINDER (Docs › Reservations §B
// leg 7) — a2, ~3 h before a CONFIRMED slot.
//
// Designed constraints (load-bearing):
//   · cap 1, never retried — the app is the fallback
//   · quiet hours 09:00–22:00 place-local NEVER waived (no 6 a.m. reminders)
//   · nothing past reserved_at − 30 min
//   · if the 3 h lead cannot land inside that window, skip
//
// Config (`reservations_config.reminder.enabled`) gates the DIAL, not the
// park: a confirmed ticket still stores reminder_at so flipping the knob
// ON covers already-held tables still inside the window. Cron refuses to
// wake the row while the knob is off, so a disabled fleet is silent.
//
// Pure scheduling math — no clock, no DB.

import { mexicoZone } from "./local-time.ts";
import type { ReservationPatch } from "./reservation-doc.ts";

export const REMINDER_LEAD_MS = 3 * 3600_000;
export const REMINDER_MAX_ATTEMPTS = 1;

const QUIET_OPENS = 9;
const QUIET_CLOSES = 22;
const CUTOFF_BEFORE_SLOT_MS = 30 * 60_000;

export type ReminderState =
  | "idle"
  | "scheduled"
  | "ringing"
  | "calling"
  | "answered"
  | "failed"
  | "skipped";

export type ReminderPark = Pick<ReservationPatch, "reminder_state" | "reminder_at">;

function hourAt(at: Date, lng: number | null): number {
  try {
    const h = new Intl.DateTimeFormat("en-US", {
      timeZone: mexicoZone(lng),
      hour: "numeric",
      hourCycle: "h23",
    }).format(at);
    const n = parseInt(h, 10);
    return Number.isFinite(n) ? n : at.getUTCHours();
  } catch {
    return at.getUTCHours();
  }
}

/**
 * The instant the one reminder call may fire, or null when it cannot fit
 * the window (lead already behind us, quiet hours would land past cutoff,
 * or the slot is too close).
 */
export function reminderCallAt(
  lng: number | null,
  reservedAt: Date | null,
  now: Date = new Date(),
): { at: Date; reason: string } | null {
  if (!reservedAt) return null;
  const cutoff = reservedAt.getTime() - CUTOFF_BEFORE_SLOT_MS;
  let at = new Date(reservedAt.getTime() - REMINDER_LEAD_MS);
  if (at.getTime() < now.getTime()) return null;
  if (at.getTime() > cutoff) return null;

  let deferred = false;
  for (let i = 0; i < 48; i++) {
    const h = hourAt(at, lng);
    if (h >= QUIET_OPENS && h < QUIET_CLOSES) break;
    at = new Date(at.getTime() + 30 * 60_000);
    deferred = true;
  }
  if (at.getTime() > cutoff) return null;
  if (at.getTime() < now.getTime()) return null;

  return {
    at,
    reason: deferred
      ? "reminder held for the 09:00–22:00 window (never waived)"
      : "reminder ~3 h before the slot",
  };
}

/** Patch to park (or skip) the reminder the moment a ticket becomes confirmed. */
export function reminderParkPatch(
  lng: number | null,
  reservedAt: Date | null,
  guestNotify: "call" | "app",
  now: Date = new Date(),
): ReminderPark {
  if (guestNotify === "app") {
    return { reminder_state: "skipped", reminder_at: null };
  }
  const next = reminderCallAt(lng, reservedAt, now);
  if (!next) return { reminder_state: "skipped", reminder_at: null };
  return { reminder_state: "scheduled", reminder_at: next.at.toISOString() };
}

/** Clear a parked reminder — cancel, reschedule, or a slot that no longer exists. */
export const REMINDER_CLEAR: ReminderPark = {
  reminder_state: "skipped",
  reminder_at: null,
};
