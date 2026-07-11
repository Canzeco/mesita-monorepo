"use client";

import { SwipeDeck } from "@/app/(shell)/discover/swipe/SwipeDeck";
import { useHomeDeck } from "@/components/consumer/home/HomeDeckContext";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Swipe — the default Home tab. Fills the body and owns its gestures, so it
// gets a clipped flex slot (the page itself must never scroll here).
export default function HomeSwipePage() {
  const { places, fetchError } = useHomeDeck();
  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      <SwipeDeck
        places={places}
        fetchError={fetchError}
        errorRetryHref={CONSUMER_ROUTES.homeTabs.swipe}
      />
    </div>
  );
}
