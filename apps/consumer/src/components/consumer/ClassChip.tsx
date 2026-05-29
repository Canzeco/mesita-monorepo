"use client";

import Link from "next/link";
import { Crown } from "lucide-react";
import { CURRENT_USER, TIERS, tierBadgeClass } from "@/lib/consumer-data";
import { cn } from "@/lib/utils";

// Top-right header chip — tier-colored avatar showing the user's current
// Mesita class. Premium shows a crown (the status signal); Free shows its
// initial. Same affordance lands on /discover (rendered by DiscoverHeader
// inline) and on every other top-level surface (through SimpleHeader). Tap
// routes to the Profile Class tab where the membership context lives.

export function ClassChip({ size = "md" }: { size?: "sm" | "md" }) {
  const meta = TIERS.find((t) => t.id === CURRENT_USER.tier);
  const isPremium = CURRENT_USER.tier === "premium";
  const initial = (meta?.label ?? CURRENT_USER.tier).charAt(0).toUpperCase();
  return (
    <Link
      href="/profile"
      aria-label={`Your class · Mesita ${meta?.label ?? "class"}`}
      className={cn(
        "font-display flex shrink-0 items-center justify-center rounded-2xl font-bold transition hover:opacity-90",
        size === "sm" ? "h-9 w-9 text-sm" : "h-10 w-10 text-base",
        tierBadgeClass(CURRENT_USER.tier),
      )}
    >
      {isPremium ? (
        <Crown
          className={cn("fill-current", size === "sm" ? "h-4 w-4" : "h-5 w-5")}
        />
      ) : (
        initial
      )}
    </Link>
  );
}
