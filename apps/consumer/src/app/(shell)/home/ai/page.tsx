"use client";

import { AskAiTab } from "@/components/consumer/home/AskAiTab";
import { useHomeDeck } from "@/components/consumer/home/HomeDeckContext";

// Ask AI — the Memo concierge as a full Home tab (MESITA-156). Reuses the
// shared deck for the "near me" catalog and the create-place / navigate flow.
export default function HomeAiPage() {
  const { places } = useHomeDeck();
  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      <AskAiTab places={places} />
    </div>
  );
}
