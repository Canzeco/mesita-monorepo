"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, BadgeCheck, CreditCard, ShieldCheck } from "lucide-react";
import { getPlaceVerification, type AdminPlace } from "../actions";
import { ReadField, SectionCard } from "../ui";
import {
  effectiveStrikeCount,
  isMemberPlan,
  membershipPillState,
} from "./promo-state";
import { strategyForPlace } from "@/lib/business/strategies";

// Three facts about a place — Verified · Plan · Partner (MESITA-1148).
//
// Pato asked for three boxes and named the third "Member". It can't be:
// project_members is the Team box on the Settings tab (owner/editor/viewer),
// and consumers carry plans of their own. The money word this schema already
// uses is PLAN (projects.plan = free | pro | ultra), so that is the word.
//
// They are three INDEPENDENT facts, not one ladder — a place can be any
// combination, and the console has to be able to answer "who pays and gives
// nothing?" Today it can't: _shared/partner-derivation.ts fuses two of them
// into a single stored enum (listing_type = 'partner' iff plan ≠ free AND
// strategy ≠ zero), so the three questions have one answer between them.
//
// Pato's rule, live: "imagine users see partner but it doesn't offer rewards.
// so partner must mean that he offers rewards." Since listing_type is
// re-derived only on WRITES, a strike-2 pause leaves the stored badge standing
// over a closed promo lane. The Partner box therefore computes the live answer
// and, when the stored badge disagrees, says so instead of repeating it.

/** Does a guest get a discount here RIGHT NOW? The live read, not the badge. */
function offersRewardNow(place: AdminPlace): boolean {
  if (!isMemberPlan(place.plan)) return false;
  const strategy = strategyForPlace({
    welcome_free_rate: place.welcome_free_rate,
    welcome_premium_rate: place.welcome_premium_rate,
    free_rate: place.free_rate,
    premium_rate: place.premium_rate,
  });
  if (strategy === null || strategy === "zero") return false;
  const state = membershipPillState(place);
  // Paused (strike 2) and forfeited (strike 3) both close the promo lane.
  // `pending` still offers — the place has promised a discount, it just
  // hasn't honored its first check yet.
  return state !== "paused" && state !== "forfeited";
}

// ── 1 · Verified — has anyone proven they own this place? ───────────────────
export function VerifiedCard({ place }: { place: AdminPlace }) {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getPlaceVerification(place.id).then((r) => {
      if (!alive) return;
      if (!r.ok) {
        setError(r.error);
        setEmail(null);
        return;
      }
      setError(null);
      setEmail(r.data.verifiedByEmail);
    });
    return () => {
      alive = false;
    };
  }, [place.id]);

  const verified = typeof email === "string" && email.length > 0;

  return (
    <SectionCard
      icon={<ShieldCheck className="h-4 w-4" />}
      tint="emerald"
      title="Verified"
      subtitle="Somebody proved they own this place. Ownership only — it grants no badge and no discount."
      action={
        <span
          className={
            "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold " +
            (verified
              ? "bg-emerald-500/10 text-emerald-700"
              : "bg-muted text-muted-foreground")
          }
        >
          {email === undefined ? "Checking…" : verified ? "Verified" : "Unclaimed"}
        </span>
      }
    >
      <p className="text-muted-foreground mt-5 text-xs leading-relaxed">
        Proof is a one-time act: an OTP to the place&apos;s own phone or
        on-domain email, or an operator&apos;s decision in the Verification
        Queue. It never expires and it never lapses — a place that stops paying
        stays verified, because it is still the same owner.
      </p>
      <div className="mt-4">
        <ReadField label="Verified by" boxed>
          {error ? (
            <span className="text-destructive text-xs">{error}</span>
          ) : email === undefined ? (
            <span className="text-muted-foreground text-xs">Checking…</span>
          ) : !verified ? (
            <span className="text-muted-foreground text-xs italic">
              Nobody has completed ownership verification yet.
            </span>
          ) : (
            <span className="truncate font-mono text-[13px]">{email}</span>
          )}
        </ReadField>
      </div>
    </SectionCard>
  );
}

// ── 2 · Plan — does the place pay Mesita? ──────────────────────────────────
const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  ultra: "Ultra",
};

