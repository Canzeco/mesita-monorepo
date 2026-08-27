"use client";

import { AskAiTab } from "@/components/consumer/home/AskAiTab";
import { useHomeDeck } from "@/components/consumer/home/HomeDeckContext";

export default function HomeChatPage() {
  const { places } = useHomeDeck();
  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      <AskAiTab places={places} />
    </div>
  );
}
