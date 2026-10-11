"use client";

import { SwipeDeck } from "@/components/consumer/home/swipe/SwipeDeck";
import { useHomeDeck } from "@/components/consumer/home/HomeDeckContext";

// Swipe — the card stack, back on Home's rail (Pato, MESITA-2142: "Return the
// swipe mode from old commits. swipe scroll chat favs"). It retired at
// MESITA-1697 when Scroll replaced it.
//
// It reads WHAT SCROLL READS: the shared Home deck (HomeDeckBoundary), so the
// two modes never disagree about what the catalog holds. An empty catalog is
// SwipeDeck's own "No places yet" screen, never an invented card.
//
// Fills the body and owns its gestures, so it gets a clipped flex slot: the
// page itself must never scroll here, or the deck's drag fights the scroller.
export default function DiscoverSwipePage() {
  const { places, fetchError } = useHomeDeck();
  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      <SwipeDeck places={places} fetchError={fetchError} />
    </div>
  );
}
