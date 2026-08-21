"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Gift, Handshake, ShieldCheck } from "lucide-react";
import { getPlaceVerification, type AdminPlace } from "../actions";
import { ReadField, SectionCard } from "../ui";
import {
  effectiveStrikeCount,
  isMemberPlan,
  membershipPillState,
} from "./promo-state";
import { strategyForPlace } from "@/lib/business/strategies";

// Three booleans about a place — Verified · Partner · Rewards (MESITA-1152).
//
// Pato settled the split live: "verified makes a lot of sense. but don't you
// think that partner must be if it pays the subscription, independently of
// its offers rewards. maybe we can make a binary too saying Promos(rewards).
// so three booleans."
//
//   isVerified  someone proved they own the place. One-time, never lapses.
//   isPartner   the place pays Mesita. A DEAL — stable, and internal.
//   isRewards   a guest gets a discount here RIGHT NOW. Volatile, and the
//               only one of the three a guest may ever be shown.
//
// Why the volatile fact is its own boolean: a deal doesn't change hour to
// hour, but an offer does — a strike-2 pause closes the promo lane, a
// strategy change empties it. Fusing them (which is what stored
// `listing_type = 'partner'` still does: plan ≠ free AND strategy ≠ zero)
// makes both facts unanswerable and lets a badge go stale over a dead lane.
//
// "Member" is not available as a word: project_members is the Team box on the
// Settings tab (owner/editor/viewer), and consumers carry plans of their own.
// The plan itself (free | pro | ultra) is a detail INSIDE Partner, not a
// fourth box — the headline is whether they pay.

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
      subtitle="Somebody proved they own this place. Ownership only — it grants no discount and buys nothing."
      action={<Pill on={verified} tint="emerald" loading={email === undefined}>
        {verified ? "Verified" : "Unclaimed"}
      </Pill>}
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

// ── 2 · Partner — does the place pay Mesita? ───────────────────────────────
const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  ultra: "Ultra",
};

const PARTNER_STATE_COPY: Record<string, string> = {
  not_member: "No subscription. The place is listed and it costs them nothing.",
  pending: "Subscribed, not yet live — the first honored guest check switches it on.",
  live: "Subscribed and live.",
  paused: "Subscribed, but the promo lane is paused after a second strike.",
  forfeited: "Forfeited after three strikes — re-joining is an operator's call.",
};

export function PartnerCard({ place }: { place: AdminPlace }) {
  const plan = typeof place.plan === "string" ? place.plan : "free";
  const partner = isMemberPlan(plan);
  const state = membershipPillState(place);
  const strikes = effectiveStrikeCount(place);

  return (
    <SectionCard
      icon={<Handshake className="h-4 w-4" />}
      tint="sky"
      title="Partner"
      subtitle="The place pays Mesita. A deal, not an offer — and never shown to a guest."
      action={<Pill on={partner} tint="sky">
        {partner ? "Partner" : "Not a partner"}
      </Pill>}
    >
      <p className="text-muted-foreground mt-5 text-xs leading-relaxed">
        {PARTNER_STATE_COPY[state] ?? PARTNER_STATE_COPY.not_member} Paying buys
        the right to run a discount strategy — never placement, because rank is
        not for sale. Whether a discount is actually live is the Rewards box:
        a partner that picks Zero pays and offers nothing, and that has to stay
        answerable.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <ReadField label="Plan" boxed>
          {PLAN_LABEL[plan] ?? plan}
        </ReadField>
        <ReadField label="Strikes" boxed>
          {strikes > 0 ? `${strikes} of 3` : "None"}
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

// ── 3 · Rewards — does a guest get a discount here right now? ──────────────
export function RewardsCard({ place }: { place: AdminPlace }) {
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
      icon={<Gift className="h-4 w-4" />}
      tint="pink"
      title="Rewards"
      subtitle="A guest gets a discount here right now — the only one of the three a guest is ever shown."
      action={<Pill on={offering} tint="pink">
        {offering ? "Rewarding" : "No reward"}
      </Pill>}
    >
      <p className="text-muted-foreground mt-5 text-xs leading-relaxed">
        Computed live from what the place actually offers: a paid partnership, a
        strategy above Zero, and a promo lane that isn&apos;t paused. It is the
        promise a guest reads on the card, so it has to be true at the moment
        they read it — which is why it is never stored.
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
              Guest surfaces disagree with this box.
            </span>{" "}
            {badged
              ? "projects.listing_type still says 'partner' while nothing is on offer, so the consumer app is showing a reward badge over a closed promo lane."
              : "This place offers a live discount but is not stored as 'partner', so the consumer app gates the reward off and no guest can claim it."}{" "}
            That column fuses paying and offering into one flag and is
            re-derived only when something writes the place — a pause never
            rewrites it (MESITA-1150).
          </p>
        </div>
      ) : null}
    </SectionCard>
  );
}

/** The three boxes wear the same status pill; only the hue changes. */
function Pill({
  on,
  tint,
  loading,
  children,
}: {
  on: boolean;
  tint: "emerald" | "sky" | "pink";
  loading?: boolean;
  children: React.ReactNode;
}) {
  const onClass = {
    emerald: "bg-emerald-500/10 text-emerald-700",
    sky: "bg-sky-500/10 text-sky-700",
    pink: "bg-pink-500/10 text-pink-600",
  }[tint];
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold " +
        (on ? onClass : "bg-muted text-muted-foreground")
      }
    >
      {loading ? "Checking…" : children}
    </span>
  );
}
