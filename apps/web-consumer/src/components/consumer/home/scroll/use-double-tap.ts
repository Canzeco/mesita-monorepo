"use client";

import { useRef } from "react";

// Double-tap to save (MESITA-2105, design decision 4A).
//
// POINTER EVENTS, NOT `dblclick`. Mobile browsers either zoom on a double tap
// or never fire `dblclick` for touch at all, and the photo strip under this is
// a native horizontal scroller — so the only honest signal is two pointer-ups
// we time ourselves. The photo also carries `touch-action: manipulation`,
// which turns the browser's own double-tap zoom off without blocking either
// scroll axis.
//
// A SWIPE IS NEVER A TAP. A sideways swipe pages the photos and a vertical one
// moves to the next place; either way the pointer travels, or the browser
// claims the gesture and cancels it. A pointer that moved more than
// TAP_MOVE_PX, or was held longer than DOUBLE_TAP_MS, is not a tap and also
// breaks a pending pair — otherwise "tap, swipe, tap" could save.
//
// NO DELAY ON A SINGLE TAP, because a single tap does nothing here. That is
// the whole reason the carousel's tap zones are off on Scroll.

type TapPoint = { x: number; y: number; t: number };

/** The second tap must land within this window after the first. */
export const DOUBLE_TAP_MS = 300;
/** …and this close to it. */
export const DOUBLE_TAP_SLOP_PX = 24;
/** A pointer that travels further than this between down and up is a drag. */
export const TAP_MOVE_PX = 10;

/** Down → up is a tap: short and nearly still. */
export function isTap(down: TapPoint, up: TapPoint): boolean {
  return (
    up.t - down.t <= DOUBLE_TAP_MS &&
    Math.hypot(up.x - down.x, up.y - down.y) <= TAP_MOVE_PX
  );
}

/** `next` completes a double tap that `prev` started. */
export function isDoubleTap(prev: TapPoint | null, next: TapPoint): boolean {
  if (!prev) return false;
  return (
    next.t - prev.t <= DOUBLE_TAP_MS &&
    Math.hypot(next.x - prev.x, next.y - prev.y) <= DOUBLE_TAP_SLOP_PX
  );
}

/** Pointer handlers for an element that saves on a double tap. */
export function useDoubleTap(onDoubleTap: () => void) {
  const down = useRef<TapPoint | null>(null);
  const lastTap = useRef<TapPoint | null>(null);

  return {
    onPointerDown: (e: React.PointerEvent) => {
      // A tap on a control inside the photo (the photo dots) belongs to that
      // control. Double-clicking a dot must page, not save.
      if (e.target instanceof Element && e.target.closest("button, a")) {
        down.current = null;
        lastTap.current = null;
        return;
      }
      down.current = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    },
    onPointerUp: (e: React.PointerEvent) => {
      const start = down.current;
      down.current = null;
      if (!start) return;
      const up = { x: e.clientX, y: e.clientY, t: e.timeStamp };
      if (!isTap(start, up)) {
        lastTap.current = null;
        return;
      }
      if (isDoubleTap(lastTap.current, up)) {
        lastTap.current = null;
        onDoubleTap();
        return;
      }
      lastTap.current = up;
    },
    onPointerCancel: () => {
      down.current = null;
      lastTap.current = null;
    },
  };
}
