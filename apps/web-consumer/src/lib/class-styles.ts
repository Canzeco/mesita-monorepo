// Shared class → Tailwind class lookups used by place-detail surfaces
// (visitor avatars in ReviewCard, the class ladder + reviewer cards in
// PlaceDetailBody's Rewards box). Kept here so the two consuming
// components can't drift.
//
// `classBadgeClass` in @/lib/consumer-data is the global class chip
// (bg + text together, used by ProfileClient on consumer surfaces). The
// split helpers below are what the per-element treatment on the place page
// needs.
//
// NOTE: the `bg-tier-*` / `text-premium` Tailwind tokens below are CSS
// design tokens defined in globals.css and are intentionally left under
// their original names — the class nomenclature rename covers data +
// labels, not the color-token vocabulary.

import type { ClassKey } from "@/lib/consumer-data";

export const CLASS_AVATAR_BG: Record<ClassKey, string> = {
  standard: "bg-tier-free",
  premium: "bg-tier-premium",
  influencer: "bg-tier-influencer",
  aura: "bg-tier-gold",
};

export const CLASS_TEXT: Record<ClassKey, string> = {
  standard: "text-muted-foreground",
  premium: "text-premium",
  influencer: "text-influencer",
  aura: "text-amber-600",
};
