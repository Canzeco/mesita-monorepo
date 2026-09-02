// Pure membership/strategy presentation state for the admin Promos tab.
//
// ZERO React/Next imports on purpose: PromosSection.tsx chains to
// next/headers through its server-action imports, so anything place-tested
// must live here instead — vitest imports this file under plain node
// (see promo-state.test.ts).

import {
  STRATEGY_VISIBILITY_LADDER,
  type StrategyId,
  type StrategyVisibility,
} from "@/lib/business/strategies";
import {
  STRATEGY_KEYS,
  type PromosConfig,
  type StrategyKey,
} from "@/app/(app)/rewards-config/promos";
import {
  DEFAULT_ASSUMPTIONS,
  distributionFor,
} from "@/app/(app)/rewards-config/distribution-model";

// Structural snapshot of the AdminPlace fields this module reads. Fields stay
// `unknown` because place rows arrive loosely typed from the EF; every reader
// coerces exactly like the component used to.
type MembershipSnapshot = {
  plan?: unknown;
  plan_forfeited_at?: unknown;
  promo_paused_until?: unknown;
  plan_live_at?: unknown;
  strike_count?: unknown;
  last_strike_at?: unknown;
  /** Ghost-partner hold (MESITA-1311) — a confirmed guest report. */
  reward_lane_pending_review_at?: unknown;
};

export type MembershipPillState =
  "not_member" | "pending" | "live" | "paused" | "forfeited" | "review";

// A place on any paid plan holds the Partnership subscription (plan != free).
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
  // The hold outranks everything — same order as assessPromoLane in the EF
  // twin: an open review is the freshest fact about the place.
  if (snap.reward_lane_pending_review_at) return "review";
  if (snap.plan_forfeited_at) return "forfeited";
  if (!isMemberPlan(snap.plan)) return "not_member";
  if (
    snap.promo_paused_until &&
    new Date(String(snap.promo_paused_until)).getTime() > now
  ) {
    return "paused";
  }
  if (snap.plan_live_at) return "live";
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
  if (pillState === "review") {
    return {
      label:
        "Visit Rewards on hold — a guest report was confirmed and Mesita is " +
        "reviewing this place. Restore ends the review and reopens the lane.",
      tone: "warn",
    };
  }
  if (pillState === "forfeited") {
    return {
      label:
        "Partnership forfeited after 3 strikes — re-join is an admin decision.",
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
          ? `Partnership live · ${strikes} active strike${strikes === 1 ? "" : "s"} (of 3).`
          : "Partnership live — promo lane open.",
      tone: strikes > 0 ? "warn" : "live",
    };
  }
  return {
    label:
      "Partner — pending activation. Honor the first guest check to go live.",
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

  if (pill === "review") {
    // Under review after a confirmed guest report: honoring is blocked
    // whatever the earlier steps say; join/strategy render their own truth.
    return {
      kind: "rail",
      join: member ? "done" : "upcoming",
      strategy: onPaid ? "done" : "upcoming",
      honor: "blocked",
    };
  }
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

// ── Card-face meters: give / get (MESITA-1001) ─────────────────────────────
//
// The strategy card stopped printing the 4×5 rate matrix — that moved into the
// detail modal. The face carries two meters — how much you GIVE, how much
// placement you GET — plus ONE number.
//
// FOUR segments, not five. The visibility ladder has exactly four rungs
// (Low/Mid/High/Max) and there are exactly four postures; a five-segment rail
// rendered four-of-five, which reads as "one more rung exists that I could
// buy". A meter gets as many segments as its ladder has rungs.
//
// The number is the EXPECTED discount per bill — the figure an owner budgets
// against — read from the same enumerated model the Promos Playground charts.
// The face used to print min–max of the matrix cells, which was the wrong
// statistic twice over: the top cell lands on ~1.5% of visits, and it also
// UNDERSTATES the true ceiling, because the engine stacks bonuses while the
// table only ever shows one action at a time.
//
// Everything here is a PROJECTION from DEFAULT_ASSUMPTIONS, not a measurement.
// The copy beside it says so, and must keep saying so until real tickets back
// it (there were zero in production when this shipped).

export const METER_SEGMENTS = 4;

export type GiveLevel = {
  dots: number;
  /** Expected discount per bill, whole percent. */
  mean: number;
  /** The typical band — p10..p90, about nine visits in ten. */
  p10: number;
  p90: number;
};

export function giveLevel(cfg: PromosConfig, id: StrategyId): GiveLevel {
  // Zero is the absence of the product, not the bottom of the ladder.
  if (id === "zero") return { dots: 0, mean: 0, p10: 0, p90: 0 };

  const key = id as StrategyKey;
  const mine = distributionFor(cfg, DEFAULT_ASSUMPTIONS, key);
  const top = Math.max(
    ...STRATEGY_KEYS.map(
      (s) => distributionFor(cfg, DEFAULT_ASSUMPTIONS, s).mean,
    ),
  );

  // Dots are RELATIVE to the most generous posture, so the top strategy always
  // fills the rail and an edit in Promos Config moves the others. A posture
  // that pays anything keeps at least one lit segment.
  const dots =
    mine.mean <= 0 || top <= 0
      ? 0
      : Math.max(
          1,
          Math.min(
            METER_SEGMENTS,
            Math.round((mine.mean / top) * METER_SEGMENTS),
          ),
        );

  return { dots, mean: Math.round(mine.mean), p10: mine.p10, p90: mine.p90 };
}

/** Visibility on the same four-segment rail: Low 1 · Mid 2 · High 3 · Max 4. */
export function visibilityDots(v: StrategyVisibility): number {
  const idx = STRATEGY_VISIBILITY_LADDER.indexOf(v);
  return idx < 0 ? 1 : idx + 1;
}

/** Card-face words — Single Place Promos never prints a give/placement number. */
export type RungWord = "Low" | "Mid" | "High";
export const RUNG_WORDS = ["Low", "Mid", "High"] as const;

export function giveWord(id: StrategyId): RungWord {
  if (id === "zero") return "Low";
  if (id === "conservative") return "Mid";
  return "High";
}

/** Max collapses to High — this surface has no Dominant picker. */
export function placementWord(v: StrategyVisibility): RungWord {
  if (v === "Low" || v === "Mid") return v;
  return "High";
}

type CardCta =
  | "current"
  | "locked"
  | "switch"
  | "switch_zero";

export type CardState = { selected: boolean; cta: CardCta };

// The card/modal state machine — the F1 regression class lives here.
// `selected` MUST be member-gated: strategyForPlace maps all-null rates to
// Zero, so without the gate a non-member (or forfeited, or freshly dropped)
// place renders the Zero card as ringed "Current". Join lives on the
// Partnership Stripe mock, not on strategy cards — non-members and
// forfeited places lock the picker until plan=pro is written.
export function promoCardState(input: {
  member: boolean;
  forfeited: boolean;
  storedStrategy: StrategyId | null;
  cardId: StrategyId;
  paid: boolean;
}): CardState {
  if (input.forfeited || !input.member) {
    return { selected: false, cta: "locked" };
  }
  if (input.cardId === input.storedStrategy) {
    return { selected: true, cta: "current" };
  }
  return { selected: false, cta: input.paid ? "switch" : "switch_zero" };
}
