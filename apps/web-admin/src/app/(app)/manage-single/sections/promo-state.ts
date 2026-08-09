// Pure membership/strategy presentation state for the admin Promos tab.
//
// ZERO React/Next imports on purpose: PromosSection.tsx chains to
// next/headers through its server-action imports, so anything unit-tested
// must live here instead — vitest imports this file under plain node
// (see promo-state.test.ts).

import type { StrategyId } from "@/lib/business/strategies";

// Structural snapshot of the AdminPlace fields this module reads. Fields stay
// `unknown` because place rows arrive loosely typed from the EF; every reader
// coerces exactly like the component used to.
type MembershipSnapshot = {
  plan?: unknown;
  membership_forfeited_at?: unknown;
  promo_paused_until?: unknown;
  membership_live_at?: unknown;
  strike_count?: unknown;
  last_strike_at?: unknown;
};

export type MembershipPillState =
  "not_member" | "pending" | "live" | "paused" | "forfeited";

// A place on any paid plan carries a membership (plan != free).
export function isMemberPlan(plan: unknown): boolean {
  return !!plan && plan !== "free";
}

// Mirrors `effectiveStrikeCount` in supabase _shared/membership-enforcement.ts:
// decay is ALL-OR-NOTHING — once the last strike is ≥ STRIKE_DECAY_DAYS old
// the whole count reads 0. The EF only rewrites the raw column lazily, so a
// UI that renders raw `strike_count` shows phantom strikes. Keep this
// constant in lockstep with the EF twin.
export const STRIKE_DECAY_DAYS = 183;

const DAY_MS = 86_400_000;

export function effectiveStrikeCount(
  snap: MembershipSnapshot,
  now: number = Date.now(),
): number {
  const count = typeof snap.strike_count === "number" ? snap.strike_count : 0;
  if (count <= 0) return 0;
  const last = snap.last_strike_at
    ? new Date(String(snap.last_strike_at)).getTime()
    : NaN;
  // No usable timestamp → trust the raw count (the EF twin does the same).
  if (!Number.isFinite(last)) return count;
  return now - last >= STRIKE_DECAY_DAYS * DAY_MS ? 0 : count;
}

export function membershipPillState(
  snap: MembershipSnapshot,
  now: number = Date.now(),
): MembershipPillState {
  if (snap.membership_forfeited_at) return "forfeited";
  if (!isMemberPlan(snap.plan)) return "not_member";
  if (
    snap.promo_paused_until &&
    new Date(String(snap.promo_paused_until)).getTime() > now
  ) {
    return "paused";
  }
  if (snap.membership_live_at) return "live";
  return "pending";
}

type MembershipStatusNote = {
  label: string;
  tone: "live" | "warn" | "blocked";
};

// Paused is a recoverable 30-day state → warn (amber), matching its pill.
// Destructive red is reserved for forfeited only.
export function describeMembershipStatus(
  snap: MembershipSnapshot,
  pillState: MembershipPillState,
  now: number = Date.now(),
): MembershipStatusNote | null {
  if (pillState === "forfeited") {
    return {
      label:
        "Membership forfeited after 3 strikes — re-join is an admin decision.",
      tone: "blocked",
    };
  }
  if (pillState === "not_member") return null;
  if (pillState === "paused") {
    return {
      label: `Promo lane paused until ${String(snap.promo_paused_until).slice(0, 10)} (strike 2 of 3).`,
      tone: "warn",
    };
  }
  if (pillState === "live") {
    const strikes = effectiveStrikeCount(snap, now);
    return {
      label:
        strikes > 0
          ? `Membership live · ${strikes} active strike${strikes === 1 ? "" : "s"} (of 3).`
          : "Membership live — promo lane open.",
      tone: strikes > 0 ? "warn" : "live",
    };
  }
  return {
    label:
      "Member — pending activation. Honor the first guest check to go live.",
    tone: "warn",
  };
}

// ── Lifecycle stepper (top-of-page banner) ─────────────────────────────────
//
// The canonical three steps: join → pick a strategy → honor guest checks.
// Pure derivation from the same snapshot the pill reads, plus storedStrategy.
// storedStrategy is member-gated HERE (the strategyForPlace all-null-rates→Zero
// trap): a non-member's "zero" match must not render step 2 as done.

export type LifecycleStepState = "done" | "current" | "upcoming" | "blocked";

type LifecycleView =
  // Live on a paid strategy: the teaching job is over — collapse to one line.
  | { kind: "strip"; tone: "live" | "warn"; strikes: number }
  | {
      kind: "rail";
      join: LifecycleStepState;
      strategy: LifecycleStepState;
      honor: LifecycleStepState;
    };

export function lifecycleView(
  snap: MembershipSnapshot,
  storedStrategy: StrategyId | null,
  now: number = Date.now(),
): LifecycleView {
  const pill = membershipPillState(snap, now);
  const member = isMemberPlan(snap.plan);
  const onPaid = member && storedStrategy !== null && storedStrategy !== "zero";

  if (pill === "forfeited") {
    // Strike 3 broke step 3; strategy resets because re-join re-picks one.
    return {
      kind: "rail",
      join: "done",
      strategy: "upcoming",
      honor: "blocked",
    };
  }
  if (pill === "not_member") {
    return {
      kind: "rail",
      join: "current",
      strategy: "upcoming",
      honor: "upcoming",
    };
  }
  if (pill === "paused") {
    return { kind: "rail", join: "done", strategy: "done", honor: "blocked" };
  }
  if (pill === "live") {
    if (!onPaid) {
      // Activated but sitting on Zero (or custom rates): the promo lane is
      // closed, so step 2 regresses to current while step 3 stays done.
      return { kind: "rail", join: "done", strategy: "current", honor: "done" };
    }
    const strikes = effectiveStrikeCount(snap, now);
    return { kind: "strip", tone: strikes > 0 ? "warn" : "live", strikes };
  }
  // pending
  if (!onPaid) {
    return {
      kind: "rail",
      join: "done",
      strategy: "current",
      honor: "upcoming",
    };
  }
  return { kind: "rail", join: "done", strategy: "done", honor: "current" };
}

type CardCta =
  "current" | "join" | "reinstate" | "switch" | "switch_zero";

export type CardState = { selected: boolean; cta: CardCta };

// The card/modal state machine — the F1 regression class lives here.
// `selected` MUST be member-gated: strategyForPlace maps all-null rates to
// Zero, so without the gate a non-member (or forfeited, or freshly dropped)
// place renders the Zero card as ringed "Current" — which also makes
// join-onto-Zero impossible (its modal primary is the disabled "Current
// strategy"). Forfeited wins over member defensively: strike-3 sets
// plan→free, so the combination should not exist in stored data.
export function promoCardState(input: {
  member: boolean;
  forfeited: boolean;
  storedStrategy: StrategyId | null;
  cardId: StrategyId;
  paid: boolean;
}): CardState {
  if (input.forfeited) return { selected: false, cta: "reinstate" };
  if (!input.member) return { selected: false, cta: "join" };
  if (input.cardId === input.storedStrategy) {
    return { selected: true, cta: "current" };
  }
  return { selected: false, cta: input.paid ? "switch" : "switch_zero" };
}
