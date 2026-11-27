import {
  isSlotPast,
  pad,
  placeDateIso,
  placeDateParts,
  slotMinutes,
  WEEK_KEYS,
} from "@/generated/shared/lib/place-time";

/** One month ahead, on the place's calendar. */
const HORIZON_MONTHS = 1;
const STEP_MINUTES = 30;
const LAST_TABLE_MINUTES = 60;
const NO_RESERVATIONS_BEFORE_MINUTE = 6 * 60;
const ANCHOR_MINUTES = slotMinutes("20:00");
const DAY_MS = 86_400_000;

const BASELINE = ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00", "22:30", "23:00"] as const;

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type DayKey = (typeof WEEK_KEYS)[number];
type HourRange = { open: string; close: string };
export type WeeklyHours = Partial<Record<DayKey, HourRange[]>>;
export type ReservationSlot = { time: string; afterMidnight: boolean };

export type DateOption = {
  iso: string;
  weekday: string;
  day: number;
  month: string;
  disabled: boolean;
};

const DAY_LABEL: Record<string, DayKey> = {
  monday: "monday",
  tuesday: "tuesday",
  wednesday: "wednesday",
  thursday: "thursday",
  friday: "friday",
  saturday: "saturday",
  sunday: "sunday",
};

function parseHhmm(value: string | undefined): number | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes >= 60) return null;
  const total = hours * 60 + minutes;
  return total >= 0 && total <= 1440 ? total : null;
}

function toHhmm(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return `${pad(Math.floor(wrapped / 60))}:${pad(wrapped % 60)}`;
}

function horizonIso(tz?: string | null, at: number = Date.now()): string {
  const [year, month, day] = placeDateIso(0, tz, at).split("-").map(Number);
  const total = month - 1 + HORIZON_MONTHS;
  const nextYear = year + Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
  return `${nextYear}-${pad(nextMonth)}-${pad(Math.min(day, lastDay))}`;
}

export function bookingWindowDays(tz?: string | null, at: number = Date.now()): number {
  const start = Date.parse(`${placeDateIso(0, tz, at)}T00:00:00Z`);
  const end = Date.parse(`${horizonIso(tz, at)}T00:00:00Z`);
  return Math.round((end - start) / DAY_MS) + 1;
}

/** Hours the overview already shows, read back into shifts. Seven "Closed" rows mean unknown. */
export function parseHoursTable(table: Array<{ day: string; range: string }> | null | undefined): WeeklyHours | null {
  if (!table?.length) return null;
  const out: WeeklyHours = {};
  let found = 0;
  for (const entry of table) {
    const key = DAY_LABEL[String(entry.day ?? "").toLowerCase()];
    if (!key) continue;
    const ranges: HourRange[] = [];
    for (const part of String(entry.range ?? "").split(",")) {
      const match = /^\s*(\d{1,2}:\d{2})\s*[–—-]\s*(\d{1,2}:\d{2})\s*$/.exec(part);
      if (!match || parseHhmm(match[1]) == null || parseHhmm(match[2]) == null) continue;
      ranges.push({ open: match[1], close: match[2] });
    }
    if (ranges.length > 0) {
      out[key] = ranges;
      found += ranges.length;
    }
  }
  return found > 0 ? out : null;
}

function windowsForDate(dateIso: string, hours: WeeklyHours): Array<{ from: number; to: number }> {
  const { weekday } = placeDateParts(dateIso);
  const today = WEEK_KEYS[weekday];
  const yesterday = WEEK_KEYS[(weekday + 6) % 7];
  const out: Array<{ from: number; to: number }> = [];
  for (const range of hours[today] ?? []) {
    const open = parseHhmm(range.open);
    const close = parseHhmm(range.close);
    if (open == null || close == null) continue;
    const last = (close > open ? close : close + 1440) - LAST_TABLE_MINUTES;
    if (last >= open) out.push({ from: open, to: Math.min(last, 1439) });
  }
  for (const range of hours[yesterday] ?? []) {
    const open = parseHhmm(range.open);
    const close = parseHhmm(range.close);
    if (open == null || close == null) continue;
    if (close <= open && close - LAST_TABLE_MINUTES >= 0) out.push({ from: 0, to: close - LAST_TABLE_MINUTES });
  }
  return out;
}

export function buildSlots(dateIso: string, hours: WeeklyHours | null | undefined): ReservationSlot[] {
  const minutes = new Set<number>();
  if (hours && dateIso) {
    for (const window of windowsForDate(dateIso, hours)) {
      for (let minute = window.from; minute <= window.to; minute += STEP_MINUTES) minutes.add(minute);
    }
  } else {
    for (const time of BASELINE) minutes.add(slotMinutes(time));
  }
  return [...minutes]
    .filter((minute) => minute >= NO_RESERVATIONS_BEFORE_MINUTE)
    .sort((a, b) => a - b)
    .map((minute) => ({ time: toHhmm(minute), afterMidnight: minute < 6 * 60 }));
}

function futureSlots(dateIso: string, hours: WeeklyHours | null | undefined, tz?: string | null): ReservationSlot[] {
  return buildSlots(dateIso, hours).filter((slot) => !isSlotPast(dateIso, slot.time, tz));
}

export function isDateSpent(dateIso: string, hours: WeeklyHours | null | undefined, tz?: string | null): boolean {
  return futureSlots(dateIso, hours, tz).length === 0;
}

export function buildDateOptions(hours: WeeklyHours | null | undefined, tz?: string | null): DateOption[] {
  const count = bookingWindowDays(tz);
  return Array.from({ length: count }, (_, index) => {
    const iso = placeDateIso(index, tz);
    const parts = placeDateParts(iso);
    return {
      iso,
      weekday: index === 0 ? "Today" : DAY_NAMES[parts.weekday],
      day: parts.day,
      month: MONTH_NAMES[parts.month],
      disabled: isDateSpent(iso, hours, tz),
    };
  });
}

export function resolveSlot(
  dateIso: string,
  preferred: string | null,
  hours?: WeeklyHours | null,
  tz?: string | null,
): string | null {
  const slots = futureSlots(dateIso, hours, tz);
  if (!dateIso || slots.length === 0) return null;
  if (preferred && slots.some((slot) => slot.time === preferred)) return preferred;
  return slots.reduce((best, slot) =>
    Math.abs(slotMinutes(slot.time) - ANCHOR_MINUTES) < Math.abs(slotMinutes(best.time) - ANCHOR_MINUTES) ? slot : best,
  ).time;
}

export function openSlots(dateIso: string, hours: WeeklyHours | null | undefined, tz?: string | null): ReservationSlot[] {
  return futureSlots(dateIso, hours, tz);
}
