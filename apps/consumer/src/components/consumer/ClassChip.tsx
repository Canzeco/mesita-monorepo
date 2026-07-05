"use client";

import Link from "next/link";
import { Crown, Instagram, Smile } from "lucide-react";
import { CLASSES, classBadgeClass } from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import { cn } from "@/lib/utils";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Top-right header chip — class-colored avatar. For Premium it shows HOW the
// member earned it (Instagram icon; crown for subscription/invitation/default
// Premium); Free shows the Mesita Free smile. Tap routes to the
// Me > Class tab. Rendered inline by DiscoverHeader and through
// SimpleHeader elsewhere.

export function ClassChip({ size = "md" }: { size?: "sm" | "md" }) {
  const { key, origin } = useConsumerClass();
  const meta = CLASSES.find((c) => c.id === key);
  const isPremium = key === "premium";
  const iconCls = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <Link
      href={CONSUMER_ROUTES.me.class}
      aria-label={`Your class · Mesita ${meta?.label ?? "class"}`}
      className={cn(
        "font-display flex shrink-0 items-center justify-center rounded-2xl font-bold transition hover:opacity-90",
        size === "sm" ? "h-9 w-9 text-sm" : "h-10 w-10 text-base",
        classBadgeClass(key),
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
