// Promos v6 — the grid-authoritative bill engine (MESITA-723, segments v6).
//
// The reward grid is operator config on app_settings.rewards_config (#474):
//   { cap, grid: { <segment>: { zero, conservative, aggressive, dominant } } }
// A place's STRATEGY (zero/conservative/aggressive/dominant) is derived from its
// v4 rate columns via strategyForRates — exactly as #474 left it — so no
// per-place v5 columns exist. This module resolves a ticket's discount by looking up each
// qualifying segment in the grid at the place's strategy and paying BEST-OF
// (the single highest rung, never a sum). The grid is the single source of
// truth, which keeps the admin Rewards-Config page authoritative.
//
// Segments v6 (2026-08-01): four classes — standard, premium, influencer
// (Instagram ≥ 1,000 followers, automatic), aura (invite-only presence class) —
// plus three actions. The Story rung is the Influencer class's EXCLUSIVE action;
// Review and Welcome stay universal. Class segments resolve generically (any
// known class key qualifies for its own grid row), so a future class/tier is a
// classes-table INSERT + one entry here — never per-class branches.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { strategyForRates, ratesFromPlace } from "./lineup-strategy.ts";

// Class segments in rank order (mirrors public.classes: rank 0..3).
export const CLASS_SEGMENTS = [
  "standard",
  "premium",
  "influencer",
  "aura",
] as const;
export type ClassSegment = (typeof CLASS_SEGMENTS)[number];

const REWARD_SEGMENTS = [
  ...CLASS_SEGMENTS,
  "story",
  "welcome",
  "review",
] as const;
export type RewardSegment = (typeof REWARD_SEGMENTS)[number];

export function isClassSegment(
  key: string | null | undefined,
): key is ClassSegment {
  return key != null && (CLASS_SEGMENTS as readonly string[]).includes(key);
}

// The four strategies. Dominant was retired in v5 and RESTORED in v6.1
// (2026-08-02): its v4 rate tuple never left lineup-strategy.ts, so places
// carrying it stopped coercing to aggressive and resolve to their own column
// again. Anything unrecognised (custom/legacy) still coerces to zero.
export type GridStrategy = "zero" | "conservative" | "aggressive" | "dominant";
export type SegmentRates = Record<GridStrategy, number>;
export type RewardsGrid = {
  grid: Record<RewardSegment, SegmentRates>;
  cap: number;
};

// The locked v6 defaults — used when app_settings can't be read (never in
// prod; the column is NOT NULL with a default), so the bill degrades to the
// canonical table rather than to zero.
// Dominant follows the v4 invariant it always had — it raises the FLOOR, not
// the ceiling: every rung climbs a step over aggressive except Review, which
// is already at the 50% ceiling and stays there.
export const DEFAULT_REWARDS_GRID: RewardsGrid = {
  cap: 500,
  grid: {
    standard: { zero: 0, conservative: 10, aggressive: 10, dominant: 20 },
    premium: { zero: 0, conservative: 15, aggressive: 20, dominant: 25 },
    influencer: { zero: 0, conservative: 15, aggressive: 20, dominant: 25 },
    aura: { zero: 0, conservative: 20, aggressive: 25, dominant: 30 },
    story: { zero: 0, conservative: 20, aggressive: 30, dominant: 40 },
    welcome: { zero: 0, conservative: 20, aggressive: 30, dominant: 40 },
    review: { zero: 0, conservative: 30, aggressive: 50, dominant: 50 },
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
      dominant: num(row.dominant, d.dominant),
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

// A place's strategy from its v4 rate columns → the four grid keys.
export function placeStrategy(place: Record<string, unknown>): GridStrategy {
  const p = strategyForRates(ratesFromPlace(place));
  if (p === "conservative") return "conservative";
  if (p === "aggressive") return "aggressive";
  if (p === "dominant") return "dominant";
  return "zero"; // zero, null (custom/legacy)
}

// Story/review lifecycle states that count as a verified action.
//
// `self_verified` is the v3 state (MESITA-849): the guest completes the task
// before the business is ever involved, so their own declaration IS the
// verification. The three legacy states below are read-only history — no code
// path writes them any more, but tickets predating v3 still carry them.
const VERIFIED_ACTION_STATUSES = new Set([
  "self_verified",
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

// Best-of resolution over the seven-segment grid at the place's strategy.
// Everyone inherits the Standard floor; the guest's class segment resolves
// GENERICALLY (its own grid row — no per-class branches); Welcome/Review join
// from context for anyone. Returns a clamped integer percent — and ONLY that,
// never the class (the blended-rate privacy invariant).
//
// Story eligibility is settled UPSTREAM, not here: the Influencer-only rule is
// enforced where a story can start — consumer-web-create-ticket (never seeds a
// story step for a non-Influencer) and consumer-web-submit-story (403s a
// non-Influencer opt-in). By the time a story is VERIFIED the guest has done
// the work, so it always pays — re-checking the live class at bill time would
// strip an already-earned reward from someone whose reach lapsed between the
// post and the check.
export function resolveTicketRate(
  strategy: GridStrategy,
  grid: RewardsGrid,
  ctx: RateContext,
): number {
  const g = grid.grid;
  const qualifying: number[] = [g.standard[strategy]];
  if (isClassSegment(ctx.classKey)) qualifying.push(g[ctx.classKey][strategy]);
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
