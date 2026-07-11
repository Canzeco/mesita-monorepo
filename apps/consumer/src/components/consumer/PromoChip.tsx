"use client";

import { Gift } from "lucide-react";
import { classProperLabel } from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import { resolvePromoRateFromPlaceRow } from "@/lib/promo-rates";
import type { Place } from "@/lib/api/places";

// Tiny shared building block for the place-card promo callout.
//
// Renders the "X% OFF welcome / return-visit discount" pink-gradient pill
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
  place,
  size = "sm",
  showWhenEmpty = false,
  tone = "dark",
}: {
  place: Place;
  size?: "sm" | "md";
  /** When the place has no reward, render a neutral "No reward for you" pill
   *  instead of nothing. Off by default so the catalog/saved tile stays
   *  clean; the swipe card opts in to state the absence explicitly. */
  showWhenEmpty?: boolean;
  /** `dark` = swipe overlay (white on black/45). `light` = place profile
   *  summary on white (bordered card chip). */
  tone?: "dark" | "light";
}) {
  const { key: classKey } = useConsumerClass();
  const sizing =
    size === "md" ? "px-2.5 py-1 text-[11.5px]" : "px-2.5 py-1 text-[10.5px]";
  const iconSize = size === "md" ? "h-3 w-3" : "h-2.5 w-2.5";
  const emptyTone =
    tone === "light"
      ? "border-border bg-card text-foreground border"
      : "border border-white/35 bg-black/45 text-white";

  // Hard gate: only Verified Partners can offer rewards. Web-listed places
  // never resolve a rate; a Verified Partner may also choose not to set one.
  const isFirstVisit = place.is_first_visit !== false;
  const promoPercent = resolvePromoRateFromPlaceRow(
    place as unknown as Record<string, unknown>,
    isFirstVisit,
    classKey === "premium",
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
        <Gift className={`${iconSize} shrink-0`} strokeWidth={2.25} />
        <span className="font-semibold">No Reward for You</span>
      </span>
    );
  }

  const promoKindLabel = isFirstVisit ? "welcome" : "return-visit";
  const mechanicWord = "discount";
  const classLabel = classProperLabel(classKey);
  const capPrefix = place.currency === "MXN" ? "MX$" : "$";
  // Ticket cap: the reward applies to the first N of the bill, then full
  // price — not a ceiling on the reward itself. 0/null means no cap.
  const capLabel =
    place.reward_cap_mxn != null && place.reward_cap_mxn > 0
      ? `applies to your first ${capPrefix}${place.reward_cap_mxn.toLocaleString("en-US")}`
      : null;

  return (
    <span
      className={`bg-pink-gradient shadow-glow inline-flex max-w-full items-center gap-1.5 rounded-md whitespace-nowrap text-white ${sizing}`}
      title={
        capLabel
          ? `at Mesita ${classLabel} · ${capLabel}`
          : `at Mesita ${classLabel}`
      }
    >
      <Gift className={`${iconSize} shrink-0`} strokeWidth={2.25} />
      <span className="font-semibold">
        {promoPercent}% {mechanicWord} · {promoKindLabel}
      </span>
    </span>
  );
}
