"use client";

import { SwipeDeck } from "@/components/consumer/home/swipe/SwipeDeck";
import { useHomeDeck } from "@/components/consumer/home/HomeDeckContext";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Swipe — un-parked 2026-09-01. Fills the body and owns its gestures, so it
// gets a clipped flex slot: the page itself must never scroll here, or the
// deck's drag fights the scroller.
export default function DiscoverSwipePage() {
  const { places, fetchError } = useHomeDeck();
  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      <SwipeDeck
        places={places}
        fetchError={fetchError}
        errorRetryHref={CONSUMER_ROUTES.discoverTabs.swipe}
      />
    </div>
  );
}
