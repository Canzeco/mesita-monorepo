// WHEN the next call fires.
//
// CALL EVEN WHEN THE PLACE IS CLOSED (Pato, 2026-11-26, MESITA-5009:
// "make the reservations work always"). Until then the first call waited
// for opening (MESITA-3626) and a retry waited until 30 minutes after the
// next opening. A request at 4 a.m. sat until the place opened, and the
// guest was told "Mesita calls when it opens". Opening hours no longer
// park or end a ticket. The table's own time still does: the engine does
// not ring after the slot has passed (beforeTable in the call legs).
//
//   try 1  now
//   try 2+ 5 minutes later
//
// A run can't sleep that long (the edge runtime dies at ~400s), so the
// engine PARKS the ticket with `next_attempt_at` and a pg_cron poller
// (supabase-cron-retry-reservations) wakes it. This module is the pure
// scheduling math so it's testable without a clock or a DB.
//
// `hours` and `zone` stay on the signatures. Callers still pass the place's
// week; this module no longer reads them.

const RETRY_MINUTES = 5;

/** The instant the next call attempt should fire: five minutes, open or closed. */
export function nextAttemptAt(
  _hours: unknown,
  _zone: string | null,
  now: Date = new Date(),
): { at: Date; reason: string } {
  return {
    at: new Date(now.getTime() + RETRY_MINUTES * 60_000),
    reason: `retrying in ${RETRY_MINUTES} min`,
  };
}

/** Kept so an older import still resolves. Opening hours no longer use it. */
export const FIRST_CALL_LEAD_MIN = 30;

export type FirstCallPlan =
  | { kind: "now"; reason: string }
  | { kind: "wait"; at: Date; reason: string }
  | { kind: "too_late"; reason: string };

/**
 * When the first booking call rings. Always now (MESITA-5009). `wait` and
 * `too_late` stay on the type because the call legs still handle them; this
 * function does not return them.
 */
export function firstCallPlan(
  _hours: unknown,
  _zone: string | null,
  _reservedAt: Date | null,
  _now: Date = new Date(),
): FirstCallPlan {
  return { kind: "now", reason: "calling now" };
}
