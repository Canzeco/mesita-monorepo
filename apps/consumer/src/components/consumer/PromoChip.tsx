"use client";

import { Gift } from "lucide-react";
import { tierProperLabel } from "@/lib/consumer-data";
import { useMembership } from "@/lib/membership-context";
import { resolvePromoRateFromVenueRow } from "@/lib/promo-rates";
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
// guest's tier.
//
// Rewards are a Verified-Partner-only capability. Web-listed venues never
// offer rewards — a hard rule the chip enforces by short-circuiting on
// listing_type, independent of any reward columns the row might still
// carry. A Verified Partner MAY also choose not to set a rate. Either way
// there is no fabricated promo: only a partner with a real, non-zero rate
// shows a pink ribbon. When there's no reward the chip renders nothing by
// default, or — if the caller passes `showWhenEmpty` — a neutral dark
// "No reward for you" pill so the absence is stated rather than silently
// hidden.
//
// `size` lets the caller pick chip vs body weight:
//   - "sm" (default) — catalog / saved tile
//   - "md"           — swipe overlay
export function PromoChip({
  venue,
  size = "sm",
  showWhenEmpty = false,
}: {
  venue: Venue;
  size?: "sm" | "md";
  /** When the venue has no reward, render a neutral "No reward for you" pill
   *  instead of nothing. Off by default so the catalog/saved tile stays
   *  clean; the swipe card opts in to state the absence explicitly. */
  showWhenEmpty?: boolean;
}) {
  const { tier } = useMembership();
  const sizing =
    size === "md" ? "px-2.5 py-1 text-[11.5px]" : "px-2.5 py-1 text-[10.5px]";
  const iconSize = size === "md" ? "h-3 w-3" : "h-2.5 w-2.5";

  // Hard gate: only Verified Partners can offer rewards. Web-listed venues
  // never resolve a rate; a Verified Partner may also choose not to set one.
  const isFirstVisit = venue.is_first_visit !== false;
  const promoPercent = resolvePromoRateFromVenueRow(
    venue as unknown as Record<string, unknown>,
    isFirstVisit,
    tier === "premium",
  );

  // No reward at the current tier. Hidden by default; when the caller opts
  // in, the absence is stated with a neutral pill rather than vanishing — the
  // same "mention it" treatment as the venue-detail Reward section.
  if (promoPercent == null) {
    if (!showWhenEmpty) return null;
    return (
      <span
        className={`inline-flex max-w-full items-center gap-1.5 rounded-md border border-white/35 bg-black/45 whitespace-nowrap text-white ${sizing}`}
      >
        <Gift className={`${iconSize} shrink-0`} strokeWidth={2.25} />
        <span className="font-semibold">No Reward for You</span>
      </span>
    );
  }

  const promoKindLabel = isFirstVisit ? "welcome" : "return-visit";
  const mechanicWord = "discount";
  const tierLabel = tierProperLabel(tier);
  const capPrefix = venue.currency === "MXN" ? "MX$" : "$";
  // Ticket cap: the reward applies to the first N of the bill, then full
  // price — not a ceiling on the reward itself. 0/null means no cap.
  const capLabel =
    venue.reward_cap_mxn != null && venue.reward_cap_mxn > 0
      ? `applies to your first ${capPrefix}${venue.reward_cap_mxn.toLocaleString("en-US")}`
      : null;

  return (
    <span
      className={`bg-pink-gradient shadow-glow inline-flex max-w-full items-center gap-1.5 rounded-md whitespace-nowrap text-white ${sizing}`}
      title={
        capLabel
          ? `at Mesita ${tierLabel} · ${capLabel}`
          : `at Mesita ${tierLabel}`
      }
    >
      <Gift className={`${iconSize} shrink-0`} strokeWidth={2.25} />
      <span className="font-semibold">
        {promoPercent}% {mechanicWord} · {promoKindLabel}
      </span>
    </span>
  );
}
