// THE RESERVE BOX'S HOURS (Pato, 2026-11-16, MESITA-4159: "do the same with
// reservations, show ... hours to reserve ... it must be open at that time
// and it must be a relevant time where people usually reserve"). A few
// times worth asking for, soonest first: the usual lunch and dinner times,
// only while the place is open (the last table an hour before closing, as on
// the Reserve page), at least an hour from now on the place's own clock,
// today then the next days. They are times to ask for, not free tables: the
// agent still phones the place.

import type { PlaceDetail } from "../place-detail";
import { placeOffsetMinutes } from "./place-time";

/** When people book a table in Mexico: one lunch time, then dinner. */
const USUAL_TIMES = ["14:30", "19:30", "20:00", "20:30", "21:00"];
/** A place with no hours: the Reserve page's dinner window, these only. */
const NO_HOURS_TIMES = ["19:30", "20:00", "20:30", "21:00"];
/** The last table, before closing (the Reserve page's rule). */
const LAST_TABLE_MINUTES = 60;
/** The soonest time offered, from now. */
const LEAD_MINUTES = 60;
/** How many times the box rotates through. */
const MAX_TIMES = 4;
const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const SHORT_DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type ReserveTime = { day: string; time: string };

function minutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 25 && min < 60 ? h * 60 + min : null;
}

/** Each weekday's open shifts in minutes, from the screen's hours table
 *  ("12:00–23:00", comma-joined, or "Closed"); null when nothing parses
 *  (unknown hours read as unknown, never as closed all week). */
function weekly(table: PlaceDetail["hours_table"]): Map<string, Array<[number, number]>> | null {
  const out = new Map<string, Array<[number, number]>>();
  let found = false;
  for (const row of table ?? []) {
    const key = String(row?.day ?? "").toLowerCase();
    if (!DAY_KEYS.includes(key)) continue;
    const shifts: Array<[number, number]> = [];
    for (const part of String(row?.range ?? "").split(",")) {
      const m = /^\s*(\d{1,2}:\d{2})\s*[–—-]\s*(\d{1,2}:\d{2})\s*$/.exec(part);
      if (!m) continue;
      const o = minutes(m[1]);
      const c = minutes(m[2]);
      if (o == null || c == null) continue;
      shifts.push([o, c > o ? c : c + 1440]);
      found = true;
    }
    out.set(key, shifts);
  }
  return found ? out : null;
}

/** Up to four times to ask for, soonest first, from `now`. */
export function reserveTimes(place: Pick<PlaceDetail, "hours_table" | "timezone">, now: number = Date.now()): ReserveTime[] {
  const hours = weekly(place.hours_table);
  // The place's wall clock now: its day of the week and minute of the day.
  const local = new Date(now + placeOffsetMinutes(place.timezone, now) * 60_000);
  const today = local.getUTCDay();
  const nowMin = local.getUTCHours() * 60 + local.getUTCMinutes();
  const out: ReserveTime[] = [];
  for (let d = 0; d < 7 && out.length < MAX_TIMES; d++) {
    const weekday = (today + d) % 7;
    const shifts = hours ? hours.get(DAY_KEYS[weekday]) ?? [] : null;
    for (const t of hours ? USUAL_TIMES : NO_HOURS_TIMES) {
      const m = minutes(t)!;
      if (d === 0 && m < nowMin + LEAD_MINUTES) continue;
      if (shifts && !shifts.some(([o, c]) => m >= o && m <= c - LAST_TABLE_MINUTES)) continue;
      out.push({ day: d === 0 ? "Today" : d === 1 ? "Tomorrow" : SHORT_DAY[weekday], time: t });
      if (out.length >= MAX_TIMES) break;
    }
  }
  return out;
}
