"use client";

import { Gift } from "lucide-react";
import { useDiscountQuote } from "@/lib/discount-quotes";
import { upToPercentFromQuote } from "@/lib/discount-quote";
import { isPromoting, type PromoChipPlace } from "@/lib/promo-rates";
import { currencyPrefix } from "@/lib/place-price";

// Tiny shared building block for the place-card promo callout.
//
// Renders the "Up to X% Discount for You" pink-gradient pill
// at the bottom of the swipe overlay, the favorites/catalog tile and the
// place-detail header. Owns the kind logic and the cap tooltip so the
// surfaces can't drift.
//
// The rate is the ENGINE's (MESITA-1019). It used to be resolved here from
// the place's four v4 rate columns (welcome_/default_ × free/premium), which
// stopped being prices when v10 additive shipped: those columns carry
// strategy IDENTITY and the price moved into `promos_config.v11`. The
// mismatch was visible on one screen — an aggressive place quoted a
// bronze·free guest "Up to 30%" in this chip and "Up to 60%" in the Rewards
// box below it, and 30 was neither the guaranteed base (20) nor the ceiling
// (60). Worse, the column path keyed off `place.is_first_visit`, a field no
// Edge Function has ever written: it read `undefined` everywhere, so every
// guest was quoted the WELCOME column forever, including returning guests who
// had already spent it. Both numbers now come from
// `consumer-web-get-discount-quote` through the shared cache, and the total
// is `upToPercentFromQuote` — the same function the Rewards box prints.
//
// Rewards are a promoting-place capability. `promoting` is computed
// server-side per request (MESITA-1150); a place that isn't promoting
// short-circuits BEFORE the quote is requested, so an ordinary listing never
// costs a round trip. A promoting place may still resolve to nothing — a zero
// strategy, or an engine that returned no answer. Either way there is no
// fabricated promo: only a real, non-zero rate shows a filled ribbon. When
// there's no reward the chip renders nothing by default, or — if the caller
// passes `showWhenEmpty` — a stated "No reward for you" pill so the absence is
// stated rather than silently hidden.
//
// decision: Pato — on the place profile (`tone="light"`) the reward is the
// ONLY reward signal in the header (it was pulled out of the stat trio, which
// is now Google · Instagram · Mesita). So it can't read as one more grey tag:
// it carries the premium colour — `bg-tier-premium` (ink-black since the
// plan recolour, Pato 2026-08-22) when a rate resolves, a neutral outline when
// it doesn't. The empty state used to be a blue tint that rhymed with the old
// premium violet; with the violet gone it was a cool stray on a warm app. The
// dark tone (swipe overlay) and the `sm` catalog tile keep the pink-gradient
// ribbon.
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
   *  summary on white (premium-black chip — see the tone note above). */
  tone?: "dark" | "light";
}) {
  const sizing =
    size === "md" ? "px-2.5 py-1 text-xs" : "px-2.5 py-1 type-label";
  const iconSize = size === "md" ? "h-3 w-3" : "h-2.5 w-2.5";
  const emptyTone =
    tone === "light"
      ? "border-border bg-card text-muted-foreground border"
      : "border border-white/35 bg-black/60 text-white";

  // Hard gate, and the reason a deck of ordinary listings costs nothing: only
  // a promoting place is worth quoting. The server already weighed plan,
  // strategy and promo lane together to answer this.
  const promoting = isPromoting(place);
  const { quote, loading } = useDiscountQuote(promoting ? place.id : null);
  // `promoting` gates the RENDER, not just the request. The cache is keyed by
  // place id and outlives any one payload, so a place quoted while its promo
  // lane was open would keep painting that ribbon after a strike-2 pause
  // closed it — the same stale-gate failure `listing_type` was retired for
  // (MESITA-1150). Fail closed on every render.
  const promoPercent =
    promoting && quote && quote.strategy !== "zero"
      ? upToPercentFromQuote(quote)
      : null;

  // In flight. A skeleton rather than the empty pill: the chip is about to say
  // a number, and flashing "No Reward for You" first would state the opposite
  // of the answer on its way. Mirrors the Rewards box hero, which holds a
  // pulse in the same situation.
  if (promoting && loading) {
    return (
      <span
        className={`inline-flex max-w-full animate-pulse items-center gap-1.5 rounded-md whitespace-nowrap ${emptyTone} ${sizing}`}
        aria-hidden
      >
        <Gift
          className={`${iconSize} shrink-0`}
          strokeWidth={2.25}
        />
        <span className="font-semibold opacity-0">Up to 00% Discount</span>
      </span>
    );
  }

  // No reward here. Hidden by default; when the caller opts in, the absence is
  // stated with a neutral pill rather than vanishing — the same "mention it"
  // treatment as the place-detail Reward section.
  if (promoPercent == null || promoPercent <= 0) {
    if (!showWhenEmpty) return null;
    return (
      <span
        className={`inline-flex max-w-full items-center gap-1.5 rounded-md whitespace-nowrap ${emptyTone} ${sizing}`}
      >
        <Gift
          className={`${iconSize} shrink-0`}
          strokeWidth={2.25}
        />
        <span className="font-semibold">No Reward for You</span>
      </span>
    );
  }

  // NEVER the reason (Pato, 2026-08-03): the ribbon states what you can get,
  // never WHY — no "welcome", no "return-visit", no class. The mechanism
  // lives on the ticket and the place page, not on a card chip.
  const capPrefix = currencyPrefix(place.currency);
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
