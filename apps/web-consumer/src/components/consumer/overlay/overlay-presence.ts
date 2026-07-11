"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Shared enter/exit choreography for every overlay in the app (slide-overs,
// bottom sheets, centered dialogs). One hook so all overlays animate with the
// same timing and none of them forget the exit half.
//
// `open` drives the CSS transition classes; `requestClose` plays the exit
// transition and only then fires `onExited` (router.back() for route modals,
// setState(false) for local overlays). Guarded so double-taps and
// ESC+backdrop races can't fire onExited twice.

// Must be >= the longest overlay CSS transition (duration-300) so the exit
// finishes painting before onExited unmounts the tree.
export const OVERLAY_MS = 320;

// iOS-style decelerating push curve, shared by panel + sheet transitions.
export const OVERLAY_EASE = "ease-[cubic-bezier(0.32,0.72,0,1)]";

// Under prefers-reduced-motion the shells disable their CSS transitions, so
// waiting the full exit duration would just be a dead-input window with a
// delayed URL restore — exit immediately instead.
export function overlayExitMs(): number {
  if (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  ) {
    return 0;
  }
  return OVERLAY_MS;
}

// `active` ties the presence lifecycle to the overlay's visibility contract
// (for route modals: "the URL is still a modal route"). Next.js keeps an
// unmatched @modal slot's last tree MOUNTED across soft navigations, so the
// same hook instance can be hidden and later re-activated. On deactivation we
// must abort a queued exit navigation (a push during the exit window would
// otherwise get yanked by a late router.back()) and reset the closing latch;
// on (re)activation the enter choreography re-runs so the panel never
// "pops in" with stale open state.
export function useOverlayPresence(
  onExited: () => void,
  { active = true }: { active?: boolean } = {},
) {
  const [open, setOpen] = useState(false);
  const closing = useRef(false);
  const exitTimer = useRef<number | null>(null);
  const onExitedRef = useRef(onExited);

  // Latest-ref pattern kept inside an effect (the React 19 compiler lint
  // forbids ref writes during render).
  useEffect(() => {
    onExitedRef.current = onExited;
  });

  useEffect(() => {
    if (active) {
      // Double rAF: let the closed-state frame (translate-x-full / opacity-0)
      // actually paint before flipping to open, otherwise the browser batches
      // both states into one style resolution and the enter transition never
      // plays — the overlay just pops in (the exact bug this file exists
      // for). The second callback bails if a close raced in between.
      let second = 0;
      const first = requestAnimationFrame(() => {
        closing.current = false;
        second = requestAnimationFrame(() => {
          if (!closing.current) setOpen(true);
        });
      });
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
      };
    }
    // Deactivated (stale slot): abort any queued exit navigation and reset
    // so a future re-activation enters cleanly. State flips stay inside the
    // rAF callback (react-hooks/set-state-in-effect).
    if (exitTimer.current !== null) {
      window.clearTimeout(exitTimer.current);
      exitTimer.current = null;
    }
    const raf = requestAnimationFrame(() => {
      closing.current = false;
      setOpen(false);
    });
    return () => cancelAnimationFrame(raf);
  }, [active]);

  // Unmount backstop: never let a queued router.back() outlive the overlay.
  useEffect(
    () => () => {
      if (exitTimer.current !== null) window.clearTimeout(exitTimer.current);
    },
    [],
  );

  const requestClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    setOpen(false);
    exitTimer.current = window.setTimeout(() => {
      exitTimer.current = null;
      onExitedRef.current();
    }, overlayExitMs());
  }, []);

  // ESC closes — every overlay. Detached while inactive (the stale-slot
  // case), so ESC on the underlying page can't fire a surprise router.back().
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, requestClose]);

  return { open, requestClose };
}
