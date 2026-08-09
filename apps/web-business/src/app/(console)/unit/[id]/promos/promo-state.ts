// Pure membership presentation state for the business Promos page.
//
// ZERO React/Next imports on purpose — vitest imports this file under plain
// node (see promo-state.test.ts). Admin twin:
// apps/web-admin/src/app/(app)/manage-single/sections/promo-state.ts —
// keep the decay constant in lockstep with both it and the EF.

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
