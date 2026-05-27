// Shared tier → Tailwind class lookups used by venue-detail surfaces
// (visitor avatars in ReviewCard, the tier ladder + reviewer cards in
// VenueDetailBody's Rewards box). Kept here so the diamond-text override
// — sky blue on this surface even though the global --tier-diamond
// gradient stays violet — lives in a single spot and the two consuming
// components can't drift.
//
// `tierBadgeClass` in @/lib/consumer-data is the global tier chip
// (bg + text together, used by ClassChip + ProfileClient on consumer
// surfaces). The split helpers below are what the per-element treatment
// on the venue page needs.

import type { Tier } from "@/lib/mock/venue";

export const TIER_AVATAR_BG: Record<Tier, string> = {
  bronze: "bg-tier-bronze",
  silver: "bg-tier-silver",
  gold: "bg-tier-gold",
  diamond: "bg-tier-diamond",
};

// Diamond text reads as blue across the venue page even though the
// tier-diamond gradient stripe still uses the violet token. Local
// override on purpose — the global tier-diamond token stays untouched
// so other apps (admin/business) keep their existing diamond hue.
export const TIER_TEXT: Record<Tier, string> = {
  bronze: "text-bronze",
  silver: "text-silver",
  gold: "text-gold",
  diamond: "text-sky-600",
};
