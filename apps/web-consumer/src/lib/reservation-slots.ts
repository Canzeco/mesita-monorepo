// Which times a guest may request, and whether the place's hours say it is
// actually open then.
//
// The rule (Pato, 2026-08-04): a guest is NEVER blocked from requesting a time.
// Hours come from Google via enrichment and are routinely missing, stale, or
// wrong, and Mesita books by calling the place anyway — so out-of-hours slots
// stay tappable and the sheet warns instead of refusing. Hard-blocking would
// leave zero bookable slots on every place whose hours we never scraped.
//
// Slots are the union of two sources:
//   1. BASELINE_SLOTS — the normal service window, always offered so a request
//      is possible even when the place is closed all day or has no hours.
//   2. The place's own open windows for that date, sampled every 30 min. This
//      is what lets a 23:00–02:00 venue be booked at 00:30 at all.
//
// Times are place-local wall clock, judged against the venue clock in
// @/lib/venue-time. Every Mesita venue is in Mexico (Monterrey and CDMX are
// both UTC-6 year round), so place-local hours and the fixed GMT-6 reservation
// offset describe the same wall clock.
// Mirror: apps/mobile-consumer/src/lib/reservation-slots.ts (keep in sync).

import { isSlotPast, slotMinutes, venueDateParts } from "@/lib/venue-time";

/** 30-min slots from 6pm to 11pm — the realistic dinner window. */
export const BASELINE_SLOTS = [
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
];

/**
 * The hour a guest most likely means. When their pick is gone (or they haven't
 * picked), the nearest slot to this wins — so a 23:00–02:00 venue defaults to
 * 23:00, not to 00:00 in the small hours of the same date.
 */
const ANCHOR_MINUTES = slotMinutes("20:00");

const STEP_MINUTES = 30;

/** Sunday-first to match `venueDateParts().weekday` / JS `getDay()`. */
const WEEK_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type DayKey = (typeof WEEK_KEYS)[number];

/** One shift, `HH:mm`. `close <= open` means it closes the NEXT day. */
export type HourRange = { open: string; close: string };

/** The `hours` jsonb shape: day key → shifts. Missing key = closed that day. */
export type WeeklyHours = Partial<Record<DayKey, HourRange[]>>;

/**
 * `open`    — the place's hours cover this slot.
 * `closed`  — we have hours for this place and they do NOT cover it.
 * `unknown` — no usable hours; say nothing rather than guess.
 */
export type SlotState = "open" | "closed" | "unknown";

export type ReservationSlot = {
  time: string;
  state: SlotState;
  /** Before 06:00 — belongs to this date, but reads as "last night". */
  afterMidnight: boolean;
};

