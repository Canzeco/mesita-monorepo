// WHEN the Reservationist's second try fires — the open-hours-aware retry,
// straight from the protocol:
//
//   try 1  immediately, whatever the hour (many places run a 24/7 AI
//          receptionist, and a closed line still tells us something)
//   try 2  +5 minutes if the place is OPEN right now
//          ~30 minutes AFTER it next opens if it's closed
//
// A run can't sleep that long (the edge runtime dies at ~400s), so the engine
// PARKS the ticket with `next_attempt_at` and a pg_cron poller
// (supabase-cron-reservation-retries) wakes it. This module is the pure
// scheduling math so it's testable without a clock or a DB.
//
// Hours come from `places.hours` (the normalised WeeklyHours jsonb) and the
// local wall clock from the place's longitude, exactly like the recommenders —
// one interpretation of "open", never two.

import { localClock, type WeeklyHours } from "./local-time.ts";
import { isOpenAt } from "./local-time-open.ts";

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

/** Minutes past midnight from "HH:mm", or null when unparseable. */
function toMinutes(hhmm: unknown): number | null {
  if (typeof hhmm !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}

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
  lng: number | null,
  now: Date = new Date(),
): number | null {
  if (!hours || typeof hours !== "object") return null;
  const clock = localClock(lng, now);
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
  lng: number | null,
  now: Date = new Date(),
): { at: Date; reason: string } {
  const until = minutesUntilNextOpening(hours, lng, now);
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
