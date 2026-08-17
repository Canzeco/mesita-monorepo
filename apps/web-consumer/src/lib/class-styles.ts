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
// NOTE: the `bg-tier-*` / `text-*` names below are CSS design tokens defined
// in globals.css. Classes v2 DID rename them (MESITA-1079), unlike the earlier
// nomenclature pass that deliberately left them alone: the old token names
// literally WERE the old class names, so a `--tier-influencer` holding
// Silver's color would be a trap rather than a shortcut. `--tier-premium`
// survives and changes meaning — it is the PLAN's color now.

import type { ClassKey } from "@/lib/consumer-data";

export const CLASS_AVATAR_BG: Record<ClassKey, string> = {
  bronze: "bg-tier-bronze",
  silver: "bg-tier-silver",
  gold: "bg-tier-gold",
  diamond: "bg-tier-diamond",
};

export const CLASS_TEXT: Record<ClassKey, string> = {
  bronze: "text-bronze",
  // Silver ink on a light surface is unreadable — the metal only works as a
  // fill, so its TEXT treatment borrows the muted foreground instead.
  silver: "text-muted-foreground",
  gold: "text-gold",
  diamond: "text-diamond",
};
