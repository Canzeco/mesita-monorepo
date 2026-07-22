// Hours → binary 2×24×7 openness array (MESITA-716 / MESITA-718).
// Mirrors apps/web-admin/src/lib/business/cip.ts buildOpennessArray.

import type { WeeklyHours } from "./local-time.ts";
import { OPENNESS_DAYS, OPENNESS_SLOTS, TIME_BLOCK_H } from "./lineup-scoring.ts";

const DAY_ORDER = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function parseHM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  return Number(m[1]) + Number(m[2]) / 60;
}

export type OpennessResult = {
  bits: boolean[] | null;
  unknown: boolean;
};

/**
 * Binary openness from intent day+hour over OPENNESS_SLOTS half-hour blocks.
 * No hours → unknown (caller treats when as 1).
 */
export function buildOpennessArray(
  hours: WeeklyHours | null | undefined,
  day: string,
  hour: number,
): OpennessResult {
  if (!hours || typeof hours !== "object" || Object.keys(hours).length === 0) {
    return { bits: null, unknown: true };
  }
  const di = DAY_ORDER.indexOf(day.toLowerCase());
  if (di < 0) return { bits: null, unknown: true };

  type Range = { start: number; end: number };
  const ranges: Range[] = [];
  for (let offset = 0; offset < OPENNESS_DAYS; offset++) {
    const d = DAY_ORDER[(di + offset) % 7];
    for (const r of hours[d] ?? []) {
      const open = parseHM(r.open);
      let close = parseHM(r.close);
      if (open == null || close == null) continue;
      if (close <= open) close += 24;
      ranges.push({ start: open + offset * 24, end: close + offset * 24 });
    }
  }

  const t0 = hour;
  const bits = new Array<boolean>(OPENNESS_SLOTS).fill(false);
  for (let i = 0; i < OPENNESS_SLOTS; i++) {
    const slotMid = t0 + i * TIME_BLOCK_H + TIME_BLOCK_H / 2;
    for (const r of ranges) {
      if (slotMid >= r.start && slotMid < r.end) {
        bits[i] = true;
        break;
      }
    }
  }
  return { bits, unknown: false };
}
