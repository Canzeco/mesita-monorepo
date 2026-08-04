// WHEN Mesita may ring the HUMAN GUEST again — the guest-side twin of
// reservation-retry.ts (which paces the venue side by its opening hours).
//
// A guest call is an annoyance budget, so the ladder is deliberately short and
// deliberately deaf after the cap:
//
//   attempt 1  immediately, when the venue verdict (or cancellation) lands
//   attempt 2  +10 minutes
//   attempt 3  +1 hour
//   then       NEVER again — the app is the fallback, not a fourth ring
//
// Two guards shape every retry:
//   quiet hours  no guest call outside 09:00–22:00 venue-local… unless the
//                reservation is less than 6 h away, when the news can't wait
//                (a 23:30 "your table tomorrow moved" holds until 09:00; a
//                23:30 "your midnight table was cancelled" does not).
//   cutoff       no call scheduled past reserved_at − 30 min — by then the
//                guest is on their way or the slot is gone either way, and a
//                call that lands after the table time is worse than none.
//
// Pure scheduling math — no clock, no DB — so it's testable like the venue
// twin. The venue-side cancellation notice does NOT use this module: venues
// are paced by their opening hours (nextAttemptAt), not by politeness windows.

import { mexicoZone } from "./local-time.ts";

/** Minutes to wait after attempt N fails (index N-1). Length defines the cap. */
export const GUEST_CALL_LADDER_MIN = [10, 60] as const;
/** Total guest-call attempts per errand — ladder + the immediate first call. */
export const GUEST_CALL_MAX_ATTEMPTS = GUEST_CALL_LADDER_MIN.length + 1;

const QUIET_OPENS = 9; // first callable hour, venue-local
const QUIET_CLOSES = 22; // first NON-callable hour
const URGENT_WINDOW_MS = 6 * 3600_000;
const CUTOFF_BEFORE_SLOT_MS = 30 * 60_000;

/** Venue-local hour (0–23) at a given instant; UTC hour when Intl fails. */
function hourAt(at: Date, lng: number | null): number {
  try {
    const h = new Intl.DateTimeFormat("en-US", {
      timeZone: mexicoZone(lng),
      hour: "numeric",
      hourCycle: "h23",
    }).format(at);
    const n = parseInt(h, 10);
    return Number.isFinite(n) ? n : at.getUTCHours();
  } catch {
    return at.getUTCHours();
  }
}

/**
 * The instant the next guest call may fire, or null when there must be no
 * next call (cap reached, or the slot is too close / already behind us).
 *
 * `attemptsDone` counts calls already placed for THIS errand (the immediate
 * first call included), so 1 → schedule attempt 2, 2 → attempt 3, 3+ → null.
 */
export function nextGuestCallAt(
  attemptsDone: number,
  lng: number | null,
  reservedAt: Date | null,
  now: Date = new Date(),
): { at: Date; reason: string } | null {
  if (attemptsDone >= GUEST_CALL_MAX_ATTEMPTS) return null;
  const delayMin = GUEST_CALL_LADDER_MIN[Math.max(0, attemptsDone - 1)] ??
    GUEST_CALL_LADDER_MIN[GUEST_CALL_LADDER_MIN.length - 1];
  let at = new Date(now.getTime() + delayMin * 60_000);

  const cutoff = reservedAt ? reservedAt.getTime() - CUTOFF_BEFORE_SLOT_MS : null;
  if (cutoff !== null && at.getTime() > cutoff) return null;

  const urgent = reservedAt !== null &&
    reservedAt.getTime() - now.getTime() < URGENT_WINDOW_MS;
  let deferred = false;
  if (!urgent) {
    // Nudge in half-hour steps until the local hour is callable; bounded so a
    // pathological zone can never loop forever (48 × 30 min = a full day).
    for (let i = 0; i < 48; i++) {
      const h = hourAt(at, lng);
      if (h >= QUIET_OPENS && h < QUIET_CLOSES) break;
      at = new Date(at.getTime() + 30 * 60_000);
      deferred = true;
    }
    if (cutoff !== null && at.getTime() > cutoff) return null;
  }

  return {
    at,
    reason: deferred
      ? `retry ${attemptsDone + 1}/${GUEST_CALL_MAX_ATTEMPTS} held for the 09:00–22:00 window`
      : `retry ${attemptsDone + 1}/${GUEST_CALL_MAX_ATTEMPTS} in ${delayMin} min${
        urgent ? " (urgent — quiet hours waived)" : ""
      }`,
  };
}