const DAY_LABEL_TO_KEY: Record<string, DayKey> = {
  monday: "monday",
  tuesday: "tuesday",
  wednesday: "wednesday",
  thursday: "thursday",
  friday: "friday",
  saturday: "saturday",
  sunday: "sunday",
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toHhmm(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

function parseHhmm(t: string | undefined): number | null {
  if (typeof t !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  if (!m) return null;
  const min = Number(m[1]) * 60 + Number(m[2]);
  return min >= 0 && min < 1440 ? min : null;
}

/**
 * Rebuild `WeeklyHours` from `PlaceDetail.hours_table`, the only hours shape a
 * consumer surface actually holds (`hoursTable()` in the place-detail adapter
 * renders each day as `HH:mm–HH:mm`, comma-joined for split shifts, or
 * "Closed"). Kept tolerant of any dash.
 *
 * Returns null when nothing parses — a place with no `hours` row produces a
 * table of seven "Closed" strings, which must read as "we don't know", not as
 * "closed all week". Warning on every un-enriched place would be pure noise.
 */
export function parseHoursTable(
  table: Array<{ day: string; range: string }> | undefined | null,
): WeeklyHours | null {
  if (!Array.isArray(table) || table.length === 0) return null;
  const out: WeeklyHours = {};
  let found = 0;
  for (const entry of table) {
    const key = DAY_LABEL_TO_KEY[String(entry?.day ?? "").toLowerCase()];
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

/** Shifts that put minutes on `dateIso`, as ranges in that date's minutes. */
function windowsForDate(
  dateIso: string,
  hours: WeeklyHours,
): Array<{ from: number; to: number }> {
  const { weekday } = venueDateParts(dateIso);
  const todayKey = WEEK_KEYS[weekday];
  const yesterdayKey = WEEK_KEYS[(weekday + 6) % 7];
  const out: Array<{ from: number; to: number }> = [];

  for (const r of hours[todayKey] ?? []) {
    const o = parseHhmm(r.open);
    const c = parseHhmm(r.close);
    if (o == null || c == null) continue;
    // Half-open [open, close): you can't be seated at closing time.
    out.push({ from: o, to: c > o ? c : 1440 });
  }
  // Yesterday's overnight shift spills into this date's small hours.
  for (const r of hours[yesterdayKey] ?? []) {
    const o = parseHhmm(r.open);
    const c = parseHhmm(r.close);
    if (o == null || c == null) continue;
    if (c <= o && c > 0) out.push({ from: 0, to: c });
  }
  return out;
}

/** Do the place's hours cover `hhmm` on `dateIso`? */
export function slotState(
  dateIso: string,
  hhmm: string,
  hours: WeeklyHours | null | undefined,
): SlotState {
  if (!hours || !dateIso) return "unknown";
  const min = parseHhmm(hhmm);
  if (min == null) return "unknown";
  const covered = windowsForDate(dateIso, hours).some(
    (w) => min >= w.from && min < w.to,
  );
  return covered ? "open" : "closed";
}

/**
 * Every slot offerable on `dateIso`, ascending. The baseline window plus the
 * place's real open windows, so the grid is never empty and never hides a time
 * the place is genuinely open.
 */
export function buildSlots(
  dateIso: string,
  hours: WeeklyHours | null | undefined,
): ReservationSlot[] {
  const minutes = new Set(BASELINE_SLOTS.map(slotMinutes));
  if (hours && dateIso) {
    for (const w of windowsForDate(dateIso, hours)) {
      for (let m = w.from; m < w.to; m += STEP_MINUTES) minutes.add(m);
    }
  }
  return [...minutes]
    .sort((a, b) => a - b)
    .map((m) => {
      const time = toHhmm(m);
      return {
        time,
        state: slotState(dateIso, time, hours),
        afterMidnight: m < 6 * 60,
      };
    });
}

/** Slots still ahead of the venue's clock. */
function futureSlots(
  dateIso: string,
  hours: WeeklyHours | null | undefined,
): ReservationSlot[] {
  return buildSlots(dateIso, hours).filter((s) => !isSlotPast(dateIso, s.time));
}

/** Is every slot on this date behind the venue's clock? */
export function isDateSpent(
  dateIso: string,
  hours: WeeklyHours | null | undefined,
): boolean {
  return futureSlots(dateIso, hours).length === 0;
}

/**
 * The slot to actually use for `dateIso`. An explicit pick is honoured whenever
 * it's still bookable — including a deliberately closed one, which is the whole
 * point of warning instead of blocking. Otherwise the slot nearest the dinner
 * anchor, preferring ones the place is open for. Null when the day is spent.
 */
export function resolveSlot(
  dateIso: string,
  preferred: string | null,
  hours?: WeeklyHours | null,
): string | null {
  if (!dateIso) return null;
  const slots = futureSlots(dateIso, hours);
  if (slots.length === 0) return null;
  if (preferred && slots.some((s) => s.time === preferred)) return preferred;

  const bookable = slots.filter((s) => s.state !== "closed");
  const pool = bookable.length > 0 ? bookable : slots;
  return pool.reduce((best, s) =>
    Math.abs(slotMinutes(s.time) - ANCHOR_MINUTES) <
    Math.abs(slotMinutes(best.time) - ANCHOR_MINUTES)
      ? s
      : best,
  ).time;
}

/** "23:00–02:00" / "13:00–15:00, 19:00–23:00" for the date, or null. */
export function hoursLabelForDate(
  dateIso: string,
  hours: WeeklyHours | null | undefined,
): string | null {
  if (!hours || !dateIso) return null;
  const { weekday } = venueDateParts(dateIso);
  const ranges = hours[WEEK_KEYS[weekday]] ?? [];
  if (ranges.length === 0) return null;
  return ranges.map((r) => `${r.open}–${r.close}`).join(", ");
}

/** Full weekday name for `dateIso` — used in the closed-slot warning. */
export function weekdayName(dateIso: string): string {
  const key = WEEK_KEYS[venueDateParts(dateIso).weekday];
  return key.charAt(0).toUpperCase() + key.slice(1);
}
