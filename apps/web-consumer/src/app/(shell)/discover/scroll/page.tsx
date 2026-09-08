"use client";

import { ScrollDeck } from "@/components/consumer/home/scroll/ScrollDeck";
import { useHomeDeck } from "@/components/consumer/home/HomeDeckContext";

// Scroll — Home's lead mode (MESITA-1697), replacing Swipe's card stack.
// Owns its own scroller, so the page must never scroll: a clipped flex slot,
// same as the deck it replaces.
export default function DiscoverScrollPage() {
  const { places, fetchError } = useHomeDeck();
  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      <ScrollDeck places={places} fetchError={fetchError} />
    </div>
  );
}
