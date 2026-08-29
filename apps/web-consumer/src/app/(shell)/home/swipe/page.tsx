"use client";

import { Flame } from "lucide-react";
import { EmptyState } from "@/components/shared";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Home hub is Soon (Pato, 2026-08-28). Default `/home/swipe` is the empty
// state, not the deck. Un-park restores the swipe page body and the deck hook.
//
// This file is a client module because EmptyState is a client component and
// Lucide icons are functions — passing `icon={Flame}` from a Server Component
// throws RSC "Functions cannot be passed directly to Client Components"
// (production /home/swipe, 2026-08-29). Inbox › Orders already does this.
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
