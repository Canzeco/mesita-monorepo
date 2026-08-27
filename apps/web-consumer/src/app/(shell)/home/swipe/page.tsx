"use client";

import { Flame } from "lucide-react";
import { EmptyState } from "@/components/shared";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Home hub is Soon (Pato, 2026-08-26). Default `/home/swipe` is the empty
// state, not the deck. Un-park restores the swipe page body and the deck hook.
//
// "use client" is load-bearing: EmptyState is a client component that takes a
// LucideIcon (a function). A server page passing icon={Flame} throws
// "Functions cannot be passed directly to Client Components" (digest 1581185812).
export default function HomeSwipePage() {
  return (
    <EmptyState
      icon={Flame}
      title="Soon"
      description="Swipe, Catalog, Chat, Social and Favorites land here. Search is live — find a place there."
      action={{ label: "Search", href: CONSUMER_ROUTES.search }}
    />
  );
}
