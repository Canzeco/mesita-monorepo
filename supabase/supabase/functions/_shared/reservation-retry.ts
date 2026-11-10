// WHEN the Reservationist's second try fires — the open-hours-aware retry,
// straight from the protocol:
//
//   try 1  when the place is OPEN (MESITA-3626, `firstCallPlan`): now if it
//          is open or its hours are unknown; a request made at 3 a.m. waits
//          for opening time. A slot that comes before the place opens (less
//          than 30 min after it) can't be booked by phone: the ticket ends
//          and the guest is told.
//   try 2  +5 minutes if the place is OPEN right now
//          ~30 minutes AFTER it next opens if it's closed
//
// A run can't sleep that long (the edge runtime dies at ~400s), so the engine
// PARKS the ticket with `next_attempt_at` and a pg_cron poller
// (supabase-cron-retry-reservations) wakes it. This module is the pure
// scheduling math so it's testable without a clock or a DB.
//
// Hours come from `places.hours` (the normalised WeeklyHours jsonb) and the
// local wall clock from the place's zone (_shared/local-time.ts placeZone) —
// one interpretation of "open", never two.

import { DAY_KEYS, isOpenAt, localClock, toMinutes, type WeeklyHours } from "./local-time.ts";

const OPEN_RETRY_MINUTES = 5;
const AFTER_OPENING_MINUTES = 30;

/**
 * Minutes from now until the place's next opening, scanning up to a week
 * ahead. 0 when it's open right now; null when the hours are unusable or the
 * place never opens.
 *
 * Works entirely in LOCAL minute deltas and adds them to the current instant,
 * so no local-date → UTC construction is needed. A DST jump inside the window
 * can skew it by an hour; most of Mexico has no DST since 2022, and an hour on
 * a 30-minute courtesy delay is harmless.
 */
function minutesUntilNextOpening(
  hours: unknown,
  zone: string | null,
  now: Date = new Date(),
): number | null {
  if (!hours || typeof hours !== "object") return null;
  const clock = localClock(zone, now);
  if (!clock) return null;
  const week = hours as WeeklyHours;
  if (!DAY_KEYS.some((k) => Array.isArray(week[k]) && week[k].length > 0)) {
    return null;
  }
  if (isOpenAt(hours, clock.weekday, clock.minutes) === true) return 0;

  const todayIdx = DAY_KEYS.indexOf(clock.weekday as (typeof DAY_KEYS)[number]);
  if (todayIdx < 0) return null;

  for (let d = 0; d <= 7; d++) {
    const day = DAY_KEYS[(todayIdx + d) % 7];
    const opens = (week[day] ?? [])
      .map((r) => toMinutes(r?.open))
      .filter((v): v is number => v !== null)
      // Today only counts openings still ahead of us.
      .filter((v) => (d === 0 ? v > clock.minutes : true))
      .sort((a, b) => a - b);
    if (opens.length > 0) return d * 1440 + opens[0] - clock.minutes;
  }
  return null;
}

/**
 * The instant the next call attempt should fire.
 *
 *   open now (or hours unknown) → +5 min
 *   closed                      → next opening + 30 min
 *
 * Unknown hours deliberately behave like "open": we'd rather try a place than
 * park a guest's table on missing data.
 */
export function nextAttemptAt(
  hours: unknown,
  zone: string | null,
  now: Date = new Date(),
): { at: Date; reason: string } {
  const until = minutesUntilNextOpening(hours, zone, now);
  if (until === null) {
    return {
      at: new Date(now.getTime() + OPEN_RETRY_MINUTES * 60_000),
      reason: `no hours on file — retrying in ${OPEN_RETRY_MINUTES} min`,
    };
  }
  if (until === 0) {
    return {
      at: new Date(now.getTime() + OPEN_RETRY_MINUTES * 60_000),
      reason: `open now — retrying in ${OPEN_RETRY_MINUTES} min`,
    };
  }
  const mins = until + AFTER_OPENING_MINUTES;
  return {
    at: new Date(now.getTime() + mins * 60_000),
    reason: `closed — retrying ${AFTER_OPENING_MINUTES} min after it opens (in ${
      Math.round(mins / 6) / 10
    } h)`,
  };
}

/** The first call rings at least this long before the slot. */
export const FIRST_CALL_LEAD_MIN = 30;

export type FirstCallPlan =
  | { kind: "now"; reason: string }
  | { kind: "wait"; at: Date; reason: string }
  | { kind: "too_late"; reason: string };

/**
 * When the FIRST booking call may ring (MESITA-3626) — the retries' rule
 * applied to try 1:
 *
 *   open now, or hours unknown           → now
 *   closed, opens ≥ 30 min before slot   → wait for opening time
 *   closed until too close to the slot   → too_late (the ticket ends,
 *                                          unresolved, and the guest is told)
 *
 * Opening time, not +30 min as the retries do: the guest is waiting on the
 * first answer, and a place that just opened is answering its phone.
 */
export function firstCallPlan(
  hours: unknown,
  zone: string | null,
  reservedAt: Date | null,
  now: Date = new Date(),
): FirstCallPlan {
  const until = minutesUntilNextOpening(hours, zone, now);
  if (until === null) return { kind: "now", reason: "no hours on file — calling now" };
  if (until === 0) return { kind: "now", reason: "open now — calling now" };
  const opensAt = new Date(now.getTime() + until * 60_000);
  const latest = reservedAt ? reservedAt.getTime() - FIRST_CALL_LEAD_MIN * 60_000 : Infinity;
  if (opensAt.getTime() > latest) {
    return {
      kind: "too_late",
      reason: `closed until ${Math.round(until / 6) / 10} h from now — too close to the slot to call`,
    };
  }
  return {
    kind: "wait",
    at: opensAt,
    reason: `closed — first call when it opens (in ${Math.round(until / 6) / 10} h)`,
  };
}
