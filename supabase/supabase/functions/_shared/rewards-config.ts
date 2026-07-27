// Promos v5 — the grid-authoritative bill engine (MESITA-723).
//
// The reward grid is operator config on app_settings.rewards_config (#474):
//   { cap, grid: { <segment>: { zero, conservative, aggressive } } }
// A place's STRATEGY (zero/conservative/aggressive) is derived from its v4 rate
// columns via strategyForRates — exactly as #474 left it — so no per-place v5
// columns exist. This module resolves a ticket's discount by looking up each
// qualifying segment in the grid at the place's strategy and paying BEST-OF
// (the single highest rung, never a sum). The grid is the single source of
// truth, which keeps the admin Rewards-Config page authoritative.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { strategyForRates, ratesFromPlace } from "./lineup-strategy.ts";

export const REWARD_SEGMENTS = [
  "standard",
  "magnetic",
  "premium",
  "story",
  "welcome",
  "review",
] as const;
export type RewardSegment = (typeof REWARD_SEGMENTS)[number];

// The three surviving strategies (Dominant retired in v5). Legacy places whose
// v4 rates still match the retired Dominant preset coerce to aggressive (its
// nearest surviving neighbour); anything unrecognised coerces to zero.
export type GridStrategy = "zero" | "conservative" | "aggressive";
export type SegmentRates = Record<GridStrategy, number>;
export type RewardsGrid = {
  grid: Record<RewardSegment, SegmentRates>;
  cap: number;
};

// The locked v5 defaults — used when app_settings can't be read (never in
// prod; the column is NOT NULL with a default), so the bill degrades to the
// canonical table rather than to zero.
export const DEFAULT_REWARDS_GRID: RewardsGrid = {
  cap: 500,
  grid: {
    standard: { zero: 0, conservative: 10, aggressive: 10 },
    magnetic: { zero: 0, conservative: 15, aggressive: 20 },
    premium: { zero: 0, conservative: 15, aggressive: 20 },
    story: { zero: 0, conservative: 20, aggressive: 30 },
    welcome: { zero: 0, conservative: 20, aggressive: 30 },
    review: { zero: 0, conservative: 30, aggressive: 50 },
  },
};

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

// Coerce a raw config blob to a complete grid, snapping missing cells to the
// locked defaults so a partial row can't produce NaN discounts.
export function coerceRewardsGrid(raw: unknown): RewardsGrid {
  const c = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rawGrid = (c.grid && typeof c.grid === "object" ? c.grid : {}) as Record<
    string,
    unknown
  >;
  const grid = {} as Record<RewardSegment, SegmentRates>;
  for (const seg of REWARD_SEGMENTS) {
    const row = (rawGrid[seg] && typeof rawGrid[seg] === "object"
      ? rawGrid[seg]
      : {}) as Record<string, unknown>;
    const d = DEFAULT_REWARDS_GRID.grid[seg];
    grid[seg] = {
      zero: 0, // off by definition
      conservative: num(row.conservative, d.conservative),
      aggressive: num(row.aggressive, d.aggressive),
    };
  }
  return { grid, cap: num(c.cap, DEFAULT_REWARDS_GRID.cap) };
}

// Loads the reward grid from the app_settings singleton. Falls back to the
// locked defaults on any read miss so a ticket never fails to price.
export async function loadRewardsGrid(
  admin: SupabaseClient,
): Promise<RewardsGrid> {
  const { data } = await admin
    .from("app_settings")
    .select("rewards_config")
    .eq("id", 1)
    .maybeSingle();
  return data?.rewards_config
    ? coerceRewardsGrid(data.rewards_config)
    : DEFAULT_REWARDS_GRID;
}

// A place's strategy from its v4 rate columns → the three surviving grid keys.
export function placeStrategy(place: Record<string, unknown>): GridStrategy {
  const p = strategyForRates(ratesFromPlace(place));
  if (p === "conservative") return "conservative";
  if (p === "aggressive") return "aggressive";
  if (p === "dominant") return "aggressive"; // retired → nearest surviving
  return "zero"; // zero, null (custom/legacy)
}

// Story/review lifecycle states that count as a verified action.
const VERIFIED_ACTION_STATUSES = new Set([
  "ai_verified",
  "staff_verified",
  "waiter_verified", // legacy value kept through the r1 enum rename
]);

export function isActionVerified(status: string | null | undefined): boolean {
  return status != null && VERIFIED_ACTION_STATUSES.has(status);
}

export type RateContext = {
  classKey: string | null | undefined;
  isFirstVisit: boolean;
  storyVerified?: boolean;
  reviewVerified?: boolean;
};

// Best-of resolution over the six-segment grid at the place's strategy.
// Everyone inherits the Standard floor; class/action/visit segments join the
// qualifying set from context. Returns a clamped integer percent — and ONLY
// that, never the class (the blended-rate privacy invariant).
export function resolveTicketRate(
  strategy: GridStrategy,
  grid: RewardsGrid,
  ctx: RateContext,
): number {
  const g = grid.grid;
  const qualifying: number[] = [g.standard[strategy]];
  if (ctx.classKey === "premium") qualifying.push(g.premium[strategy]);
  if (ctx.classKey === "magnetic") qualifying.push(g.magnetic[strategy]);
  if (ctx.isFirstVisit) qualifying.push(g.welcome[strategy]);
  if (ctx.storyVerified) qualifying.push(g.story[strategy]);
  if (ctx.reviewVerified) qualifying.push(g.review[strategy]);
  const best = qualifying.reduce((m, r) => (r > m ? r : m), 0);
  return Math.max(0, Math.min(100, best));
}

// Whether the place's program offers a given action rung at its strategy —
// the gate the consumer opt-in EFs check before accepting a submission.
export function offersSegment(
  strategy: GridStrategy,
  grid: RewardsGrid,
  segment: RewardSegment,
): boolean {
  return grid.grid[segment][strategy] > 0;
}
