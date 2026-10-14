// Google's opening periods, in the shape the profile door stores.

export type GooglePeriod = {
  open?: { day?: number; hour?: number; minute?: number };
  close?: { day?: number; hour?: number; minute?: number };
};

type DayKey =
  | "sunday"
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday";

const DAY_KEYS: DayKey[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export type WeeklyHours = Partial<Record<DayKey, { open: string; close: string }[]>>;

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
  for (const period of periods) {
    const openDay = period.open?.day;
    if (typeof openDay !== "number" || openDay < 0 || openDay > 6) continue;
    const open = hhmm(period.open?.hour, period.open?.minute);
    if (!open) continue;
    if (!period.close) {
      push(out, DAY_KEYS[openDay], open, "23:59");
      continue;
    }
    const close = hhmm(period.close.hour, period.close.minute);
    if (typeof period.close.day !== "number" || !close) continue;
    push(out, DAY_KEYS[openDay], open, close);
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function closesAtFromHours(weekdayDescriptions: string[] | undefined): string | null {
  for (const line of weekdayDescriptions ?? []) {
    const match = line.match(/[-–—]\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) continue;
    let hour = parseInt(match[1], 10);
    const ampm = match[3]?.toUpperCase();
    if (ampm === "PM" && hour < 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${match[2]}`;
  }
  return null;
}

function hhmm(hour: number | undefined, minute: number | undefined): string | null {
  if (typeof hour !== "number" || hour < 0 || hour > 23) return null;
  const m = typeof minute === "number" && minute >= 0 && minute <= 59 ? minute : 0;
  return `${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function push(hours: WeeklyHours, day: DayKey, open: string, close: string): void {
  (hours[day] ??= []).push({ open, close });
}
