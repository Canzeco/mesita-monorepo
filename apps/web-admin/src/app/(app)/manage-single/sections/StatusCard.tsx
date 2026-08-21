"use client";

import { AlertTriangle, CircleCheck } from "lucide-react";
import { type AdminPlace } from "../actions";
import { SectionCard } from "../ui";
import {
  effectiveStrikeCount,
  isMemberPlan,
  membershipPillState,
} from "./promo-state";
import { strategyForPlace } from "@/lib/business/strategies";

// Status — the three booleans a place carries, in ONE box (MESITA-1161).
//
// Pato: "i don't want lots of fucking boxes. just create a box called Status.
// it mention verified, partner, promoting." They were three cards; they are
// three rows, because they are three answers to one question — where does this
// place stand.
//
//   Verified   somebody proved they own it. One-time, never lapses.
//   Partner    the place pays Mesita. A deal: stable, internal.
//   Promoting  a guest gets a discount here RIGHT NOW. Volatile, and the only
//              one of the three a guest is ever shown.
//
// `listing_type` backs NONE of them, deliberately: it stores
// (pays ∧ strategy ≠ zero) collapsed into one enum and is re-derived only when
// something writes the place, so it can answer neither question separately and
// goes stale over a paused lane. Each row reads its own source instead, and the
// box says so out loud when the stored enum disagrees.

type Verification = {
  verifiedByEmail: string | null;
  decidedAt: string | null;
  method: string | null;
} | null;


/** Does a guest get a discount here RIGHT NOW? The live read, not the badge. */
export function isPromotingNow(place: AdminPlace): boolean {
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
  // `pending` still promotes — the place has promised a discount, it just
  // hasn't honored its first check yet.
  return state !== "paused" && state !== "forfeited";
}

const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  ultra: "Ultra",
};

export function StatusCard({
  place,
  verification,
  verificationError,
}: {
  place: AdminPlace;
  /** undefined while the read is in flight. */
  verification: Verification | undefined;
  verificationError: string | null;
}) {
  const plan = typeof place.plan === "string" ? place.plan : "free";
  const partner = isMemberPlan(plan);
  const promoting = isPromotingNow(place);
  const state = membershipPillState(place);
  const strikes = effectiveStrikeCount(place);
  const strategy = strategyForPlace({
    welcome_free_rate: place.welcome_free_rate,
    welcome_premium_rate: place.welcome_premium_rate,
    free_rate: place.free_rate,
    premium_rate: place.premium_rate,
  });
  const badged = place.listing_type === "partner";

  // An unknown must never render as a false negative: misreporting a real
  // place's standing is worse than admitting the lookup failed.
  const verified: boolean | "unknown" | "loading" = verificationError
    ? "unknown"
    : verification === undefined
      ? "loading"
      : Boolean(verification?.verifiedByEmail);

  const verifiedDetail = verificationError
    ? "Couldn't read the verification record."
    : verification === undefined
      ? "Checking…"
      : verification?.verifiedByEmail
        ? [
            verification.method ? methodLabel(verification.method) : null,
            verification.decidedAt ? verification.decidedAt.slice(0, 10) : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Ownership proven."
        : "Nobody has proven ownership yet.";

  const partnerDetail =
    (PLAN_LABEL[plan] ?? plan) +
    (state === "pending"
      ? " · not live until the first honored check"
      : state === "paused"
        ? " · promo lane paused (strike 2)"
        : state === "forfeited"
          ? " · forfeited after 3 strikes"
          : strikes > 0
            ? ` · ${strikes} active strike${strikes === 1 ? "" : "s"}`
            : partner
              ? " · live"
              : " · costs them nothing");

  const promotingDetail =
    strategy === null
      ? "Custom rates — no preset strategy."
      : strategy === "zero"
        ? "Zero strategy — no discount offered."
        : state === "paused"
          ? "Lane paused — the strategy is set but nothing is claimable."
          : state === "forfeited"
            ? "Lane closed after three strikes."
            : !partner
              ? "No paid plan, so no discount resolves."
              : `${strategy.charAt(0).toUpperCase() + strategy.slice(1)} strategy, lane open.`;

  return (
    <SectionCard
      icon={<CircleCheck className="h-4 w-4" />}
      tint="emerald"
      title="Status"
      subtitle="Where this place stands. Three separate facts — a place can be any combination of them."
    >
      <div className="mt-5 flex flex-col">
        <StatusRow
          name="Verified"
          value={verified}
          tint="emerald"
          meaning="Somebody proved they own this place. Ownership only — it grants no discount and buys nothing."
          detail={verifiedDetail}
        />
        <StatusRow
          name="Partner"
          value={partner}
          tint="sky"
          meaning="The place pays Mesita. A deal, not an offer — and never shown to a guest."
          detail={partnerDetail}
        />
        <StatusRow
          name="Promoting"
          value={promoting}
          tint="pink"
          meaning="A guest gets a discount here right now — the only one of the three a guest is ever shown."
          detail={promotingDetail}
        />
      </div>

      {badged !== promoting ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200/70 bg-amber-50/60 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <p className="text-[11px] leading-relaxed text-amber-900">
            <span className="font-semibold">
              Guest surfaces disagree with Promoting.
            </span>{" "}
            {badged
              ? "projects.listing_type still says 'partner' while nothing is on offer, so the consumer app shows a reward badge over a closed promo lane."
              : "This place promotes a live discount but isn't stored as 'partner', so the consumer app gates the reward off and no guest can claim it."}{" "}
            That column collapses paying and promoting into one flag and is
            re-derived only when something writes the place (MESITA-1150).
          </p>
        </div>
      ) : null}
    </SectionCard>
  );
}

function methodLabel(method: string): string {
  const clean = method.replace(/_/g, " ").trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function StatusRow({
  name,
  value,
  tint,
  meaning,
  detail,
}: {
  name: string;
  value: boolean | "unknown" | "loading";
  tint: "emerald" | "sky" | "pink";
  meaning: string;
  detail: string;
}) {
  const on = value === true;
  const chipClass = {
    emerald: "bg-emerald-500/10 text-emerald-700",
    sky: "bg-sky-500/10 text-sky-700",
    pink: "bg-pink-500/10 text-pink-600",
  }[tint];

  return (
    <div className="border-border/60 flex items-start justify-between gap-4 border-b py-3.5 first:pt-0 last:border-b-0 last:pb-0">
      <div className="min-w-0">
        <span className="text-foreground/90 text-[13px] font-medium">{name}</span>
        <p className="text-muted-foreground mt-0.5 text-[11px] leading-relaxed">
          {meaning}
        </p>
        <p className="text-foreground/70 mt-1 text-[11px] font-medium">{detail}</p>
      </div>
      <span
        className={
          "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums " +
          (on ? chipClass : "bg-muted text-muted-foreground")
        }
        aria-label={`${name}: ${
          value === "loading"
            ? "checking"
            : value === "unknown"
              ? "unknown"
              : on
                ? "yes"
                : "no"
        }`}
      >
        {value === "loading" ? "…" : value === "unknown" ? "?" : on ? name : "—"}
      </span>
    </div>
  );
}
