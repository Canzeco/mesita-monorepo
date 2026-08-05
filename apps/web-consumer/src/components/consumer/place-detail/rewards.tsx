"use client";

import Link from "next/link";
import {
  Crown,
  Gift,
  MapPin,
  QrCode,
  Sparkles,
  Star,
  Ticket,
} from "lucide-react";

import { useConsumerClass } from "@/lib/class-context";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import type { PlaceDetail } from "@/lib/mock/place";
import {
  placeOffersMesitaRewards,
  strategyForPromoMatrix,
} from "@/lib/promo-rates";
import {
  REWARD_SEGMENT_BY_KEY,
  segmentKeyForClass,
} from "@/lib/reward-segments";

import { Box, BoxLabel } from "./box";
import { RewardStep, YourRewardsHere } from "./reward-matrix";

// ── Rewards tab (v7, MESITA-861) ─────────────────────────────────────────
//
// Rebuilt against the Strategy × Class matrix (Notion §4.4) and the ticket
// lifecycle:
//   hero   — "Up to N%" and NOTHING about why (MESITA-860: the ribbon says
//            what you can get, never the reason). N = the guest's best
//            eligible rate at THIS place's strategy.
//   steps  — the wallet's own four steps, with "Pick place" pre-checked:
//            you're standing on it.
//   list   — the guest's OWN row of the big table, action by action. The
//            old Standard-vs-Premium comparison died: it classified the
//            guest and only knew first/returning (the v6 model).
//   CTAs   — "Get my ticket" routes to the wallet (the create flow lives
//            there, including the Influencer story interstitial); Standard
//            also sees "Go Premium".

export function RewardsBox({ place }: { place: PlaceDetail }) {
  const consumerClass = useConsumerClass();
  const classKey = consumerClass.key;

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
                ? "This Verified Partner isn't running a Mesita reward right now."
                : place.promo_configured
                  ? "Rewards are being set up for this place."
                  : "Only Verified Partners run the Mesita reward program — this place is a web listing."}
            </p>
          </div>
        </div>
      </Box>
    );
  }

  // The place's strategy, recovered from its four rate columns (a membership
  // writes them as one preset), then the guest's ceiling here: the best of
  // their standing rate and every action they can perform (story only for
  // Influencers, per segments v6 — the gate is upstream, not here).
  const strategy = strategyForPromoMatrix(place.promo_matrix);
  const mineRate =
    REWARD_SEGMENT_BY_KEY[segmentKeyForClass(classKey)].rates[strategy];
  const candidates = [
    mineRate,
    REWARD_SEGMENT_BY_KEY.welcome.rates[strategy],
    REWARD_SEGMENT_BY_KEY.review.rates[strategy],
    ...(classKey === "influencer"
      ? [REWARD_SEGMENT_BY_KEY.story.rates[strategy]]
      : []),
  ];
  const upTo = Math.max(...candidates);

  const capLabel =
    place.reward_cap_mxn != null && place.reward_cap_mxn > 0
      ? `MX$${place.reward_cap_mxn.toLocaleString("en-US")}`
      : null;

  const isStandard = classKey === "standard";

  return (
    <Box title="Reward" icon={Sparkles} iconColor="text-pink-400">
      {/* Hero — what you can get. Never why (MESITA-860). */}
      <div className="bg-pink-gradient shadow-glow rounded-xl p-4 text-white">
        <p className="font-display text-3xl leading-none font-semibold">
          Up to {upTo}%
        </p>
        <p className="mt-1.5 text-xs leading-snug text-white/90">
          Discount for You — depending on your eligible bonuses
          {capLabel ? ` · on your first ${capLabel}` : ""}
        </p>
      </div>

      {/* How it works — the wallet's four steps, step 1 already done. */}
      <div className="flex flex-col gap-3">
        <BoxLabel>How it works</BoxLabel>
        <ol className="flex flex-col gap-3">
          <RewardStep
            n={1}
            icon={MapPin}
            title="Pick the place"
            body="Done — you're looking at it. Open your ticket from Rewards."
            done
          />
          <RewardStep
            n={2}
            icon={Star}
            title="Post your review"
            body="Do your bonuses before staff scan — a Google review, your Mesita rating, a story if you're an Influencer."
            accent
          />
          <RewardStep
            n={3}
            icon={QrCode}
            title="Show your QR"
            body="Staff scan your ticket QR with any phone — no app on their side."
          />
          <RewardStep
            n={4}
            icon={Sparkles}
            title="Pay less"
            body={`Your best discount comes off the bill${capLabel ? ` — on the first ${capLabel}` : ""}. You pay the place directly.`}
          />
        </ol>
      </div>

      {/* The guest's own row of the big table. */}
      <div className="flex flex-col gap-3">
        <BoxLabel>Your rewards here</BoxLabel>
        <YourRewardsHere strategy={strategy} classKey={classKey} />
      </div>

      {/* CTAs — the ticket flow lives in the wallet (including the
          Influencer story interstitial), so both buttons are honest doors. */}
      <div className="flex flex-col gap-2">
        {isStandard ? (
          <div className="flex gap-2">
            <Link href="/rewards" className={REWARD_PAY_BTN}>
              <Ticket className="h-4 w-4" />
              Get my ticket
            </Link>
            <Link href={CONSUMER_ROUTES.subscribe} className={REWARD_UPGRADE_BTN}>
              <Crown className="h-4 w-4" />
              Go Premium
            </Link>
          </div>
        ) : (
          <Link href="/rewards" className={REWARD_PAY_BTN}>
            <Ticket className="h-4 w-4" />
            Get my ticket
          </Link>
        )}
        <p className="text-muted-foreground text-center text-[11px] leading-snug">
          Open your ticket in Rewards — your best bonus applies on its own.
        </p>
      </div>
    </Box>
  );
}

// Shared CTA button classes for the Reward box. Primary = pink-gradient pill;
// secondary = outlined pill. Both grow to fill their row so the single-button
// and two-button layouts line up.
const REWARD_PAY_BTN =
  "bg-pink-gradient shadow-glow flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white";
const REWARD_UPGRADE_BTN =
  "border-border bg-card text-foreground hover:bg-muted flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold transition";
