// Local-time + open-now helpers shared by the consumer place surfaces.
//
// The Edge runtime clock is UTC. Deriving a daypart or an "is it open" signal
// from UTC is wrong for our users: at 5am in Mexico (UTC−6) `getUTCHours()`
// reads ~11am and a surface pitches brunch. This module gives callers the
// user's LOCAL wall-clock and a live open/closed signal computed from the
// stored weekly hours — the same "when" fix consumer-web-ask-memo shipped in
// PR #211, extracted here so every reader shares one implementation instead of
// re-deriving it.
//
// Timezone is a coarse Mexico-centric mapping by longitude (the market). We do
// NOT read the DB `timezone` column here on purpose — memo established the
// lng-band approach and Intl handles DST; keeping one derivation avoids drift.

// Weekly hours shape stored on `places.hours` (JSONB), normalised from Google
// regularOpeningHours (migrations 0008 + 20252120001). Lowercase English day
// keys; multiple ranges per day cover same-day split shifts (lunch + dinner);
// an overnight shift is a single range on the opening day where `close <= open`
// means the close lands the next day; closed days omit the key.
type HourRange = { open: string; close: string };
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

// Local hour 0–23 for the daypart handle. Defaults to midday on a bad zone so a
// time-of-day flavour never sinks the ranking.
export function localHour(lng: number | null): number {
  return localClock(lng)?.hour ?? 12;
}

export {
  demoteClosed,
  isOpenAt,
  isOpenNow,
  isOpenThrough,
  openScore,
} from "./local-time-open.ts";
