"use client";

import { Gift } from "lucide-react";
import { CURRENT_USER, tierProperLabel } from "@/lib/consumer-data";
import type { Venue } from "@/lib/api/venues";

// Tiny shared building block for the venue-card promo callout.
//
// Renders the "X% OFF welcome / return-visit discount" pink-gradient pill
// at the bottom of both the swipe overlay and the catalog/saved tile. Owns
// the per-tier rate resolution, kind logic, and the tier+cap tooltip so the
// two surfaces can't drift.
//
// The rate is REAL: it's read from the venue's per-tier promo columns
// (welcome_/default_ × free/premium, migration 0032) for the current
// guest's tier, falling back to the legacy single cashback_percent.
//
// Rewards are a Verified-Partner-only capability. Web-listed venues never
// offer rewards — a hard rule the chip enforces by short-circuiting on
// listing_type, independent of any reward columns the row might still
// carry. A Verified Partner MAY also choose not to set a rate, in which
// case the chip renders nothing too. Either way there is no fabricated
// promo: only a partner with a real, non-zero rate shows a ribbon.
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
  // Hard gate: only Verified Partners can offer rewards. Web-listed venues
  // never show a ribbon, regardless of any reward columns on the row.
  if (venue.listing_type !== "partner") return null;
  const isFirstVisit = venue.is_first_visit !== false;
  const promoPercent = resolvePromoRate(venue, isFirstVisit);
  // Partner with no rate at the current tier → no ribbon at all.
  if (promoPercent == null) return null;

  const promoKindLabel = isFirstVisit ? "welcome" : "return-visit";
  const tierLabel = tierProperLabel(CURRENT_USER.tier);
  const capPrefix = venue.currency === "MXN" ? "MX$" : "$";
  const capLabel =
    venue.reward_cap_mxn != null
      ? `Capped ${capPrefix}${venue.reward_cap_mxn.toLocaleString("en-US")} / visit`
      : null;

  const sizing =
    size === "md" ? "px-2.5 py-1 text-[11.5px]" : "px-2.5 py-1 text-[10.5px]";
  const iconSize = size === "md" ? "h-3 w-3" : "h-2.5 w-2.5";

  return (
    <span
      className={`bg-pink-gradient shadow-glow inline-flex max-w-full items-center gap-1.5 rounded-full whitespace-nowrap text-white ${sizing}`}
      title={
        capLabel
          ? `at Mesita ${tierLabel} · ${capLabel}`
          : `at Mesita ${tierLabel}`
      }
    >
      <Gift className={`${iconSize} shrink-0`} strokeWidth={2.25} />
      <span className="font-semibold">
        {promoPercent}% OFF {promoKindLabel} discount
      </span>
    </span>
  );
}

// Active reward rate for the current guest's tier. Reads the real per-tier
// columns the venues row carries at runtime (welcome_/default_ × free/
// premium) — present even though they're not on the Venue type — picking the
// welcome bucket on a first visit and the default bucket afterwards. Falls
// back across visit buckets, then to the legacy single cashback_percent.
// Returns null when the venue has no promo at this tier so the caller can
// hide the ribbon entirely.
function resolvePromoRate(venue: Venue, isFirstVisit: boolean): number | null {
  const row = venue as unknown as Record<string, unknown>;
  const rate = (key: string): number | null => {
    const n = row[key];
    return typeof n === "number" && n > 0 ? n : null;
  };
  const premium = CURRENT_USER.tier === "premium";
  const welcome = premium
    ? rate("welcome_premium_rate")
    : rate("welcome_free_rate");
  const dflt = premium ? rate("premium_rate") : rate("free_rate");
  const legacy =
    venue.cashback_percent != null && venue.cashback_percent > 0
      ? venue.cashback_percent
      : null;
  return (isFirstVisit ? (welcome ?? dflt) : (dflt ?? welcome)) ?? legacy;
}
