"use client";

import { ScrollDeck } from "@/components/consumer/home/scroll/ScrollDeck";
import { useHomeDeck } from "@/components/consumer/home/HomeDeckContext";

// Scroll — Home's lead mode (MESITA-1697), a TikTok feed since MESITA-2105.
// Owns its own scroller, so the page must never scroll: a clipped flex slot,
// same as the deck it replaces.
//
// `relative` IS THE FIX FOR A BLANK TAB. This slot takes its height from the
// discover layout's flex column (`flex-1`), and ScrollDeck fills it with
// `absolute inset-0`. Without `relative` here the deck asked a plain block for
// `flex-1`, got 0px, and every card sat inside a box with no height — the tab
// showed only the filter disc from a39d4f40 (MESITA-2050) until MESITA-2105.
export default function DiscoverScrollPage() {
  const { places, fetchError } = useHomeDeck();
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <ScrollDeck places={places} fetchError={fetchError} />
    </div>
  );
}
