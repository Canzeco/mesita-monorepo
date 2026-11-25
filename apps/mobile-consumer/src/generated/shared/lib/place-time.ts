// The place's clock — the ONE place the consumer app decides what "now" means
// for a reservation.
//
// ONE ZONE PER PLACE (MESITA-3626): every place carries an IANA zone
// (`place.timezone`, stamped from Google), and every slot is that place's
// wall clock — America/Cancun is UTC-5 all year, America/Tijuana follows
// DST, most of Mexico is America/Mexico_City (UTC-6). The offsets come from
// Intl, so a guest sitting in Tokyo sees and books the same slot as one
// sitting in Roma Norte: "is this slot in the past?" is judged against the
// place's clock, never the device's. A place with no usable zone reads as
// Mexico City.

/** The zone of last resort (the market). */
export const DEFAULT_PLACE_TZ = "America/Mexico_City";

const zoneOk = new Map<string, boolean>();

/** `tz` when Intl knows it, else America/Mexico_City. */
export function placeTz(tz: string | null | undefined): string {
  const z = typeof tz === "string" ? tz.trim() : "";
  if (!z) return DEFAULT_PLACE_TZ;
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
  return ok ? z : DEFAULT_PLACE_TZ;
}

/** Minutes `tz` is ahead of UTC at instant `at` (Mexico City −360). */
export function placeOffsetMinutes(tz: string | null | undefined, at: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: placeTz(tz),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(at));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  const whole = at - (((at % 1000) + 1000) % 1000);
  return Math.round((asUtc - whole) / 60_000);
}

/** "-06:00"-style suffix for an offset in minutes. */
function offsetSuffix(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const a = Math.abs(minutes);
  return `${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

/**
 * The `reserved_at` the app sends for a slot the guest picked: the place's
 * `YYYY-MM-DD` + `HH:mm` with THAT zone's offset at that moment, e.g.
 * "2026-11-20T21:00:00-05:00" in Cancún. Two passes, so a DST zone gets the
 * offset in force at the slot, not at "now".
 */
export function placeInstantIso(dateIso: string, hhmm: string, tz?: string | null): string {
  const wall = Date.parse(`${dateIso}T${hhmm}:00Z`);
  if (!Number.isFinite(wall)) return `${dateIso}T${hhmm}:00${offsetSuffix(-360)}`;
  const guess = wall - placeOffsetMinutes(tz, wall) * 60_000;
  const offset = placeOffsetMinutes(tz, guess);
  return `${dateIso}T${hhmm}:00${offsetSuffix(offset)}`;
}

/** Zero-pad to two digits — the one copy for clock and date strings. */
export function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Sunday-first to match `placeDateParts().weekday` / JS `getDay()`. */
export const WEEK_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

/** Shift an instant into place wall-clock, readable through the UTC getters. */
function placeClock(at: number, tz?: string | null): Date {
  return new Date(at + placeOffsetMinutes(tz, at) * 60_000);
}

/**
 * The place's wall clock right now: the ISO date it is *there*, plus minutes
 * since its midnight. Built by shifting the epoch and reading UTC parts, so
 * the caller's own timezone can't leak into the answer.
 */
function placeNow(at: number = Date.now(), tz?: string | null): {
  iso: string;
  minutes: number;
} {
  const t = placeClock(at, tz);
  return {
    iso: `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`,
    minutes: t.getUTCHours() * 60 + t.getUTCMinutes(),
  };
}

/** `YYYY-MM-DD` for the place's today, or `offsetDays` days after it. */
export function placeDateIso(
  offsetDays = 0,
  tz?: string | null,
  at: number = Date.now(),
): string {
  const t = placeClock(at, tz);
  t.setUTCDate(t.getUTCDate() + offsetDays);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/**
 * Calendar parts of a `YYYY-MM-DD` place date. Parsed as UTC midnight so the
 * device timezone can't shift the weekday by a day.
 */
export function placeDateParts(iso: string): {
  weekday: number;
  day: number;
  month: number;
} {
  const d = new Date(`${iso}T00:00:00Z`);
  return {
    weekday: d.getUTCDay(),
    day: d.getUTCDate(),
    month: d.getUTCMonth(),
  };
}

/** Minutes since midnight for an `HH:mm` slot. */
export function slotMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
}

/** A label's trailing `HH:mm` on the 12-hour clock: "15:00" → "3 PM", "tomorrow
 *  08:30" → "tomorrow 8:30 AM", "24:00" → "12 AM". Anything else stays as it is. */
export function toAmPm(label: string): string {
  return label.replace(/(\d{1,2}):(\d{2})$/, (_, hh: string, mm: string) => {
    const h = Number(hh) % 24;
    const minutes = mm === "00" ? "" : `:${mm}`;
    return `${h % 12 || 12}${minutes} ${h < 12 ? "AM" : "PM"}`;
  });
}

/**
 * Is `hhmm` on `dateIso` already behind the place's clock? ISO dates sort
 * lexicographically, so the day comparison needs no parsing. The current
 * minute counts as gone — you can't book 19:00 at 19:00.
 */
export function isSlotPast(
  dateIso: string,
  hhmm: string,
  tz?: string | null,
  at: number = Date.now(),
): boolean {
  if (!dateIso) return false;
  const now = placeNow(at, tz);
  if (dateIso > now.iso) return false;
  if (dateIso < now.iso) return true;
  return slotMinutes(hhmm) <= now.minutes;
}

/**
 * Split a stored instant back into the place's date + `HH:mm` — the shape the
 * pickers speak. Used to seed a reschedule from the existing booking.
 */
export function placeDateTime(
  iso: string,
  tz?: string | null,
): { date: string; time: string } | null {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  const t = placeClock(parsed.getTime(), tz);
  return {
    date: `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`,
    time: `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`,
  };
}
