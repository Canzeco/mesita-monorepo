// The venue's clock — the ONE place the consumer app decides what "now" means
// for a reservation.
//
// Every Mesita venue is in Mexico City, which sits at UTC-6 all year (no DST
// since 2022), so a fixed offset is exact: no Intl timezone database, no
// per-device drift, and the same answer for a guest sitting in Tokyo as for
// one sitting in Roma Norte. That matters — "is this slot in the past?" must
// be judged against the venue's wall clock, never the device's.
//
// Everything below is derived from MX_OFFSET. Do NOT introduce a second
// offset constant anywhere; import this one.
// Mirror: apps/mobile-consumer/src/lib/place-time.ts (keep the two in sync).

/** Wall-clock offset stamped onto every `reserved_at` the app sends. */
export const MX_OFFSET = "-06:00";

/** Shown to the guest so the slot list is never ambiguous. */
export const VENUE_TZ_LABEL = "Mexico City time (GMT-6)";

/** MX_OFFSET as signed minutes east of UTC — parsed, never re-typed. */
const OFFSET_MINUTES = (() => {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(MX_OFFSET);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
})();

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Shift an instant into venue wall-clock, readable through the UTC getters. */
function venueClock(at: number): Date {
  return new Date(at + OFFSET_MINUTES * 60_000);
}

/**
 * The venue's wall clock right now: the ISO date it is *there*, plus minutes
 * since its midnight. Built by shifting the epoch and reading UTC parts, so
 * the caller's own timezone can't leak into the answer.
 */
function venueNow(at: number = Date.now()): {
  iso: string;
  minutes: number;
} {
  const t = venueClock(at);
  return {
    iso: `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`,
    minutes: t.getUTCHours() * 60 + t.getUTCMinutes(),
  };
}

/** `YYYY-MM-DD` for the venue's today, or `offsetDays` days after it. */
export function venueDateIso(offsetDays = 0, at: number = Date.now()): string {
  const t = venueClock(at);
  t.setUTCDate(t.getUTCDate() + offsetDays);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/**
 * Calendar parts of a `YYYY-MM-DD` venue date. Parsed as UTC midnight so the
 * device timezone can't shift the weekday by a day.
 */
export function venueDateParts(iso: string): {
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

/**
 * Is `hhmm` on `dateIso` already behind the venue's clock? ISO dates sort
 * lexicographically, so the day comparison needs no parsing. The current
 * minute counts as gone — you can't book 19:00 at 19:00.
 */
export function isSlotPast(
  dateIso: string,
  hhmm: string,
  at: number = Date.now(),
): boolean {
  if (!dateIso) return false;
  const now = venueNow(at);
  if (dateIso > now.iso) return false;
  if (dateIso < now.iso) return true;
  return slotMinutes(hhmm) <= now.minutes;
}

/**
 * Split a stored instant back into the venue's date + `HH:mm` — the shape the
 * pickers speak. Used to seed a reschedule from the existing booking.
 */
export function venueDateTime(
  iso: string,
): { date: string; time: string } | null {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  const t = venueClock(parsed.getTime());
  return {
    date: `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`,
    time: `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`,
  };
}