const PLAN_STATE_COPY: Record<string, string> = {
  not_member: "No paid plan. The place is listed and costs it nothing.",
  pending: "Paid, not yet live — the first honored guest check switches it on.",
  live: "Paid and live.",
  paused: "Paid, but the promo lane is paused after a second strike.",
  forfeited: "Forfeited after three strikes — re-joining is an operator's call.",
};

export function PlanCard({ place }: { place: AdminPlace }) {
  const plan = typeof place.plan === "string" ? place.plan : "free";
  const paid = isMemberPlan(plan);
  const state = membershipPillState(place);
  const strikes = effectiveStrikeCount(place);

  return (
    <SectionCard
      icon={<CreditCard className="h-4 w-4" />}
      tint="sky"
      title="Plan"
      subtitle="What the place pays Mesita. Never shown to a guest — what they get is the Partner box."
      action={
        <span
          className={
            "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold " +
            (paid ? "bg-sky-500/10 text-sky-700" : "bg-muted text-muted-foreground")
          }
        >
          {PLAN_LABEL[plan] ?? plan}
        </span>
      }
    >
      <p className="text-muted-foreground mt-5 text-xs leading-relaxed">
        {PLAN_STATE_COPY[state] ?? PLAN_STATE_COPY.not_member} Paying buys the
        right to run a discount strategy, never placement — rank is not for
        sale. Granting a plan without Stripe is an admin door of its own; the
        business-facing join lives on the Promos tab.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ReadField label="Strikes" boxed>
          {strikes > 0 ? `${strikes} active (of 3)` : "None"}
        </ReadField>
        <ReadField label="Live since" boxed>
          {typeof place.plan_live_at === "string" && place.plan_live_at
            ? place.plan_live_at.slice(0, 10)
            : "—"}
        </ReadField>
      </div>
    </SectionCard>
  );
}

// ── 3 · Partner — does a guest get a discount here right now? ──────────────
export function PartnerCard({ place }: { place: AdminPlace }) {
  const offering = offersRewardNow(place);
  const badged = place.listing_type === "partner";
  const strategy = strategyForPlace({
    welcome_free_rate: place.welcome_free_rate,
    welcome_premium_rate: place.welcome_premium_rate,
    free_rate: place.free_rate,
    premium_rate: place.premium_rate,
  });
  const state = membershipPillState(place);

  return (
    <SectionCard
      icon={<BadgeCheck className="h-4 w-4" />}
      tint="pink"
      title="Partner"
      subtitle="The only one of the three a guest ever sees — and it must mean a discount is live here."
      action={
        <span
          className={
            "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold " +
            (offering
              ? "bg-pink-500/10 text-pink-600"
              : "bg-muted text-muted-foreground")
          }
        >
          {offering ? "Partner" : "Not a partner"}
        </span>
      }
    >
      <p className="text-muted-foreground mt-5 text-xs leading-relaxed">
        Computed live from what the place actually offers: a paid plan, a
        strategy above Zero, and a promo lane that isn&apos;t paused. Partner is
        not a rank and not a reward for paying — it is the promise a guest reads
        on the card, so it has to be true at the moment they read it.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ReadField label="Strategy" boxed>
          {strategy === null
            ? "Custom rates (no preset)"
            : strategy === "zero"
              ? "Zero — no discount"
              : strategy.charAt(0).toUpperCase() + strategy.slice(1)}
        </ReadField>
        <ReadField label="Promo lane" boxed>
          {state === "paused"
            ? "Paused"
            : state === "forfeited"
              ? "Closed"
              : offering
                ? "Open"
                : "Nothing to offer"}
        </ReadField>
      </div>
      {badged !== offering ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200/70 bg-amber-50/60 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <p className="text-[11px] leading-relaxed text-amber-900">
            <span className="font-semibold">
              The stored badge disagrees with the live answer.
            </span>{" "}
            {badged
              ? "projects.listing_type still says 'partner' while nothing is on offer, so guest surfaces are showing a Partner badge over a closed promo lane."
              : "This place offers a live discount but is not stored as 'partner', so guest surfaces gate the reward off and no guest can claim it."}{" "}
            listing_type is re-derived only when something writes the place —
            a pause never rewrites it. Any write to plan or rates re-syncs it.
          </p>
        </div>
      ) : null}
    </SectionCard>
  );
}
