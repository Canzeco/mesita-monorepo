// Local-time helpers: the Mexico zone for a longitude, the LOCAL wall clock,
// the place-local hour, and the WeeklyHours shape stored on `places.hours`.
//
// The Edge runtime clock is UTC. Deriving a daypart or an "is it open" signal
// from UTC is wrong for our users: at 5am in Mexico (UTC−6) `getUTCHours()`
// reads ~11am and a surface pitches brunch. This module gives callers the
// user's LOCAL wall-clock — the same "when" fix consumer-web-ask-memo shipped
// in PR #211, extracted here so every reader shares one implementation instead
// of re-deriving it. Below it, the open/closed signal over stored weekly
// hours ("demote, don't hide" ranking and the reservation retry).
//
// Timezone is a coarse Mexico-centric mapping by longitude (the market). We do
// NOT read the DB `timezone` column here on purpose — memo established the
// lng-band approach and Intl handles DST; keeping one derivation avoids drift.

// Weekly hours shape stored on `places.hours` (JSONB), normalised from Google
// regularOpeningHours (migrations 0008 + 20252120001). Lowercase English day
// keys; multiple ranges per day cover same-day split shifts (lunch + dinner);
// an overnight shift is a single range on the opening day where `close <= open`
// means the close lands the next day; closed days omit the key.
export type HourRange = { open: string; close: string };
export type WeeklyHours = Record<string, HourRange[]>;

// Coarse Mexico-centric timezone by longitude. Intl handles DST. Falls back to
// Central (Monterrey/CDMX — most of Mexico, and the safest default when we have
// no location). Mirrors consumer-web-ask-memo's `mexicoZone` (PR #211).
export function mexicoZone(lng: number | null): string {
  if (lng === null) return "America/Mexico_City";
  if (lng <= -110) return "America/Tijuana"; // Baja California / far NW (Pacific)
  if (lng >= -89) return "America/Cancun"; // Quintana Roo (UTC−5, no DST)
  return "America/Mexico_City"; // Central — Monterrey, CDMX, most of Mexico
}

// The user's LOCAL wall-clock derived from their longitude, not the UTC Edge
// runtime clock. Returns null on a bad zone so callers keep a neutral default.
export function localClock(
  lng: number | null,
  at: Date = new Date(),
): { weekday: string; hour: number; minutes: number } | null {
  const timeZone = mexicoZone(lng);
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "long",
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(at);
    let weekday = "";
    let hour = 12;
    let minute = 0;
    for (const p of parts) {
      if (p.type === "weekday") weekday = p.value.toLowerCase();
      else if (p.type === "hour") hour = parseInt(p.value, 10) % 24; // "24" at midnight → 0
      else if (p.type === "minute") minute = parseInt(p.value, 10);
    }
    if (!weekday) return null;
    return { weekday, hour, minutes: hour * 60 + minute };
  } catch {
    // Bad zone → let the caller fall back to a neutral default; never throw.
    return null;
  }
}

// Place-local hour (0–23) at a GIVEN instant, for the reservation schedulers.
//
// It answers "what hour would this candidate call land on for the place", and
// its fallback is the UTC hour: a quiet-hours guard that silently read midday
// on a bad zone would authorise a 3 a.m. call, so it degrades to a real (if
// wrong-offset) hour instead of a convenient one.
//
// Was `hourAt`, written identically in reservation-reminder.ts and
// reservation-callback.ts — the two modules that decide when a phone may ring.
export function placeLocalHour(at: Date, lng: number | null): number {
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

// ─── Open or closed ─────────────────────────────────────────────────

/**
 * The day keys of a `WeeklyHours` blob, Sunday-first so the index lines up
 * with `Date.getDay()` and with the weekday `localClock` reports. Exported
 * because reservation-retry.ts walks the same week to find the next opening.
 */
export const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

/**
 * Minutes past midnight from a `"HH:mm"` range bound, or null when the string
 * is not one. `24:00` is allowed on purpose — it is how a day-ending close is
 * stored — so the hour bound is `> 24`, not `> 23`.
 */
export function toMinutes(hhmm: unknown): number | null {
  if (typeof hhmm !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}

// Pure open/closed check at a given local weekday + minute-of-day (read the
// clock with localClock), so the overnight logic is testable without a
// wall clock. `weekday` is a lowercase English day key; `nowMin` is 0–1439.
//   true  — a range covers nowMin (incl. overnight spillover from yesterday)
//   false — hours exist but nothing is open at that minute
//   null  — no usable hours data (caller treats as neutral, never penalised)
export function isOpenAt(
  hours: unknown,
  weekday: string,
  nowMin: number,
): boolean | null {
  if (!hours || typeof hours !== "object") return null;
  const week = hours as WeeklyHours;
  // "Has usable data" = at least one day carries a real range. All-empty (or
  // absent) → null so the place stays neutral rather than looking closed.
  if (!DAY_KEYS.some((k) => Array.isArray(week[k]) && week[k].length > 0)) {
    return null;
  }
  const todayIdx = DAY_KEYS.indexOf(weekday as (typeof DAY_KEYS)[number]);
  if (todayIdx < 0) return null;
  const today = DAY_KEYS[todayIdx];
  const yesterday = DAY_KEYS[(todayIdx + 6) % 7];

  // Today's ranges: same-day (open < close) covers [open, close); overnight
  // (close <= open) is open from `open` through the end of the day.
  for (const r of week[today] ?? []) {
    const o = toMinutes(r?.open);
    const c = toMinutes(r?.close);
    if (o === null || c === null) continue;
    if (o < c) {
      if (nowMin >= o && nowMin < c) return true;
    } else if (nowMin >= o) {
      return true;
    }
  }
  // Yesterday's overnight shift spills into today's [midnight, close).
  for (const r of week[yesterday] ?? []) {
    const o = toMinutes(r?.open);
    const c = toMinutes(r?.close);
    if (o === null || c === null) continue;
    if (c <= o && nowMin < c) return true;
  }
  return false;
}
