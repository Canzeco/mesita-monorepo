"use client";

import { AskAiTab } from "@/components/consumer/home/AskAiTab";
import { useHomeDeck } from "@/components/consumer/home/HomeDeckContext";

// Ask AI — the Memo concierge (MESITA-156) as a full Home tab. Shares the
// fetched deck (HomeDeckBoundary) with its sibling tabs so the cards Memo
// surfaces resolve against the same catalog snapshot. Clipped flex slot: the
// panel owns its own scroll, so the page itself never scrolls here.
export default function HomeAiPage() {
  const { places } = useHomeDeck();
  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      <AskAiTab places={places} />
    </div>
  );
}
