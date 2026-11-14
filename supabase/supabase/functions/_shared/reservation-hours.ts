// Is the requested table time inside the place's hours? (MESITA-3953)
//
// Pato, 2026-11-14: "respect the closed hours. lets minimize false positives
// rather than false negatives". The Reserve form and the Reschedule sheet
// offer only times inside the place's hours (apps/web-consumer
// lib/reservation-slots.ts); this is the same rule at the doors that count,
// consumer-web-create-reservation and consumer-web-update-reservation, since
// a stale tab or a direct call never sees the form.
//
// The rule: the time falls in one of the place's shifts, at most
// LAST_TABLE_MINUTES before that shift closes, on the place's own clock. An
// overnight shift (close <= open) carries into the next day's small hours. A
// place with no usable hours is never refused: there is nothing to respect.

import { DAY_KEYS, localClock, toMinutes, type WeeklyHours } from "./local-time.ts";

/** The last table: the latest time taken is this long before closing. */
export const LAST_TABLE_MINUTES = 60;

export const PLACE_CLOSED_CODE = "place_closed";

export const PLACE_CLOSED_MESSAGE =
  "The place is closed at that time. Pick a time inside its opening hours.";

/**
 *   true  — a shift takes a table at `at`
 *   false — the place has hours and none takes it
 *   null  — no usable hours (or an unreadable clock): the caller lets it through
 */
export function slotInHours(hours: unknown, zone: string | null, at: Date): boolean | null {
  if (!hours || typeof hours !== "object") return null;
  const week = hours as WeeklyHours;
  if (!DAY_KEYS.some((k) => Array.isArray(week[k]) && week[k].length > 0)) return null;
  const clock = localClock(zone, at);
  if (!clock) return null;
  const todayIdx = DAY_KEYS.indexOf(clock.weekday as (typeof DAY_KEYS)[number]);
  if (todayIdx < 0) return null;
  const min = clock.minutes;

  for (const r of week[DAY_KEYS[todayIdx]] ?? []) {
    const o = toMinutes(r?.open);
    const c = toMinutes(r?.close);
    if (o === null || c === null) continue;
    // `close <= open` closes the next day.
    const last = (c > o ? c : c + 1440) - LAST_TABLE_MINUTES;
    if (min >= o && min <= last) return true;
  }
  // Yesterday's overnight shift carries into today's small hours.
  for (const r of week[DAY_KEYS[(todayIdx + 6) % 7]] ?? []) {
    const o = toMinutes(r?.open);
    const c = toMinutes(r?.close);
    if (o === null || c === null) continue;
    if (c <= o && min <= c - LAST_TABLE_MINUTES) return true;
  }
  return false;
}
