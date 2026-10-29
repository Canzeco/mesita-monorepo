// THE CLEAR WINDOW (Pato, MESITA-3020: "the search radious of the map must
// always be fucking centered"): the part of the map no overlay covers, from
// the chip row's foot to the card rail's top, as shares of the map's height.
// The sight (ring centre, fetch point, camera target) is its middle and the
// ring is RING_INSET of its smaller side. SearchClient measures it live;
// the pure helpers in search-utils read it. The ring reads it as CSS custom
// properties on the map frame, never React state (MESITA-3035): a measure
// re-renders nothing, so it cannot loop the screen into React #185 the way
// MESITA-3020's subscribed store did (MESITA-3032). The overlays are fixed pixels,
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

export function getSightFrame(): SightFrame {
  return frame;
}

/** Sets the window; a degenerate one (under 10% tall) or a sub-pixel change
 *  is ignored, so a half-mounted overlay never collapses the ring. True when
 *  it moved. */
export function setSightFrame(next: SightFrame): boolean {
  const top = Math.max(0, Math.min(1, next.top));
  const bottom = Math.max(0, Math.min(1, next.bottom));
  if (!(bottom - top >= 0.1)) return false;
  if (
    Math.abs(top - frame.top) < 0.002 &&
    Math.abs(bottom - frame.bottom) < 0.002
  ) {
    return false;
  }
  frame = { top, bottom };
  return true;
}

/** The window as the CSS custom properties the ring and the veil read
 *  (shares of the map's height, unitless): `--sight-top` / `--sight-bottom`.
 *  Their fallbacks in CSS are DEFAULT_SIGHT_FRAME. */
export function writeSightFrameVars(el: HTMLElement, f: SightFrame): void {
  el.style.setProperty("--sight-top", String(f.top));
  el.style.setProperty("--sight-bottom", String(f.bottom));
}
