"use client";

import Link from "next/link";
import { Crown, Gift, Instagram, QrCode, Sparkles } from "lucide-react";

import { useConsumerClass } from "@/lib/class-context";
import { classProperLabel } from "@/lib/consumer-data";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import type { PlaceDetail } from "@/lib/mock/place";
import {
  resolveActivePromoRate,
  placeOffersMesitaRewards,
} from "@/lib/promo-rates";

import { Box, BoxLabel } from "./box";
import { RewardMatrix, RewardStep } from "./reward-matrix";

// ── Reward (hero + Free/Premium × first/returning matrix) ───────────────

export function RewardsBox({ place }: { place: PlaceDetail }) {
  const consumerClass = useConsumerClass();
  const { welcome, default: returning, is_first_visit } = place.promo_matrix;
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

  // Active reward = welcome variant on a first visit, default variant
  // otherwise. Null means the place offers nothing at this class — the
  // hero still renders so the user knows where they stand.
  const activeValue = resolveActivePromoRate(
    place.promo_matrix,
    classKey,
    is_first_visit,
  );
  // Every Verified Partner runs an instant discount. Lowercase it when
  // reading inline with the percentage ("20% discount").
  const mechanicWord = place.details.mechanic.toLowerCase();
  // Short suffix for the class tiles, consistent with the hero — "70% off".
  const mechanicShort = "off";
  // Ticket cap (pesos): the reward applies to the first N of the bill, then
  // full price — it is not a ceiling on the reward. 0/null means no cap, so
  // the clause is dropped entirely.
  const capLabel =
    place.reward_cap_mxn != null && place.reward_cap_mxn > 0
      ? `MX$${place.reward_cap_mxn.toLocaleString("en-US")}`
      : null;
  // Concise one-line context (the class is already shown — highlighted — in
  // the matrix below, so we don't repeat "as Mesita Premium" here).
  const visitLabel = is_first_visit ? "First visit" : "Returning visit";
  const subtitle =
    activeValue == null
      ? `No reward at Mesita ${classProperLabel(classKey)} yet`
      : capLabel
        ? `${visitLabel} · on your first ${capLabel}`
        : visitLabel;
  // The claim action depends on the guest's own account, not the place:
  //   Standard → Pay with QR + Upgrade (claim now, or unlock a bigger reward)
  //   Elevated → one Pay-with-QR button, reward applies automatically
  // The class rung pays on every bill with no strings; the Story rung is the
  // INFLUENCER class's exclusive extra (segments v6 — resolveTicketRate,
  // _shared/rewards-config.ts), best-of so it only ever raises the rate.
  const isStandard = consumerClass.key === "standard";
  const isInfluencer = consumerClass.key === "influencer";
  return (
    <Box title="Reward" icon={Sparkles} iconColor="text-pink-400">
      {/* Hero — the active reward, mechanic, and cap. The box header already
          says "Reward", so no redundant "Your reward" eyebrow here. */}
      <div className="bg-pink-gradient shadow-glow rounded-xl p-4 text-white">
        <p className="font-display text-3xl leading-none font-semibold">
          {activeValue == null ? "—" : `${activeValue}% ${mechanicWord}`}
        </p>
        <p className="mt-1.5 text-xs leading-snug text-white/90">{subtitle}</p>
      </div>

      {/* How it works — the claim sequence, spelled out so every case is
          unambiguous at the table. The story is the Influencer class's
          OPTIONAL exclusive rung (best-of, so it only ever raises your
          rate) — never a requirement. */}
      <div className="flex flex-col gap-3">
        <BoxLabel>How it works</BoxLabel>
        <ol className="flex flex-col gap-3">
          <RewardStep
            n={1}
            icon={QrCode}
            title="Pay with your QR"
            body="Pay your bill and show your Mesita QR — the staff scan it to start your reward."
          />
          <RewardStep
            n={2}
            icon={Instagram}
            title={
              isInfluencer
                ? "Post a story — optional, yours as an Influencer"
                : "Post a story — Influencers only"
            }
            body={
              isInfluencer
                ? "Want more? Post a story tagging the place after the staff scan your QR for a bigger reward. Skip it and you still keep your class reward in full."
                : "The Instagram Story bonus is exclusive to the Influencer class (1,000+ followers). Every class keeps its own reward — and the Google review bonus is open to all."
            }
            accent
          />
          <RewardStep
            n={3}
            icon={Sparkles}
            title={`Get your ${mechanicWord}`}
            body={`Your ${mechanicWord} is applied automatically${capLabel ? ` — on the first ${capLabel} of your bill` : ""}.`}
          />
        </ol>
      </div>

      {/* One matrix instead of two ladders — First / Returning rows ×
          Standard / Premium columns. The active cell is highlighted ("you are
          here") so the hero's number isn't restated as a second big tile. */}
      <RewardMatrix
        welcome={welcome}
        returning={returning}
        currentClass={classKey}
        isFirstVisit={is_first_visit}
        suffix={mechanicShort}
      />

      {/* CTAs — class-aware so the exact action is unambiguous. Standard: Pay
          + Upgrade. Every elevated class: one Pay button, nothing else to
          do. */}
      <div className="flex flex-col gap-2">
        {isStandard ? (
          <div className="flex gap-2">
            <Link href="/rewards" className={REWARD_PAY_BTN}>
              <QrCode className="h-4 w-4" />
              Pay with QR
            </Link>
            <Link href={CONSUMER_ROUTES.me} className={REWARD_UPGRADE_BTN}>
              <Crown className="h-4 w-4" />
              Upgrade plan
            </Link>
          </div>
        ) : (
          <Link href="/rewards" className={REWARD_PAY_BTN}>
            <QrCode className="h-4 w-4" />
            Pay with QR to claim reward
          </Link>
        )}
        <p className="text-muted-foreground text-center text-[11px] leading-snug">
          {isStandard
            ? "Pay with your QR to claim your reward — or upgrade to Premium for a bigger one."
            : "Just pay with your QR — your reward applies automatically."}
        </p>
      </div>
    </Box>
  );
}

// Shared CTA button classes for the Reward box. Primary = pink-gradient pill
// (Pay with QR); secondary = outlined pill (Upgrade plan). Both grow to fill
// their row so the single-button and two-button layouts line up.
const REWARD_PAY_BTN =
  "bg-pink-gradient shadow-glow flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white";
const REWARD_UPGRADE_BTN =
  "border-border bg-card text-foreground hover:bg-muted flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold transition";
