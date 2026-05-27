"use client";

import Link from "next/link";
import { CURRENT_USER, TIERS, tierBadgeClass } from "@/lib/consumer-data";
import { cn } from "@/lib/utils";

// Top-right header chip — tier-colored avatar showing the user's
// current Mesita class (B / S / G / D). Same affordance lands on
// /discover (rendered by DiscoverHeader inline) and on every other
// top-level surface (rendered through SimpleHeader). Tap routes to
// /coupons so the user sees their class context next to the wallet
// where the climb pays off; pre-restructure this was /pay, but with
// the BottomNav split the upgrade pitch (ClassUpsellBox) lives at
// the top of /coupons.

export function ClassChip({ size = "md" }: { size?: "sm" | "md" }) {
  const meta = TIERS.find((t) => t.id === CURRENT_USER.tier);
  const initial = (meta?.label ?? CURRENT_USER.tier).charAt(0).toUpperCase();
  return (
    <Link
      href="/coupons"
      aria-label={`Coupons · Mesita ${meta?.label ?? "class"}`}
      className={cn(
        "font-display flex shrink-0 items-center justify-center rounded-2xl font-bold transition hover:opacity-90",
        size === "sm" ? "h-9 w-9 text-sm" : "h-10 w-10 text-base",
        tierBadgeClass(CURRENT_USER.tier),
      )}
    >
      {initial}
    </Link>
  );
}
