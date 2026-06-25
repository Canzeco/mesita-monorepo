import type { VenueHours } from "@/lib/api/venues";

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type HoursRange = { open: string; close: string };
export type DayShifts = { ranges: HoursRange[]; closed: boolean };

export const PLACE_HOUR_DAYS: {
  key: DayKey;
  label: string;
  long: keyof VenueHours;
}[] = [
  { key: "mon", label: "Mon", long: "monday" },
  { key: "tue", label: "Tue", long: "tuesday" },
  { key: "wed", label: "Wed", long: "wednesday" },
  { key: "thu", label: "Thu", long: "thursday" },
  { key: "fri", label: "Fri", long: "friday" },
  { key: "sat", label: "Sat", long: "saturday" },
  { key: "sun", label: "Sun", long: "sunday" },
];

const HHMM_RE = /^\d{2}:\d{2}$/;

/** Close time is on the next calendar day (e.g. 23:00 → 02:00). */
export function isOvernightHours(open: string, close: string): boolean {
  if (!HHMM_RE.test(open) || !HHMM_RE.test(close)) return false;
  return close <= open;
}
