"use client";

import { AskAiTab } from "@/components/consumer/home/AskAiTab";
import { useHomeDeck } from "@/components/consumer/home/HomeDeckContext";

// Ask AI — the Memo concierge, full-height inline chat. Clipped like the deck
// so the page never scrolls behind the fixed composer.
export default function HomeAiPage() {
  const { places } = useHomeDeck();
  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      <AskAiTab places={places} />
    </div>
  );
}
