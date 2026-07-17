"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Crown, Gift, Instagram, QrCode, Sparkles } from "lucide-react";

import { useConsumerClass } from "@/lib/class-context";
import { classProperLabel } from "@/lib/consumer-data";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import type { ConsumerClass, PlaceDetail } from "@/lib/mock/place";
import {
  resolveActivePromoRate,
  placeOffersMesitaRewards,
} from "@/lib/promo-rates";
import { cn } from "@/lib/utils";

import { Box, BoxLabel } from "./box";

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
  //   free            → Pay with QR + Upgrade (claim now, or unlock a bigger
  //                     Premium reward)
  //   Premium (paid)  → one Pay-with-QR button, reward applies automatically
  //   Premium via IG  → one button: Pay with QR *and* post an Instagram story,
  //                     since the story is what re-verifies the IG Premium class
  const isFree = consumerClass.key === "free";
  const isPremiumViaInstagram = !isFree && consumerClass.origin === "instagram";
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
          unambiguous at the table. The Instagram-story step only applies to
          guests whose Premium comes from Instagram; Free and paid-Premium
          guests skip straight to the reward, so it's labelled rather than
          hidden. */}
      <div className="flex flex-col gap-3">
        <BoxLabel>How it works</BoxLabel>
        <ol className="flex flex-col gap-3">
          <RewardStep
            n={1}
            icon={QrCode}
            title="Pay with your QR"
            body="Pay your bill and show your Mesita QR — the waiter scans it to start your reward."
          />
          <RewardStep
            n={2}
            icon={Instagram}
            title="Post a story — Premium via Instagram only"
            body="If your Premium comes from Instagram, post a story tagging the place right after the waiter scans your QR. Free and paid-Premium guests skip this step."
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
          Free / Premium columns. The active cell is highlighted ("you are
          here") so the hero's number isn't restated as a second big tile. */}
      <RewardMatrix
        welcome={welcome}
        returning={returning}
        currentClass={classKey}
        isFirstVisit={is_first_visit}
        suffix={mechanicShort}
      />

      {/* CTAs — class- and source-aware so the exact action is unambiguous.
          Free: Pay + Upgrade. Paid Premium: one Pay button. Instagram
          Premium: one Pay-and-post-story button. */}
      <div className="flex flex-col gap-2">
        {isFree ? (
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
            {isPremiumViaInstagram
              ? "Pay with QR & post IG story"
              : "Pay with QR to claim reward"}
          </Link>
        )}
        <p className="text-muted-foreground text-center text-[11px] leading-snug">
          {isFree
            ? "Pay with your QR to claim your reward — or upgrade to Premium for a bigger one."
            : isPremiumViaInstagram
              ? "Pay with your QR, then post an Instagram story to unlock your Premium reward."
              : "Just pay with your QR — your Premium reward applies automatically."}
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

// One numbered step in the "How it works" sequence. The badge carries the
// step number; the tinted icon circle reads premium-violet for the
// Instagram-only step and brand-pink otherwise.
function RewardStep({
  n,
  icon: Icon,
  title,
  body,
  accent,
}: {
  n: number;
  icon: LucideIcon;
  title: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <li className="flex gap-3">
      <span
        className={cn(
          "relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          accent
            ? "bg-tier-premium/10 text-premium"
            : "bg-secondary/10 text-secondary",
        )}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        <span className="bg-foreground text-background absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold">
          {n}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-[13px] leading-tight font-semibold">
          {title}
        </p>
        <p className="text-muted-foreground mt-0.5 text-[12px] leading-snug">
          {body}
        </p>
      </div>
    </li>
  );
}

// Compact reward matrix — First / Returning rows × Free / Premium columns.
// Mirrors the Class comparison table on the Profile (FreeVsPremium) for
// visual consistency. The active cell (current class × current visit axis)
// is highlighted so "you are here" is obvious.
function RewardMatrix({
  welcome,
  returning,
  currentClass,
  isFirstVisit,
  suffix,
}: {
  welcome: { free: number | null; premium: number | null };
  returning: { free: number | null; premium: number | null };
  currentClass: ConsumerClass;
  isFirstVisit: boolean;
  /** Reward unit shown after the percent, e.g. "off". */
  suffix: string;
}) {
  const rows = [
    { key: "first", label: "First visit", vals: welcome, onAxis: isFirstVisit },
    {
      key: "returning",
      label: "Returning",
      vals: returning,
      onAxis: !isFirstVisit,
    },
  ] as const;
  return (
    <div className="border-border relative overflow-hidden rounded-xl border">
      {/* Continuous tint behind the whole Premium column (right third) so it
          reads as one column, not patched per cell. */}
      <span
        aria-hidden
        className="bg-tier-premium/[0.05] pointer-events-none absolute inset-y-0 right-0 w-1/3"
      />
      <div className="relative">
        {/* Header — Free / Premium columns. */}
        <div className="grid grid-cols-3 items-center px-3 py-2.5">
          <span />
          <span className="font-display text-center text-[13px] font-bold tracking-tight">
            Free
          </span>
          <span className="text-premium font-display flex items-center justify-center gap-1 text-[13px] font-bold tracking-tight">
            <Crown className="h-3 w-3 fill-current" />
            Premium
          </span>
        </div>
        {rows.map((r, i) => (
          <div
            key={r.key}
            className={cn(
              "grid grid-cols-3 items-center px-3 py-3",
              i > 0 && "border-border/40 border-t",
            )}
          >
            <span className="text-muted-foreground text-[10px] font-bold tracking-[0.12em] uppercase">
              {r.label}
            </span>
            <RewardCell
              value={r.vals.free}
              suffix={suffix}
              active={r.onAxis && currentClass === "free"}
            />
            <RewardCell
              value={r.vals.premium}
              suffix={suffix}
              accent
              active={r.onAxis && currentClass === "premium"}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function RewardCell({
  value,
  suffix,
  accent,
  active,
}: {
  value: number | null;
  suffix: string;
  accent?: boolean;
  active?: boolean;
}) {
  const text = value == null ? "—" : `${value}%`;
  const num = (
    <span
      className={cn(
        "font-display text-[15px] leading-none font-bold",
        active ? "text-white" : accent ? "text-premium" : "text-foreground/80",
      )}
    >
      {text}
    </span>
  );
  const unit =
    value != null ? (
      <span
        className={cn(
          "text-[10px]",
          active
            ? "text-white/85"
            : accent
              ? "text-premium/80"
              : "text-muted-foreground",
        )}
      >
        {suffix}
      </span>
    ) : null;

  if (active) {
    return (
      <span className="flex items-center justify-center">
        <span className="bg-pink-gradient shadow-glow relative inline-flex items-baseline gap-0.5 rounded-lg py-1.5 pr-5 pl-3">
          {num}
          {unit}
          <span className="absolute top-0.5 right-1.5 text-[7px] font-bold tracking-[0.1em] text-white/85 uppercase">
            Now
          </span>
        </span>
      </span>
    );
  }
  return (
    <span className="flex items-baseline justify-center gap-0.5">
      {num}
      {unit}
    </span>
  );
}
