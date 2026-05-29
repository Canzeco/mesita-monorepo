"use client";

import { BadgePercent } from "lucide-react";
import { CURRENT_USER, tierProperLabel } from "@/lib/consumer-data";
import type { Venue } from "@/lib/api/venues";

// Tiny shared building block for the venue-card promo callout.
//
// Renders the "X% OFF welcome / return-visit · MOCK" pink-gradient
// pill that lives at the bottom of both the swipe overlay and the
// catalog/saved tile. Owns the rate-fallback, kind logic, and the
// tier+cap tooltip so the two surfaces can't drift. The "MOCK" suffix
// stays until the per-tier promo Edge Function returns real rates;
// drop the suffix + tighten the cashback_percent gate at the same
// time.
//
// `size` lets the caller pick chip vs body weight:
//   - "sm" (default) — catalog / saved tile
//   - "md"           — swipe overlay
export function PromoChip({
  venue,
  size = "sm",
}: {
  venue: Venue;
  size?: "sm" | "md";
}) {
  const promoPercent =
    venue.cashback_percent != null && venue.cashback_percent > 0
      ? venue.cashback_percent
      : 20;
  const isFirstVisit = venue.is_first_visit !== false;
  const promoKindLabel = isFirstVisit ? "welcome" : "return-visit";
  const tierLabel = tierProperLabel(CURRENT_USER.tier);
  const capPrefix = venue.currency === "MXN" ? "MX$" : "$";
  const capLabel =
    venue.reward_cap_mxn != null
      ? `Capped ${capPrefix}${venue.reward_cap_mxn.toLocaleString("en-US")} / visit`
      : null;

  const sizing =
    size === "md"
      ? "px-2.5 py-1 text-[11.5px]"
      : "px-2.5 py-1 text-[10.5px]";
  const iconSize = size === "md" ? "h-3 w-3" : "h-2.5 w-2.5";
  const mockSize = size === "md" ? "text-[9px]" : "text-[8.5px]";

  return (
    <span
      className={`bg-pink-gradient shadow-glow inline-flex max-w-full items-center gap-1.5 rounded-full whitespace-nowrap text-white ${sizing}`}
      title={
        capLabel
          ? `at Mesita ${tierLabel} · ${capLabel}`
          : `at Mesita ${tierLabel}`
      }
    >
      <BadgePercent className={`${iconSize} shrink-0`} strokeWidth={2.25} />
      <span className="font-semibold">
        {promoPercent}% OFF {promoKindLabel}
      </span>
      <span
        className={`${mockSize} font-bold tracking-[0.14em] uppercase text-white/70`}
      >
        · mock
      </span>
    </span>
  );
}
