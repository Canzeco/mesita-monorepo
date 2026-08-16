// Open/closed helpers for place ranking ("demote, don't hide").
// Extracted from local-time.ts (pure open-state logic over weekly hours).

import { localClock, type WeeklyHours } from "./local-time.ts";

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

function toMinutes(hhmm: unknown): number | null {
  if (typeof hhmm !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}

// Pure open/closed check at a given local weekday + minute-of-day. Split out
// from isOpenNow so the overnight logic is deterministically testable (no
// wall-clock). `weekday` is a lowercase English day key; `nowMin` is 0–1439.
//   true  — a range covers nowMin (incl. overnight spillover from yesterday)
//   false — hours exist but nothing is open at that minute
//   null  — no usable hours data (caller treats as neutral, never penalised)
export function isOpenAt(
  hours: unknown,
  weekday: string,
  nowMin: number,
): boolean | null {
  if (!hours || typeof hours !== "object") return null;
  const week = hours as WeeklyHours;
  // "Has usable data" = at least one day carries a real range. All-empty (or
  // absent) → null so the place stays neutral rather than looking closed.
  if (!DAY_KEYS.some((k) => Array.isArray(week[k]) && week[k].length > 0)) {
    return null;
  }
  const todayIdx = DAY_KEYS.indexOf(weekday as (typeof DAY_KEYS)[number]);
  if (todayIdx < 0) return null;
  const today = DAY_KEYS[todayIdx];
  const yesterday = DAY_KEYS[(todayIdx + 6) % 7];

  // Today's ranges: same-day (open < close) covers [open, close); overnight
  // (close <= open) is open from `open` through the end of the day.
  for (const r of week[today] ?? []) {
    const o = toMinutes(r?.open);
    const c = toMinutes(r?.close);
    if (o === null || c === null) continue;
    if (o < c) {
      if (nowMin >= o && nowMin < c) return true;
    } else if (nowMin >= o) {
      return true;
    }
  }
  // Yesterday's overnight shift spills into today's [midnight, close).
  for (const r of week[yesterday] ?? []) {
    const o = toMinutes(r?.open);
    const c = toMinutes(r?.close);
    if (o === null || c === null) continue;
    if (c <= o && nowMin < c) return true;
  }
  return false;
}

// Live open/closed state computed from stored weekly hours against the place's
// LOCAL time (derived from lng). Returns null on no hours data or an
// unresolvable zone so the caller stays neutral. See isOpenAt for the rules.
export function isOpenNow(hours: unknown, lng: number | null): boolean | null {
  if (!hours || typeof hours !== "object") return null;
  const clock = localClock(lng);
  if (!clock) return null;
  return isOpenAt(hours, clock.weekday, clock.minutes);
}

// Rank weight for a place's live open state: open first, unknown neutral,
// closed last — the "demote, don't hide" ordering shared with Memo.
export function openScore(openNow: boolean | null | undefined): number {
  if (openNow === true) return 1;
  if (openNow === false) return -1;
  return 0; // unknown (no hours data) — neutral, never penalised
}

// Stable partition that floats open places above unknown above closed while
// preserving each caller's incoming order (relevance / partner-first) inside a
// bucket. `hoursOf` / `lngOf` read each row so a multi-city pool is judged in
// each place's own local time. "Demote, don't hide" — closed rows still appear,
// just after everything open.
export function demoteClosed<T>(
  rows: T[],
  hoursOf: (row: T) => unknown,
  lngOf: (row: T) => number | null,
): T[] {
  return rows
    .map((row, i) => ({ row, i, s: openScore(isOpenNow(hoursOf(row), lngOf(row))) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.row);
}
