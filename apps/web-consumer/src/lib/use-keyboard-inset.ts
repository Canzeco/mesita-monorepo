"use client";

// How many pixels the software keyboard is covering at the bottom of the
// LAYOUT viewport, or 0 when it is closed.
//
// WHY THIS EXISTS. `MobileFrame` is `h-dvh` and `BottomNav` is a flow sibling
// inside it, so every surface in the shell measures its height from the layout
// viewport. On iOS Safari the layout viewport does NOT shrink when the keyboard
// opens — only the VISUAL viewport does — so `dvh`, `bottom-0` and `position:
// fixed` all keep pointing at a strip of screen the keyboard is now sitting on.
// Anything anchored to the bottom (the tab bar, the map's results panel, a
// sticky Save button) is silently underneath it.
//
// THE DECLARATIVE HALF IS IN layout.tsx: `interactiveWidget:
// "resizes-content"` makes Chrome/Android shrink the layout viewport itself,
// which is strictly better because it needs no JS and no reflow on our side.
// Safari does not implement it, so this hook is the fallback — and the two
// compose rather than fight: where the browser already resized the content,
// `window.innerHeight` shrank with it and the delta below reads ~0.
//
// The THRESHOLD is what keeps iOS's collapsing URL bar out of this. That
// changes `innerHeight` and `visualViewport.height` together, so the delta
// stays near zero; a keyboard moves them apart by hundreds of pixels.

import { useEffect, useState } from "react";

/** Below this, treat the delta as browser chrome rather than a keyboard. */
const KEYBOARD_MIN_PX = 60;

export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const read = () => {
      // offsetTop matters when the guest pans the visual viewport: the covered
      // strip is what is left below the visible box, not the raw height gap.
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      setInset(covered > KEYBOARD_MIN_PX ? Math.round(covered) : 0);
    };

    read();
    vv.addEventListener("resize", read);
    vv.addEventListener("scroll", read);
    return () => {
      vv.removeEventListener("resize", read);
      vv.removeEventListener("scroll", read);
    };
  }, []);

  return inset;
}
