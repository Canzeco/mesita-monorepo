// Which times a guest may request.
//
// The rule (Pato, 2026-11-14, MESITA-3951): "respect the closed hours. lets
// minimize false positives rather than false negatives". When Mesita holds
// hours for the place, the form offers ONLY times inside them, and stops one
// hour before closing: a time we are unsure of is left out rather than
// offered. This reverses the 2026-08-04 rule that never blocked a time and
// warned instead.
//
// A place with no usable hours has nothing to respect: it keeps
// BASELINE_SLOTS, the normal dinner window, so it stays bookable.
//
// Times are place-local wall clock, judged against the place's clock in its
// own zone (@mesita/place-profile/lib/place-time, MESITA-3626): the place's
// hours, the slots and the reserved_at the app sends all speak one clock.

import {
  isSlotPast,
  pad,
  slotMinutes,
  placeDateIso,
  placeDateParts,
  WEEK_KEYS,
} from "@mesita/place-profile/lib/place-time";

/**
 * How far ahead a table can be requested: ONE calendar month, and no more.
 *
 * Product constraint (Pato, 2026-08-04) — mirrored in Notion → Reservations.
 * Mesita books by phoning the place, and no place will hold a table further out
 * than a month; scraped hours aren't meaningful that far ahead either. The pill
 * count is DERIVED from this rather than passed in, so no surface can widen its
 * own window.
 */
export const BOOKING_HORIZON_MONTHS = 1;

/** 30-min slots from 6pm to 11pm: what a place with no hours offers. */
const BASELINE_SLOTS = [
  "18:00",
  "18:30",
  "19:00",
  "19:30",
  "20:00",
  "20:30",
  "21:00",
  "21:30",
  "22:00",
  "22:30",
  "23:00",
] as const;

/**
 * The hour a guest most likely means. When their pick is gone (or they haven't
 * picked), the nearest slot to this wins — so a 23:00–02:00 place defaults to
 * 23:00, not to 00:00 in the small hours of the same date.
 */
const ANCHOR_MINUTES = slotMinutes("20:00");

const STEP_MINUTES = 30;

/**
 * The last table: the latest time offered is this long before closing. A
 * kitchen rarely seats a table as it shuts, so those times are left out.
 */
const LAST_TABLE_MINUTES = 60;
const MS_PER_DAY = 86_400_000;
/** No table before 06:00 on the place's clock (MESITA-4185, Pato: "from 0 am
 *  to 6 am just don't enable reservations nowhere"). Twin of the server's
 *  NO_RESERVATIONS_BEFORE_MINUTE (_shared/reservation-hours.ts). */
const NO_RESERVATIONS_BEFORE_MINUTE = 6 * 60;

type DayKey = (typeof WEEK_KEYS)[number];

/** One shift, `HH:mm`. `close <= open` means it closes the NEXT day. */
type HourRange = { open: string; close: string };

/** The `hours` jsonb shape: day key → shifts. Missing key = closed that day. */
export type WeeklyHours = Partial<Record<DayKey, HourRange[]>>;

export type ReservationSlot = {
  time: string;
  /** Before 06:00. Since MESITA-4185 never offered (no table 00:00–06:00);
 *  kept so callers that still read it compile. */
  afterMidnight: boolean;
};

const DAY_LABEL_TO_KEY = {
  monday: "monday",
  tuesday: "tuesday",
  wednesday: "wednesday",
  thursday: "thursday",
  friday: "friday",
  saturday: "saturday",
  sunday: "sunday",
} as const satisfies Record<string, DayKey>;

