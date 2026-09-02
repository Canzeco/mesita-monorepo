"use client";

import { useEffect } from "react";

/**
 * Keeps the app at 100% of the visible frame — no page zoom, ever.
 *
 * WHY THIS EXISTS. The consumer surface is a phone-shaped visualizer:
 * `MobileFrame` is `h-dvh` and `max-w-md`, so every screen is already sized to
 * the viewport. A zoom level other than 1 cannot reveal anything; it can only
 * crop. The failure mode is ugly and easy to hit — the whole app scaled up and
 * panned, so `DiscoverModeNav`'s tab row bled off both edges and the fixed
 * `RouteBadge` drifted over the chrome, because a zoomed visual viewport is a
 * window onto a layout viewport that is now wider than the screen.
 *
 * THE LOCK IS THREE PARTS, one per thing the engines actually honour:
 *
 *   1. `layout.tsx`'s viewport export (`maximumScale: 1`, `userScalable:
 *      false`) — Chrome, Android and desktop stop there.
 *   2. `globals.css`'s 16px floor on form controls — the CAUSE of the zoom in
 *      the screenshot that prompted this. iOS Safari zooms the page whenever a
 *      focused field would render below 16px, and the search bar's input was
 *      `text-sm` (14px).
 *   3. This component, for iOS Safari's deliberate pinch. Safari has ignored
 *      `user-scalable` and `maximum-scale` since iOS 10 so a page can never
 *      take zoom away from a guest who needs it, but it does still fire its
 *      own non-standard `gesture*` events for a pinch and it does still honour
 *      preventDefault on them.
 *
 * THE MAP IS NOT AFFECTED. Google Maps does its own two-finger math on raw
 * touch events — it has to, since `gesture*` is Safari-only — and it already
 * preventDefaults the touchmoves it consumes. Refusing `gesturestart` cancels
 * Safari's PAGE zoom and nothing else, so pinching the map still zooms the
 * map. The double-tap half is CSS (`touch-action: manipulation` on `html`),
 * which is a narrowing every descendant keeps: `SwipeDeck`'s `touch-none` and
 * the map's own handling both still win where they set them.
 *
 * NOT LOCKED, on purpose: iOS's system-level accessibility zoom and the
 * browser's own font-size setting. Neither goes through these events, and the
 * type roles are in rem so the second one keeps working. Guests who need
 * bigger text still get it; the app just never zooms itself.
 */
export function ViewportLock() {
  useEffect(() => {
    // Safari-only, non-standard, and absent from DocumentEventMap — hence the
    // plain Event and the string literals.
    const refuse = (event: Event) => event.preventDefault();
    const events = ["gesturestart", "gesturechange", "gestureend"];

    // Passive listeners cannot preventDefault, and Safari treats touch-family
    // listeners on document as passive by default. This must be explicit.
    for (const name of events) {
      document.addEventListener(name, refuse, { passive: false });
    }
    return () => {
      for (const name of events) {
        document.removeEventListener(name, refuse);
      }
    };
  }, []);

  return null;
}
