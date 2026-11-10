"use client";

import { useEffect } from "react";

import type { ReservationState } from "@/lib/reservation-types";

/** Every 10 s while a reservation on screen is still waiting for the place. */
export const BOOKING_POLL_MS = 10_000;

/** The phases that end on their own: the answer arrives server-side. */
export function isAwaitingPlace(phase: ReservationState): boolean {
  return phase === "created" || phase === "booking";
}

/**
 * Calls `tick` every `ms` while `active`, and stops the moment it is not
 * (MESITA-3619: a reservation page refreshes while Booking). The state change
 * happens in the interval's callback, never in the effect body, so it passes
 * Next 16's set-state-in-effect rule. A hidden tab skips its ticks.
 */
export function usePollWhile(active: boolean, tick: () => void, ms: number = BOOKING_POLL_MS) {
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") tick();
    }, ms);
    return () => window.clearInterval(id);
  }, [active, tick, ms]);
}
