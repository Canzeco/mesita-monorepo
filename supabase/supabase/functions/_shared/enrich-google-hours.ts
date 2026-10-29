// Twin of render/src/hours.ts (weeklyHoursFromPeriods, closesAtFromHours), pinned by render-twins.test.ts.
import type { HourRange } from "./local-time.ts";
import { DAY_KEYS } from "./local-time-open.ts";

export type GooglePeriod = {
  open?: { day?: number; hour?: number; minute?: number };
  close?: { day?: number; hour?: number; minute?: number };
};

// Sunday-first day keys and the range shape are local-time's (one home); this
// keeps the stricter day-keyed view of local-time's WeeklyHours.
type DayKey = typeof DAY_KEYS[number];
export type WeeklyHours = Partial<Record<DayKey, HourRange[]>>;

export function weeklyHoursFromPeriods(periods: GooglePeriod[] | undefined): WeeklyHours | null {
  if (!periods || periods.length === 0) return null;
  const out: WeeklyHours = {};
  if (
    periods.length === 1 && periods[0].open && !periods[0].close &&
    (periods[0].open.hour ?? 0) === 0 && (periods[0].open.minute ?? 0) === 0
  ) {
    for (const day of DAY_KEYS) out[day] = [{ open: "00:00", close: "23:59" }];
    return out;
  }
  for (const p of periods) {
    const oDay = p.open?.day;
    if (typeof oDay !== "number" || oDay < 0 || oDay > 6) continue;
    const openStr = hhmm(p.open?.hour, p.open?.minute);
    if (!openStr) continue;
    if (!p.close) {
      pushRange(out, DAY_KEYS[oDay], openStr, "23:59");
      continue;
    }
    const cDay = p.close.day;
    const closeStr = hhmm(p.close.hour, p.close.minute);
    if (typeof cDay !== "number" || !closeStr) continue;
    pushRange(out, DAY_KEYS[oDay], openStr, closeStr);
  }
  return Object.keys(out).length > 0 ? out : null;
}

function hhmm(hour: number | undefined, minute: number | undefined): string | null {
  if (typeof hour !== "number" || hour < 0 || hour > 23) return null;
  const m = typeof minute === "number" && minute >= 0 && minute <= 59 ? minute : 0;
  return `${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function pushRange(hours: WeeklyHours, day: DayKey, open: string, close: string): void {
  (hours[day] ??= []).push({ open, close });
}

export function closesAtFromHours(weekdayDescriptions: string[]): string | null {
  for (const line of weekdayDescriptions) {
    const m = line.match(/[-–—]\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (m) {
      let h = parseInt(m[1], 10);
      const ampm = m[3]?.toUpperCase();
      if (ampm === "PM" && h < 12) h += 12;
      if (ampm === "AM" && h === 12) h = 0;
      return `${String(h).padStart(2, "0")}:${m[2]}`;
    }
  }
  return null;
}
