"use client";

import { SwipeDeck } from "@/components/consumer/home/swipe/SwipeDeck";
import { useHomeDeck } from "@/components/consumer/home/HomeDeckContext";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { SCROLL_USES_MOCK, scrollMockPlaces } from "@/lib/mock/scroll-places";

// Swipe — the card stack, back on Home's rail (Pato, MESITA-2142: "Return the
// swipe mode from old commits. swipe scroll chat favs"). It retired at
// MESITA-1697 when Scroll replaced it.
//
// It reads WHAT SCROLL READS: while SCROLL_USES_MOCK is on (until
// MESITA-2095), the same sample places, so the two modes never disagree about
// what the catalog holds. A sample card never reaches Favs, a place page or a
// booking (SwipeDeck checks isMockPlace).
//
// Fills the body and owns its gestures, so it gets a clipped flex slot: the
// page itself must never scroll here, or the deck's drag fights the scroller.
export default function DiscoverSwipePage() {
  const { places, fetchError } = useHomeDeck();
  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      <SwipeDeck
        places={SCROLL_USES_MOCK ? scrollMockPlaces() : places}
        fetchError={SCROLL_USES_MOCK ? null : fetchError}
        errorRetryHref={CONSUMER_ROUTES.discoverTabs.swipe}
      />
    </div>
  );
}
