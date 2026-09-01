"use client";

import { AskAiTab } from "@/components/consumer/home/AskAiTab";
import { useHomeDeck } from "@/components/consumer/home/HomeDeckContext";

// Chat — un-parked 2026-09-01. Don Memo is the persona you meet inside; the
// mode is named for what you do here, not who you meet.
export default function DiscoverChatPage() {
  const { places } = useHomeDeck();
  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      <AskAiTab places={places} />
    </div>
  );
}
