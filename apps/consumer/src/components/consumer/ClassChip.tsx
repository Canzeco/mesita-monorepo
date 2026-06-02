"use client";

import Link from "next/link";
import { Crown, Instagram, Smile } from "lucide-react";
import { TIERS, tierBadgeClass } from "@/lib/consumer-data";
import { useMembership } from "@/lib/membership-context";
import { cn } from "@/lib/utils";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Top-right header chip — tier-colored avatar. For Premium it shows HOW the
// member earned it (Instagram icon; crown for subscription/invitation/default
// Premium); Free shows the Mesita Free smile. Tap routes to the
// Me > Plan tab. Rendered inline by DiscoverHeader and through
// SimpleHeader elsewhere.

export function ClassChip({ size = "md" }: { size?: "sm" | "md" }) {
  const { tier, origin } = useMembership();
  const meta = TIERS.find((t) => t.id === tier);
  const isPremium = tier === "premium";
  const iconCls = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <Link
      href={CONSUMER_ROUTES.me.plan}
      aria-label={`Your plan · Mesita ${meta?.label ?? "plan"}`}
      className={cn(
        "font-display flex shrink-0 items-center justify-center rounded-2xl font-bold transition hover:opacity-90",
        size === "sm" ? "h-9 w-9 text-sm" : "h-10 w-10 text-base",
        tierBadgeClass(tier),
      )}
    >
      {!isPremium ? (
        <Smile className={iconCls} />
      ) : origin === "instagram" ? (
        <Instagram className={iconCls} />
      ) : (
        <Crown className={cn("fill-current", iconCls)} />
      )}
    </Link>
  );
}
