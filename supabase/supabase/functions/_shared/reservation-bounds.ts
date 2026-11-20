// Gates the reservation writers share (MESITA-4139).
//
// A ticket whose time has passed cannot be cancelled or moved: that refunds a
// metered call and rings a place about a table that was already used. A
// reschedule is only a change of a ticket the place might still hold
// (pending or confirmed). A new time is at most one calendar month ahead, on
// the place's clock — the same horizon the form derives
// (apps/web-consumer/src/lib/reservation-slots.ts BOOKING_HORIZON_MONTHS).

import { zoneDay } from "./local-time.ts";

export const BOOKING_HORIZON_MONTHS = 1;

export function slotHasPassed(reservedAtIso: string, nowMs: number): boolean {
  const t = new Date(reservedAtIso).getTime();
  return Number.isFinite(t) && t < nowMs;
}

/** Reschedule reopens the call. Only a ticket still in play may do that. */
export function rescheduleStateAllowed(state: string): boolean {
  return state === "pending" || state === "confirmed";
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Last place-local date a guest may book: today plus one calendar month. */
export function bookingHorizonDay(at: Date, zone: string): string {
  const [y, m, d] = zoneDay(at, zone).split("-").map(Number);
  const total = m - 1 + BOOKING_HORIZON_MONTHS;
  const year = y + Math.floor(total / 12);
  const month = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(Math.min(d, lastDay))}`;
}

/** True when the slot's place-local date is after the horizon (that date is allowed). */
export function isBeyondBookingHorizon(reservedAt: Date, now: Date, zone: string): boolean {
  return zoneDay(reservedAt, zone) > bookingHorizonDay(now, zone);
}
