"use client";

import { useSyncExternalStore } from "react";

// THE OFFER BEAT (MESITA-3467, Pato: "switching across all the offers, every
// two seconds ... like a carousel"): ONE clock for every offer button on the
// page, so the buttons on screen change together (one calm pulse, never ten
// timers out of step). It counts up every 2s while anything listens, and
// skips a beat while the page is hidden or was scrolled in the last 600ms,
// so nothing moves under a moving list. A phone set to reduce motion reads
// a still first slide (useReducedMotion below).

export const OFFER_BEAT_MS = 2000;
const SCROLL_QUIET_MS = 600;

let beat = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let lastScrollAt = 0;
const listeners = new Set<() => void>();

function onScroll() {
  lastScrollAt = Date.now();
}

function tick() {
  if (document.hidden) return;
  if (Date.now() - lastScrollAt < SCROLL_QUIET_MS) return;
  beat += 1;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    timer = setInterval(tick, OFFER_BEAT_MS);
    // Capture: the Home list scrolls inside its own box, not the window.
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
      document.removeEventListener("scroll", onScroll, { capture: true });
    }
  };
}

/** The shared beat: a count that rises every 2s. The server render reads 0. */
export function useOfferBeat(): number {
  return useSyncExternalStore(subscribe, () => beat, () => 0);
}

const REDUCE = "(prefers-reduced-motion: reduce)";

function subscribeReduced(listener: () => void) {
  const query = window.matchMedia(REDUCE);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

/** The phone asks for less motion: the offer button holds its first slide. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCE).matches, () => false);
}
