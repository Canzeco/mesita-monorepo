import type { PlaceHours } from "@/lib/api/places";

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type HoursRange = { open: string; close: string };
export type DayShifts = { ranges: HoursRange[]; closed: boolean };

export const PLACE_HOUR_DAYS: {
  key: DayKey;
  label: string;
  long: keyof PlaceHours;
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

const MAX_SHIFTS_PER_DAY = 1;

function mergeOvernightSplit(h: PlaceHours): PlaceHours {
  const longKeys = PLACE_HOUR_DAYS.map((d) => d.long);
  const out: PlaceHours = {};
  for (const k of longKeys) {
    const arr = h[k];
    if (arr) out[k] = arr.map((r) => ({ open: r.open, close: r.close }));
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < longKeys.length; i += 1) {
      const a = longKeys[i];
      const b = longKeys[(i + 1) % longKeys.length];
      const aRanges = out[a];
      const bRanges = out[b];
      if (
        !aRanges ||
        !bRanges ||
        aRanges.length === 0 ||
        bRanges.length === 0
      ) {
        continue;
      }
      const tailIdx = aRanges.findIndex(
        (r) => r.close === "23:59" && r.open !== "00:00",
      );
      const headIdx = bRanges.findIndex(
        (r) => r.open === "00:00" && r.close !== "23:59",
      );
      if (tailIdx < 0 || headIdx < 0) continue;
      aRanges[tailIdx] = {
        open: aRanges[tailIdx].open,
        close: bRanges[headIdx].close,
      };
      bRanges.splice(headIdx, 1);
      if (bRanges.length === 0) delete out[b];
      changed = true;
    }
  }
  return out;
}

export function placeHoursToForm(
  h: PlaceHours | null,
): Record<DayKey, DayShifts> {
  const merged = h ? mergeOvernightSplit(h) : null;
  const out = {} as Record<DayKey, DayShifts>;
  for (const d of PLACE_HOUR_DAYS) {
    const ranges = merged?.[d.long] ?? null;
    if (ranges === null) {
      out[d.key] = { ranges: [{ open: "", close: "" }], closed: false };
    } else if (ranges.length === 0) {
      out[d.key] = { ranges: [], closed: true };
    } else {
      out[d.key] = {
        ranges: ranges.slice(0, MAX_SHIFTS_PER_DAY).map((r) => ({
          open: r.open,
          close: r.close,
        })),
        closed: false,
      };
    }
  }
  return out;
}

export function formHoursToPlace(form: Record<DayKey, DayShifts>): PlaceHours {
  const out: PlaceHours = {};
  for (const d of PLACE_HOUR_DAYS) {
    const v = form[d.key];
    if (v.closed) continue;
    const clean = v.ranges
      .map((r) => ({ open: r.open.trim(), close: r.close.trim() }))
      .filter((r) => r.open && r.close);
    if (clean.length > 0) out[d.long] = clean;
  }
  return out;
}
