export type HoursRange = { open: string; close: string };

export type DayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export type PlaceHours = Partial<Record<DayKey, HoursRange[]>>;

export const DAY_KEYS: DayKey[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const HHMM_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

// "invalid" is the only failure sentinel so the caller can return a single
// 400. Null means the business intentionally cleared their hours. Empty object
// is permitted — the place is open zero days.
export function sanitiseHours(v: unknown): PlaceHours | null | "invalid" {
  if (v == null) return null;
  if (typeof v !== "object" || Array.isArray(v)) return "invalid";
  const input = v as Record<string, unknown>;
  const out: PlaceHours = {};
  for (const day of DAY_KEYS) {
    if (!(day in input)) continue;
    const ranges = input[day];
    if (ranges == null) continue;
    if (!Array.isArray(ranges)) return "invalid";
    const cleanRanges: HoursRange[] = [];
    for (const r of ranges) {
      if (!r || typeof r !== "object") return "invalid";
      const open = (r as { open?: unknown }).open;
      const close = (r as { close?: unknown }).close;
      if (typeof open !== "string" || typeof close !== "string") {
        return "invalid";
      }
      if (!HHMM_RE.test(open) || !HHMM_RE.test(close)) return "invalid";
      cleanRanges.push({ open, close });
    }
    if (cleanRanges.length > 0) out[day] = cleanRanges;
  }
  return out;
}
