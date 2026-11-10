// Local-time helpers: the place's ZONE, its LOCAL wall clock, the place-local
// hour, and the WeeklyHours shape stored on `places.hours`.
//
// The Edge runtime clock is UTC. Deriving a daypart or an "is it open" signal
// from UTC is wrong for our users: at 5am in Mexico (UTC−6) `getUTCHours()`
// reads ~11am and a surface pitches brunch. Below it, the open/closed signal
// over stored weekly hours ("demote, don't hide" ranking and the reservation
// retry).
//
// ONE ZONE PER PLACE (MESITA-3626): `place_profiles.timezone` — the IANA zone
// Create/Enrich stamps from Google's Time Zone API — is the place's clock for
// every reservation decision: the slot the guest picks, the date and hour the
// agents say, when a call may ring, and the day the per-place call meter
// counts. `placeZone` reads it; a row without a usable stamp falls back to
// the old longitude guess (`mexicoZone`), and a row with neither to
// America/Mexico_City. Intl carries the offsets, DST-free Mexican zones
// (Cancún −5, Hermosillo −7) and Tijuana's DST alike.

// Weekly hours shape stored on `places.hours` (JSONB), normalised from Google
// regularOpeningHours (migrations 0008 + 20252120001). Lowercase English day
// keys; multiple ranges per day cover same-day split shifts (lunch + dinner);
// an overnight shift is a single range on the opening day where `close <= open`
// means the close lands the next day; closed days omit the key.
export type HourRange = { open: string; close: string };
export type WeeklyHours = Record<string, HourRange[]>;

/** The zone of last resort: most of Mexico, and the market. */
export const DEFAULT_ZONE = "America/Mexico_City";

// Coarse Mexico-centric timezone by longitude — the FALLBACK when a place has
// no stamped zone (and the backfill's source for old rows, MESITA-3626).
export function mexicoZone(lng: number | null): string {
  if (lng === null) return DEFAULT_ZONE;
  if (lng <= -110) return "America/Tijuana"; // Baja California / far NW (Pacific)
  if (lng >= -89) return "America/Cancun"; // Quintana Roo (UTC−5, no DST)
  return DEFAULT_ZONE; // Central — Monterrey, CDMX, most of Mexico
}

const zoneOk = new Map<string, boolean>();

/** True when `v` is an IANA zone this runtime knows. */
export function isZone(v: unknown): v is string {
  if (typeof v !== "string" || v.trim() === "") return false;
  const z = v.trim();
  let ok = zoneOk.get(z);
  if (ok === undefined) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: z });
      ok = true;
    } catch {
      ok = false;
    }
    zoneOk.set(z, ok);
  }
  return ok;
}

/** A usable zone: `zone` when Intl knows it, else America/Mexico_City. */
export function zoneOr(zone: string | null | undefined): string {
  return isZone(zone) ? zone.trim() : DEFAULT_ZONE;
}

/** THE place's zone: its stamped `timezone`, else the longitude guess. */
export function placeZone(
  place: { timezone?: unknown; lng?: unknown } | null | undefined,
): string {
  if (isZone(place?.timezone)) return (place!.timezone as string).trim();
  return mexicoZone(typeof place?.lng === "number" ? place.lng : null);
}

/** The place_profiles columns `placeZone` reads. */
export const PLACE_ZONE_COLUMNS = "timezone, lng";

/** Wall-clock parts of `at` in `zone` (24h; "24" at midnight folded to 0). */
function wallParts(at: Date, zone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zoneOr(zone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: get("weekday").toLowerCase(),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    second: Number(get("second")),
  };
}

/** Minutes `zone` is ahead of UTC at `at` (Mexico City −360, Cancún −300). */
export function zoneOffsetMinutes(zone: string, at: Date): number {
  const p = wallParts(at, zone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const whole = at.getTime() - (((at.getTime() % 1000) + 1000) % 1000);
  return Math.round((asUtc - whole) / 60_000);
}

/** "YYYY-MM-DD" — the calendar day `at` falls on in `zone`. */
export function zoneDay(at: Date, zone: string): string {
  const p = wallParts(at, zone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** "HH:mm" (24h) — the wall-clock time of `at` in `zone`. */
export function zoneTime(at: Date, zone: string): string {
  const p = wallParts(at, zone);
  return `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
}

/**
 * The instant a place-local "YYYY-MM-DD" + "HH:mm" names in `zone`, or null
 * when the pair doesn't parse. Two passes, so a zone with DST (Tijuana) gets
 * the offset in force at that wall time, not at "now".
 */
export function zonedInstant(date: string, time: string, zone: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const wall = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(wall)) return null;
  const z = zoneOr(zone);
  const guess = wall - zoneOffsetMinutes(z, new Date(wall)) * 60_000;
  return new Date(wall - zoneOffsetMinutes(z, new Date(guess)) * 60_000);
}

/** The first instant of the calendar month `at` falls in, in `zone`. */
export function zoneMonthStart(at: Date, zone: string): Date {
  const day = zoneDay(at, zone);
  return zonedInstant(`${day.slice(0, 8)}01`, "00:00", zone) ?? at;
}

// The place's LOCAL wall clock at `at`. Returns null on a bad zone so callers
// keep a neutral default.
export function localClock(
  zone: string | null,
  at: Date = new Date(),
): { weekday: string; hour: number; minutes: number } | null {
  try {
    const p = wallParts(at, zoneOr(zone));
    if (!p.weekday || !Number.isFinite(p.hour)) return null;
    return { weekday: p.weekday, hour: p.hour, minutes: p.hour * 60 + p.minute };
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
export function placeLocalHour(at: Date, zone: string | null): number {
  try {
    const h = wallParts(at, zoneOr(zone)).hour;
    return Number.isFinite(h) ? h : at.getUTCHours();
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
