// Shared tier → Tailwind class lookups used by venue-detail surfaces
// (visitor avatars in ReviewCard, the tier ladder + reviewer cards in
// VenueDetailBody's Rewards box). Kept here so the two consuming
// components can't drift.
//
// `tierBadgeClass` in @/lib/consumer-data is the global tier chip
// (bg + text together, used by ClassChip + ProfileClient on consumer
// surfaces). The split helpers below are what the per-element treatment
// on the venue page needs.

import type { Tier } from "@/lib/mock/venue";

export const TIER_AVATAR_BG: Record<Tier, string> = {
  free: "bg-tier-free",
  premium: "bg-tier-premium",
};

export const TIER_TEXT: Record<Tier, string> = {
  free: "text-muted-foreground",
  premium: "text-premium",
};
