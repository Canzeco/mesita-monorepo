// THE RESERVE BOX'S HOURS (MESITA-4159; MESITA-4176, Pato: "for
// reservations actually scroll across all the opening hours for the next 24
// hours"). Every half hour from 30 minutes from now to 24 hours from now, on
// the place's own clock, while the place is open: the last table an hour
// before closing, as on the Reserve page, and yesterday's shift past
// midnight counts (open until 3 AM offers 01:30). Times to ask for, not free
// tables: the agent still phones the place.

import type { PlaceDetail } from "../place-detail";
import { placeOffsetMinutes } from "./place-time";

/** A place with no hours: the Reserve page's dinner window, these only. */
const NO_HOURS_TIMES = ["19:30", "20:00", "20:30", "21:00"];
/** The last table, before closing (the Reserve page's rule). */
const LAST_TABLE_MINUTES = 60;
/** The soonest time offered, from now. */
const LEAD_MINUTES = 30;
/** How far ahead the box looks (MESITA-4176). */
const WINDOW_MINUTES = 24 * 60;
/** The Reserve page's slot step. */
const STEP_MINUTES = 30;
const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

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

/** Every open half hour in the next 24 hours, soonest first, from `now`. */
export function reserveTimes(place: Pick<PlaceDetail, "hours_table" | "timezone">, now: number = Date.now()): ReserveTime[] {
  const hours = weekly(place.hours_table);
  // The place's wall clock now: its day of the week and minute of the day.
  const local = new Date(now + placeOffsetMinutes(place.timezone, now) * 60_000);
  const today = local.getUTCDay();
  const nowMin = local.getUTCHours() * 60 + local.getUTCMinutes();
  const noHours = new Set(NO_HOURS_TIMES.map((t) => minutes(t)!));
  // Is the place taking a table at minute `mm` of the day `d` days from now?
  const open = (d: number, mm: number): boolean => {
    if (!hours) return noHours.has(mm);
    const seat = (shifts: Array<[number, number]> | undefined, at: number) =>
      (shifts ?? []).some(([o, c]) => at >= o && at <= c - LAST_TABLE_MINUTES);
    // That day's shifts, or the day before's running past midnight.
    return seat(hours.get(DAY_KEYS[(today + d) % 7]), mm) || seat(hours.get(DAY_KEYS[(today + d + 6) % 7]), mm + 1440);
  };
  const out: ReserveTime[] = [];
  const first = Math.ceil((nowMin + LEAD_MINUTES) / STEP_MINUTES) * STEP_MINUTES;
  for (let m = first; m <= nowMin + WINDOW_MINUTES; m += STEP_MINUTES) {
    const d = Math.floor(m / 1440);
    const mm = m % 1440;
    if (!open(d, mm)) continue;
    out.push({
      day: d === 0 ? "Today" : "Tomorrow",
      time: `${String(Math.floor(mm / 60)).padStart(2, "0")}:${String(mm % 60).padStart(2, "0")}`,
    });
  }
  return out;
}