function toHhmm(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/**
 * The last place date a guest may book: today + BOOKING_HORIZON_MONTHS, with the
 * day clamped to the target month's length so Jan 31 lands on Feb 28/29 instead
 * of overflowing into March.
 */
function horizonDateIso(tz?: string | null, at: number = Date.now()): string {
  const [y, m, d] = placeDateIso(0, tz, at).split("-").map(Number);
  const total = m - 1 + BOOKING_HORIZON_MONTHS;
  const year = y + Math.floor(total / 12);
  const month = (total % 12) + 1;
  // Day 0 of the following month == the last day of `month`.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(Math.min(d, lastDay))}`;
}

/** Day pills to render: today through the horizon, inclusive. */
export function bookingWindowDays(tz?: string | null, at: number = Date.now()): number {
  const start = Date.parse(`${placeDateIso(0, tz, at)}T00:00:00Z`);
  const end = Date.parse(`${horizonDateIso(tz, at)}T00:00:00Z`);
  return Math.round((end - start) / MS_PER_DAY) + 1;
}

function parseHhmm(t: string | undefined): number | null {
  if (typeof t !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || mm >= 60) return null;
  const min = hh * 60 + mm;
  // 24:00 is how a day-ending close is stored.
  return min >= 0 && min <= 1440 ? min : null;
}

/**
 * `WeeklyHours` from the raw `hours` a reservation's place carries (the
 * server's jsonb, MESITA-3953). Null when no day holds a readable shift, which
 * reads as "we don't know", never as "closed all week".
 */
export function weeklyHoursFrom(raw: unknown): WeeklyHours | null {
  if (!raw || typeof raw !== "object") return null;
  const out: WeeklyHours = {};
  let found = 0;
  for (const key of WEEK_KEYS) {
    const list = (raw as Record<string, unknown>)[key];
    if (!Array.isArray(list)) continue;
    const ranges: HourRange[] = [];
    for (const r of list) {
      const open = (r as { open?: unknown } | null)?.open;
      const close = (r as { close?: unknown } | null)?.close;
      if (typeof open !== "string" || typeof close !== "string") continue;
      if (parseHhmm(open) == null || parseHhmm(close) == null) continue;
      ranges.push({ open, close });
    }
    if (ranges.length > 0) {
      out[key] = ranges;
      found += ranges.length;
    }
  }
  return found > 0 ? out : null;
}

/**
 * Rebuild `WeeklyHours` from `PlaceDetail.hours_table`, the only hours shape a
 * consumer surface actually holds (`hoursTable()` in the place-detail adapter
 * renders each day as `HH:mm–HH:mm`, comma-joined for split shifts, or
 * "Closed"). Kept tolerant of any dash.
 *
 * Returns null when nothing parses — a place with no `hours` row produces a
 * table of seven "Closed" strings, which must read as "we don't know", not as
 * "closed all week": that would leave every un-enriched place unbookable.
 */
export function parseHoursTable(
  table: Array<{ day: string; range: string }> | undefined | null,
): WeeklyHours | null {
  if (!Array.isArray(table) || table.length === 0) return null;
  const out: WeeklyHours = {};
  let found = 0;
  for (const entry of table) {
    const label = String(entry?.day ?? "").toLowerCase();
    const key =
      label in DAY_LABEL_TO_KEY
        ? DAY_LABEL_TO_KEY[label as keyof typeof DAY_LABEL_TO_KEY]
        : undefined;
    if (!key) continue;
    const ranges: HourRange[] = [];
    for (const part of String(entry?.range ?? "").split(",")) {
      const m = /^\s*(\d{1,2}:\d{2})\s*[–—-]\s*(\d{1,2}:\d{2})\s*$/.exec(part);
      if (!m) continue;
      if (parseHhmm(m[1]) == null || parseHhmm(m[2]) == null) continue;
      ranges.push({ open: m[1], close: m[2] });
    }
    if (ranges.length > 0) {
      out[key] = ranges;
      found += ranges.length;
    }
  }
  return found > 0 ? out : null;
}

/**
 * The bookable minutes each shift puts on `dateIso`, both ends inclusive:
 * from opening to LAST_TABLE_MINUTES before closing.
 */
function windowsForDate(
  dateIso: string,
  hours: WeeklyHours,
): Array<{ from: number; to: number }> {
  const { weekday } = placeDateParts(dateIso);
  const todayKey = WEEK_KEYS[weekday];
  const yesterdayKey = WEEK_KEYS[(weekday + 6) % 7];
  const out: Array<{ from: number; to: number }> = [];

  for (const r of hours[todayKey] ?? []) {
    const o = parseHhmm(r.open);
    const c = parseHhmm(r.close);
    if (o == null || c == null) continue;
    // `close <= open` closes the next day; this date keeps up to 23:59.
    const last = (c > o ? c : c + 1440) - LAST_TABLE_MINUTES;
    if (last >= o) out.push({ from: o, to: Math.min(last, 1439) });
  }
  // Yesterday's overnight shift spills into this date's small hours.
  for (const r of hours[yesterdayKey] ?? []) {
    const o = parseHhmm(r.open);
    const c = parseHhmm(r.close);
    if (o == null || c == null) continue;
    if (c <= o && c - LAST_TABLE_MINUTES >= 0) {
      out.push({ from: 0, to: c - LAST_TABLE_MINUTES });
    }
  }
  return out;
}

/**
 * Every slot offerable on `dateIso`, ascending. With hours: only the place's
 * open windows, so a closed day has none. Without: the baseline window.
 */
export function buildSlots(
  dateIso: string,
  hours: WeeklyHours | null | undefined,
): ReservationSlot[] {
  const minutes = new Set<number>();
  if (hours && dateIso) {
    for (const w of windowsForDate(dateIso, hours)) {
      for (let m = w.from; m <= w.to; m += STEP_MINUTES) minutes.add(m);
    }
  } else {
    for (const t of BASELINE_SLOTS) minutes.add(slotMinutes(t));
  }
  // 00:00–06:00 is never booked (MESITA-4185); the place's hours still show.
  return [...minutes]
    .filter((m) => m >= NO_RESERVATIONS_BEFORE_MINUTE)
    .sort((a, b) => a - b)
    .map((m) => ({ time: toHhmm(m), afterMidnight: m < 6 * 60 }));
}

/** Slots still ahead of the place's clock. */
function futureSlots(
  dateIso: string,
  hours: WeeklyHours | null | undefined,
  tz?: string | null,
): ReservationSlot[] {
  return buildSlots(dateIso, hours).filter((s) => !isSlotPast(dateIso, s.time, tz));
}

/** Has this date nothing to offer: the place is closed, or every slot is past? */
export function isDateSpent(
  dateIso: string,
  hours: WeeklyHours | null | undefined,
  tz?: string | null,
): boolean {
  return futureSlots(dateIso, hours, tz).length === 0;
}

/**
 * The slot to actually use for `dateIso`: the guest's pick while it is still
 * offered, otherwise the slot nearest the dinner anchor. Null when the day
 * has nothing to offer. `held` is the table being moved: its own time is kept
 * even when it is off the grid (the place gave 21:15), so changing only the
 * party size never moves it.
 */
export function resolveSlot(
  dateIso: string,
  preferred: string | null,
  hours?: WeeklyHours | null,
  tz?: string | null,
  held?: { date: string; time: string } | null,
): string | null {
  if (!dateIso) return null;
  if (
    held &&
    preferred === held.time &&
    dateIso === held.date &&
    !isSlotPast(dateIso, held.time, tz)
  ) {
    return held.time;
  }
  const slots = futureSlots(dateIso, hours, tz);
  if (slots.length === 0) return null;
  if (preferred && slots.some((s) => s.time === preferred)) return preferred;

  return slots.reduce((best, s) =>
    Math.abs(slotMinutes(s.time) - ANCHOR_MINUTES) <
    Math.abs(slotMinutes(best.time) - ANCHOR_MINUTES)
      ? s
      : best,
  ).time;
}
