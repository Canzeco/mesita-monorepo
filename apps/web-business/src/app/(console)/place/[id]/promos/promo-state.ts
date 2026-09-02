// Pure membership presentation state for the business Promos page.
//
// ZERO React/Next imports on purpose — vitest imports this file under plain
// node (see promo-state.test.ts). Admin twin:
// apps/web-admin/src/app/(app)/manage-single/sections/promo-state.ts —
// keep the decay constant + lifecycleView in lockstep with both it and the EF.

import type { StrategyId } from "@/lib/business/strategies";

// Mirrors `effectiveStrikeCount` in supabase _shared/membership-enforcement.ts:
// decay is ALL-OR-NOTHING — once the last strike is ≥ STRIKE_DECAY_DAYS old
// the whole count reads 0. The EF only rewrites the raw column lazily, so a
// UI that renders raw `strike_count` shows phantom strikes.
export const STRIKE_DECAY_DAYS = 183;

const DAY_MS = 86_400_000;

type StrikeSnapshot = {
  strike_count?: number | null;
  last_strike_at?: string | null;
};

export function effectiveStrikeCount(
  snap: StrikeSnapshot,
  now: number = Date.now(),
): number {
  const count = snap.strike_count ?? 0;
  if (count <= 0) return 0;
  const last = snap.last_strike_at
    ? new Date(snap.last_strike_at).getTime()
    : NaN;
  // No usable timestamp → trust the raw count (the EF twin does the same).
  if (!Number.isFinite(last)) return count;
  return now - last >= STRIKE_DECAY_DAYS * DAY_MS ? 0 : count;
}

// The F1 gate: strategyForPlace maps all-null rates to "zero", so an
// UNSUBSCRIBED place would render the Zero card as ringed "Current" — and
// its modal primary would be the disabled "Current Strategy", silently
// blocking join-onto-Zero (allowed by the membership model, MESITA-912).
// `selected`/`isCurrent` must always pass through this gate.
export function isCardCurrent(
  subscribed: boolean,
  selectedId: StrategyId | null,
  cardId: StrategyId,
): boolean {
  return subscribed && selectedId === cardId;
}

// ── Lifecycle stepper (MESITA-959 — port of admin MESITA-958) ─────────────
//
// Canonical three steps: join → pick a strategy → honor guest checks.
// storedStrategy is member-gated HERE (the strategyForPlace all-null→Zero
// trap): a non-member's "zero" match must not render step 2 as done.

type MembershipSnapshot = {
  plan?: unknown;
  plan_forfeited_at?: unknown;
  promo_paused_until?: unknown;
  plan_live_at?: unknown;
  strike_count?: number | null;
  last_strike_at?: string | null;
  /** Ghost-partner hold (MESITA-1311) — a confirmed guest report. */
  reward_lane_pending_review_at?: unknown;
};

export type LifecycleStepState = "done" | "current" | "upcoming" | "blocked";

export type LifecycleView =
  | { kind: "strip"; tone: "live" | "warn"; strikes: number }
  | {
      kind: "rail";
      join: LifecycleStepState;
      strategy: LifecycleStepState;
      honor: LifecycleStepState;
    };

function isMemberPlan(plan: unknown): boolean {
  return !!plan && plan !== "free";
}

type PillState =
  | "not_member"
  | "pending"
  | "live"
  | "paused"
  | "forfeited"
  | "review";

function pillFromSnap(snap: MembershipSnapshot, now: number): PillState {
  // The hold outranks everything — same order as assessPromoLane in the EF.
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

export function lifecycleView(
  snap: MembershipSnapshot,
  storedStrategy: StrategyId | null,
  now: number = Date.now(),
): LifecycleView {
  const pillState = pillFromSnap(snap, now);
  const member = isMemberPlan(snap.plan);
  const onPaid = member && storedStrategy !== null && storedStrategy !== "zero";

  if (pillState === "review") {
    // Ghost-partner hold (MESITA-1311): honoring is blocked while Mesita
    // reviews a confirmed guest report; earlier steps render their truth.
    return {
      kind: "rail",
      join: member ? "done" : "upcoming",
      strategy: onPaid ? "done" : "upcoming",
      honor: "blocked",
    };
  }
  if (pillState === "forfeited") {
    return {
      kind: "rail",
      join: "done",
      strategy: "upcoming",
      honor: "blocked",
    };
  }
  if (pillState === "not_member") {
    return {
      kind: "rail",
      join: "current",
      strategy: "upcoming",
      honor: "upcoming",
    };
  }
  if (pillState === "paused") {
    return { kind: "rail", join: "done", strategy: "done", honor: "blocked" };
  }
  if (pillState === "live") {
    if (!onPaid) {
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
