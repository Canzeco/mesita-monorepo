// THE CLEAR WINDOW (Pato, MESITA-3020: "the search radious of the map must
// always be fucking centered"): the part of the map no overlay covers, from
// the chip row's foot to the card rail's top, as shares of the map's height.
// The sight (ring centre, fetch point, camera target) is its middle and the
// ring is RING_INSET of its smaller side. SearchClient measures it live;
// the pure helpers in search-utils read it. The overlays are fixed pixels,
// so a fixed share (SIGHT_Y = 0.38, MESITA-2672) drifted on every phone
// height but one.

export type SightFrame = {
  /** Share of the map's height above the window (the header and chips). */
  top: number;
  /** Share of the map's height at the window's foot (the rail's top). */
  bottom: number;
};

/** Before the first measure: the old fixed sight, 0.38 = the middle of 0 →
 *  0.76, so a server render and the pure helpers' tests read as before. */
export const DEFAULT_SIGHT_FRAME: SightFrame = { top: 0, bottom: 0.76 };

let frame: SightFrame = DEFAULT_SIGHT_FRAME;
const listeners = new Set<() => void>();

export function getSightFrame(): SightFrame {
  return frame;
}

/** Sets the window; a degenerate one (under 10% tall) or a sub-pixel change
 *  is ignored, so a half-mounted overlay never collapses the ring. */
export function setSightFrame(next: SightFrame): void {
  const top = Math.max(0, Math.min(1, next.top));
  const bottom = Math.max(0, Math.min(1, next.bottom));
  if (!(bottom - top >= 0.1)) return;
  if (
    Math.abs(top - frame.top) < 0.002 &&
    Math.abs(bottom - frame.bottom) < 0.002
  ) {
    return;
  }
  frame = { top, bottom };
  for (const l of listeners) l();
}

/** React-free on purpose (search-utils is server-safe): SearchMap wraps it
 *  in useSyncExternalStore. */
export function subscribeSightFrame(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
