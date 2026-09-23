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

// CLASS_AVATAR_BG is gone (MESITA-1142). It handed out a fill with no ink, and
// its one caller then hardcoded a white wash beside it — which is exactly how
// white ended up on three light metals. A filled element that carries content
// takes `classBadgeClass` from @/lib/consumer-data, which pairs the two.

// Two rows since MESITA-2044 (Base / Diamond List). Silver and Gold's ink
// left with the ladder.
export const CLASS_TEXT: Record<ClassKey, string> = {
  bronze: "text-bronze",
  diamond: "text-diamond",
};
