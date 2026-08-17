"use client";

import { Gift, Sparkles } from "lucide-react";

import { useEffect, useState } from "react";

import { apiGetRewardQuote, type RewardQuote } from "@/lib/api/tickets";
import { useConsumerClass } from "@/lib/class-context";
import type { PlaceDetail } from "@/lib/mock/place";
import { placeOffersMesitaRewards } from "@/lib/promo-rates";
import { useBrowserSupabase } from "@/lib/supabase/browser";

import { Box, BoxLabel } from "./box";
import {
  BonusList,
  ClassLadder,
  PlanRow,
  RateSheetSkeleton,
  RewardTotal,
} from "./reward-matrix";

// ── Rewards tab (v8, MESITA-1068) ────────────────────────────────────────
//
// Pato, live 2026-08-17: "simply mention all the tiers for different
// segments. and the total and the cap. not buttons there. buttons are already
// below."
//
// THIS TAB IS A RATE SHEET. v7 was a brochure — an "Up to N%" hero, a
// four-step how-it-works tutorial, the guest's own row, then two CTAs. Three
// of those four blocks were answering questions the guest didn't ask on a tab
// literally labelled "Rewards", and the tutorial duplicated the wallet's own
// steps at the moment the guest is furthest from using them.
//
//   hero    — "Up to N%", the total, and the cap. Still no reason (MESITA-860).
//   classes — EVERY class's standing rate here, the guest's marked. Reverses
//             MESITA-861, which showed the guest only their own row: a rate
//             sheet that hides the rungs above you can't say what a class is
//             worth, and the classes are the product.
//   bonuses — the actions, priced, with the ones you can't do today muted.
//   total   — the number that lands on the bill, and the cap it applies to.
//
// NO BUTTONS. Visit · Order · Reserve are pinned in the action bar below
// (MESITA-1065), so a "Get my ticket" CTA here was a second door to a place
// the guest can already reach without scrolling.

export function RewardsBox({ place }: { place: PlaceDetail }) {
  const consumerClass = useConsumerClass();
  const classKey = consumerClass.key;
  const plan = consumerClass.plan;
  const supabase = useBrowserSupabase();

  // The guest's real numbers for THIS place, from the engine. Must run before
  // the offersRewards early return below — hooks can't be conditional.
  const placeId = place.id;
  const [quoteRes, setQuoteRes] = useState<{
    placeId: string;
    quote: RewardQuote;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiGetRewardQuote(supabase, placeId);
        if (!cancelled) setQuoteRes({ placeId, quote: res.quote });
      } catch {
        // Non-fatal: the sheet stays in its loading shape rather than quoting
        // a rate the bill won't honor.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [placeId, supabase]);
  const quote = quoteRes?.placeId === placeId ? quoteRes.quote : null;

  const offersRewards = placeOffersMesitaRewards({
    listing_type: place.listing_type,
    promo_matrix: place.promo_matrix,
    promo_configured: place.promo_configured === true,
  });
  const isPartner = place.listing_type === "partner";

  if (!offersRewards) {
    return (
      <Box title="Reward" icon={Sparkles} iconColor="text-pink-400">
        <div className="flex flex-col items-center gap-3 py-3 text-center">
          <span className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded-full">
            <Gift className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-foreground text-sm font-semibold">
              This place doesn&apos;t offer rewards
            </p>
            <p className="text-muted-foreground text-xs leading-snug">
              {isPartner
                ? "This Mesita Partner isn't running a Mesita reward right now."
                : place.promo_configured
                  ? "Rewards are being set up for this place."
                  : "Only Mesita Partners run the Mesita reward program — this place is a web listing."}
            </p>
          </div>
        </div>
      </Box>
    );
  }

  // The guest's ceiling here, from the ENGINE (MESITA-1017). This was
  // Math.max() over the static ladder — best-of — but the v10 engine ADDS
  // base + welcome + every earned bonus, so the max understated the hero by
  // ~20 points (Standard/conservative advertised 25% against a real 45%).
  // The most persuasive number on the page was the most wrong.
  const upTo = quote
    ? quote.additive
      ? Math.min(
          100,
          quote.base +
            quote.bonuses.welcome +
            quote.bonuses.story +
            quote.bonuses.google +
            quote.bonuses.mesita,
        )
      : Math.max(
          quote.base,
          quote.bonuses.welcome,
          quote.bonuses.story,
          quote.bonuses.google,
        )
    : null;

  const capLabel =
    place.reward_cap_mxn != null && place.reward_cap_mxn > 0
      ? `MX$${place.reward_cap_mxn.toLocaleString("en-US")}`
      : null;

  return (
    <Box title="Reward" icon={Sparkles} iconColor="text-pink-400">
      {/* Hero — what you can get. Never why (MESITA-860). */}
      <div className="bg-pink-gradient shadow-glow rounded-xl p-4 text-white">
        <p className="font-display text-3xl leading-none font-semibold">
          {upTo == null ? (
            <span className="inline-block h-7 w-28 animate-pulse rounded bg-white/25 align-middle" />
          ) : (
            `Up to ${upTo}%`
          )}
        </p>
        <p className="mt-1.5 text-xs leading-snug text-white/90">
          Discount for You — depending on your eligible bonuses
          {capLabel ? ` · on your first ${capLabel}` : ""}
        </p>
      </div>

      {/* Every class's standing rate here, the guest's own marked. */}
      <div className="flex flex-col gap-3">
        <BoxLabel>Rate by class</BoxLabel>
        {quote ? (
          <ClassLadder quote={quote} classKey={classKey} />
        ) : (
          <RateSheetSkeleton />
        )}
      </div>

      {/* The plan, on its own. Classes v2 (MESITA-1079) splits identity into
          two axes that "never merge", and this sheet is where the merge was
          most visible: Premium used to sit in the ladder above as a rung
          between Influencer and Aura. A separate label is the whole fix —
          what you earn, then what you can buy. */}
      {quote ? (
        <div className="flex flex-col gap-3">
          <BoxLabel>Rate by plan</BoxLabel>
          <PlanRow quote={quote} plan={plan} />
        </div>
      ) : null}

      {/* The actions, priced. */}
      <div className="flex flex-col gap-3">
        <BoxLabel>Bonuses you can add</BoxLabel>
        {quote ? <BonusList quote={quote} /> : <RateSheetSkeleton />}
      </div>

      {/* The total and the cap — the two numbers the guest acts on. */}
      {quote && upTo != null ? (
        <RewardTotal quote={quote} total={upTo} capLabel={capLabel} />
      ) : null}
    </Box>
  );
}
