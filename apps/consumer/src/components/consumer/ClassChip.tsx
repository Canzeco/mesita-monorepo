"use client";

import Link from "next/link";
import { Crown, Instagram, CreditCard } from "lucide-react";
import { CURRENT_USER, TIERS, tierBadgeClass } from "@/lib/consumer-data";
import { cn } from "@/lib/utils";

// Top-right header chip — tier-colored avatar. For Premium it shows HOW the
// member earned it (Instagram or subscription icon; crown for invitation /
// default Premium); Free shows its initial. Tap routes to the Profile Plan
// tab. Rendered inline by DiscoverHeader and through SimpleHeader elsewhere.

export function ClassChip({ size = "md" }: { size?: "sm" | "md" }) {
  const meta = TIERS.find((t) => t.id === CURRENT_USER.tier);
  const isPremium = CURRENT_USER.tier === "premium";
  const origin = CURRENT_USER.tierOrigin;
  const initial = (meta?.label ?? CURRENT_USER.tier).charAt(0).toUpperCase();
  const iconCls = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <Link
      href="/profile"
      aria-label={`Your plan · Mesita ${meta?.label ?? "plan"}`}
      className={cn(
        "font-display flex shrink-0 items-center justify-center rounded-2xl font-bold transition hover:opacity-90",
        size === "sm" ? "h-9 w-9 text-sm" : "h-10 w-10 text-base",
        tierBadgeClass(CURRENT_USER.tier),
      )}
    >
      {!isPremium ? (
        initial
      ) : origin === "instagram" ? (
        <Instagram className={iconCls} />
      ) : origin === "subscription" ? (
        <CreditCard className={iconCls} />
      ) : (
        <Crown className={cn("fill-current", iconCls)} />
      )}
    </Link>
  );
}
