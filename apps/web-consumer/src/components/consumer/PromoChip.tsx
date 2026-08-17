"use client";

import { Gift } from "lucide-react";
import { isElevatedIdentity } from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import {
  resolvePromoRateFromPlaceRow,
  type PromoChipPlace,
} from "@/lib/promo-rates";

// Tiny shared building block for the place-card promo callout.
//
// Renders the "Up to X% Discount for You" pink-gradient pill
// at the bottom of both the swipe overlay and the catalog/saved tile. Owns
// the per-class rate resolution, kind logic, and the class+cap tooltip so the
// two surfaces can't drift.
//
// The rate is REAL: it's read from the place's per-class promo columns
// (welcome_/default_ × free/premium, migration 0032) for the current
// guest's class.
//
// Rewards are a Verified-Partner-only capability. Web-listed places never
// offer rewards — a hard rule the chip enforces by short-circuiting on
// listing_type, independent of any reward columns the row might still
// carry. A Mesita Partner MAY also choose not to set a rate. Either way
// there is no fabricated promo: only a partner with a real, non-zero rate
// shows a filled ribbon. When there's no reward the chip renders nothing by
// default, or — if the caller passes `showWhenEmpty` — a stated
// "No reward for you" pill so the absence is stated rather than silently
// hidden.
//
// decision: Pato — on the place profile (`tone="light"`) the reward is the
// ONLY reward signal in the header (it was pulled out of the stat trio, which
// is now Google · Instagram · Mesita). So it can't read as one more grey tag:
// it carries the premium violet — `bg-tier-premium` when a rate resolves, a
// violet-tinted outline when it doesn't. The dark tone (swipe overlay) and the
// `sm` catalog tile keep the pink-gradient ribbon.
//
// `size` lets the caller pick chip vs body weight:
//   - "sm" (default) — catalog / saved tile
//   - "md"           — swipe overlay
export function PromoChip({
  place,
  size = "sm",
  showWhenEmpty = false,
  tone = "dark",
}: {
  place: PromoChipPlace;
  size?: "sm" | "md";
  /** When the place has no reward, render a neutral "No reward for you" pill
   *  instead of nothing. Off by default so the catalog/saved tile stays
   *  clean; the swipe card opts in to state the absence explicitly. */
  showWhenEmpty?: boolean;
  /** `dark` = swipe overlay (white on black/45). `light` = place profile
   *  summary on white (violet chip — see the tone note above). */
  tone?: "dark" | "light";
}) {
  const { key: classKey, plan } = useConsumerClass();
  const sizing =
    size === "md" ? "px-2.5 py-1 text-[11.5px]" : "px-2.5 py-1 text-[10.5px]";
  const iconSize = size === "md" ? "h-3 w-3" : "h-2.5 w-2.5";
  const emptyTone =
    tone === "light"
      ? "border border-blue-200 bg-blue-50 text-blue-700"
      : "border border-white/35 bg-black/45 text-white";
  const emptyIconTone = tone === "light" ? "text-blue-500" : undefined;

  // Hard gate: only Mesita Partners can offer rewards. Web-listed places
  // never resolve a rate; a Mesita Partner may also choose not to set one.
  const isFirstVisit = place.is_first_visit !== false;
  const promoPercent = resolvePromoRateFromPlaceRow(
    place,
    isFirstVisit,
    isElevatedIdentity({ cls: classKey, plan }),
  );

  // No reward at the current class. Hidden by default; when the caller opts
  // in, the absence is stated with a neutral pill rather than vanishing — the
  // same "mention it" treatment as the place-detail Reward section.
  if (promoPercent == null) {
    if (!showWhenEmpty) return null;
    return (
      <span
        className={`inline-flex max-w-full items-center gap-1.5 rounded-md whitespace-nowrap ${emptyTone} ${sizing}`}
      >
        <Gift
          className={`${iconSize} shrink-0 ${emptyIconTone ?? ""}`}
          strokeWidth={2.25}
        />
        <span className="font-semibold">No Reward for You</span>
      </span>
    );
  }

  // NEVER the reason (Pato, 2026-08-03): the ribbon states what you can get,
  // never WHY — no "welcome", no "return-visit", no class. The mechanism
  // lives on the ticket and the place page, not on a card chip.
  const capPrefix = place.currency === "MXN" ? "MX$" : "$";
  // Ticket cap: the reward applies to the first N of the bill, then full
  // price — not a ceiling on the reward itself. 0/null means no cap.
  const capLabel =
    place.reward_cap_mxn != null && place.reward_cap_mxn > 0
      ? `applies to your first ${capPrefix}${place.reward_cap_mxn.toLocaleString("en-US")}`
      : null;

  return (
    <span
      className={`shadow-glow inline-flex max-w-full items-center gap-1.5 rounded-md whitespace-nowrap text-white ${tone === "light" ? "bg-tier-premium" : "bg-pink-gradient"} ${sizing}`}
      title={capLabel ?? "Depending on your eligible bonuses"}
    >
      <Gift className={`${iconSize} shrink-0`} strokeWidth={2.25} />
      <span className="font-semibold">
        Up to {promoPercent}% Discount for You
      </span>
    </span>
  );
}
