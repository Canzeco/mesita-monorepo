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

// The rewarded actions (v7, MESITA-859): each is priced PER CLASS per
// strategy. mesita_review joined in v7 — previously the one action that
// deliberately paid nothing; it launches at 0 until the operator prices it.
export const ACTION_SEGMENTS = [
  "mesita_review",
  "story",
  "welcome",
  "review",
] as const;
export type ActionSegment = (typeof ACTION_SEGMENTS)[number];

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

// v13 (v7 matrix, MESITA-859): `grid` holds the four STANDING class rows (the
// "None" column of the table); `actions` prices every action per class per
// strategy — "different discount for each item, depending on the tier".
export type ActionMatrix = Record<
  ActionSegment,
  Record<ClassSegment, SegmentRates>
>;
export type RewardsGrid = {
  grid: Record<ClassSegment, SegmentRates>;
  actions: ActionMatrix;
  cap: number;
};

// The defaults (MESITA-876) — the LAST-RESORT fallback, used only when both
// reward_rules and app_settings come back empty, so a ticket degrades to the
// canonical table rather than to zero. Must stay byte-identical to the admin
// catalog's defaultRateFor and the update EF's defaultFor.
//
// Four properties hold across all 60 cells: Premium ≥ Standard everywhere
// (including on actions — a flat action column made the class ladder
// invisible to any guest who acted, since best-of pays exactly one cell);
// every action strictly beats its class's standing rate (a tie is a dead
// rung); each strategy beats the one below it; Story is the Influencer's
// best rung, being their exclusive and the only action that produces reach.
const FLAT = (
  conservative: number,
  aggressive: number,
  dominant: number,
): SegmentRates => ({ zero: 0, conservative, aggressive, dominant });

// An action's rate is a per-strategy base (the STANDARD cell) plus a flat
// class step: Standard +0, Premium +5, Influencer +5, Aura +10.
const STEPPED_ACTION = (
  conservative: number,
  aggressive: number,
  dominant: number,
): Record<ClassSegment, SegmentRates> => ({
  standard: FLAT(conservative, aggressive, dominant),
  premium: FLAT(conservative + 5, aggressive + 5, dominant + 5),
  influencer: FLAT(conservative + 5, aggressive + 5, dominant + 5),
  aura: FLAT(conservative + 10, aggressive + 10, dominant + 10),
});

export const DEFAULT_REWARDS_GRID: RewardsGrid = {
  cap: 500,
  grid: {
    standard: FLAT(10, 10, 20),
    premium: FLAT(15, 20, 25),
    influencer: FLAT(15, 20, 25),
    aura: FLAT(20, 25, 30),
  },
  actions: {
    mesita_review: STEPPED_ACTION(15, 20, 25),
    // Influencer-exclusive: the base is written for THEIR cell (base + 5).
    story: STEPPED_ACTION(25, 40, 55),
    welcome: STEPPED_ACTION(20, 30, 40),
    review: STEPPED_ACTION(25, 40, 50),
  },
};

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

// Coerce a raw config blob to a complete v13 grid, snapping missing cells to
// the locked defaults so a partial row can't produce NaN discounts.
//
// MIGRATION IS BUILT IN: a v12 blob has flat action rows inside `grid`
// (grid.story/welcome/review) and no `actions` block. Those flat values are
// copied to EVERY class of the action — the identity migration — so a stored
// v12 config keeps billing exactly as before. mesita_review, absent from v12,
// coerces to the default (0 everywhere).
export function coerceRewardsGrid(raw: unknown): RewardsGrid {
  const c = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rawGrid = (c.grid && typeof c.grid === "object" ? c.grid : {}) as Record<
    string,
    unknown
  >;
  const rawActions = (c.actions && typeof c.actions === "object"
    ? c.actions
    : {}) as Record<string, unknown>;

  const rates = (row: unknown, d: SegmentRates): SegmentRates => {
    const r = (row && typeof row === "object" ? row : {}) as Record<
      string,
      unknown
    >;
    return {
      zero: 0, // off by definition
      conservative: num(r.conservative, d.conservative),
      aggressive: num(r.aggressive, d.aggressive),
      dominant: num(r.dominant, d.dominant),
    };
  };

  const grid = {} as Record<ClassSegment, SegmentRates>;
  for (const cls of CLASS_SEGMENTS) {
    grid[cls] = rates(rawGrid[cls], DEFAULT_REWARDS_GRID.grid[cls]);
  }

  const actions = {} as ActionMatrix;
  for (const action of ACTION_SEGMENTS) {
    const rawAction = (rawActions[action] && typeof rawActions[action] === "object"
      ? rawActions[action]
      : null) as Record<string, unknown> | null;
    // v12 fallback: the action's flat row lived inside `grid` (never for
    // mesita_review, which v12 didn't price).
    const legacyFlat = action === "mesita_review" ? null : rawGrid[action];
    const perClass = {} as Record<ClassSegment, SegmentRates>;
    for (const cls of CLASS_SEGMENTS) {
      const d = DEFAULT_REWARDS_GRID.actions[action][cls];
      perClass[cls] = rates(rawAction?.[cls] ?? legacyFlat, d);
    }
    actions[action] = perClass;
  }

  return { grid, actions, cap: num(c.cap, DEFAULT_REWARDS_GRID.cap) };
}

// One (strategy, class, action) rule row — the v8 normalized shape
// (MESITA-873). "standing" is the None column: v13's `grid` and `actions`
// were two shapes for the same thing, and collapsing them means a future
// action is rows, not a schema change.
export type RewardRuleRow = {
  strategy: string;
  class: string;
  action: string;
  discount_percent: number | null;
};

/**
 * Fold rule rows into the in-memory grid the engine has always used. The
 * SHAPE is deliberately unchanged: resolveTicketRate, offersAction and every
 * caller keep working, so normalizing storage never touched the money math.
 * Rows for unknown keys are ignored; missing rows keep their default, so a
 * partial table can't produce NaN discounts.
 */
export function gridFromRuleRows(
  rows: readonly RewardRuleRow[],
  cap: number,
): RewardsGrid {
  const grid = {} as Record<ClassSegment, SegmentRates>;
  for (const cls of CLASS_SEGMENTS) {
    grid[cls] = { ...DEFAULT_REWARDS_GRID.grid[cls], conservative: 0, aggressive: 0, dominant: 0 };
  }
  const actions = {} as ActionMatrix;
  for (const action of ACTION_SEGMENTS) {
    const perClass = {} as Record<ClassSegment, SegmentRates>;
    for (const cls of CLASS_SEGMENTS) {
      perClass[cls] = { zero: 0, conservative: 0, aggressive: 0, dominant: 0 };
    }
    actions[action] = perClass;
  }

  for (const row of rows) {
    const strategy = row.strategy;
    if (strategy !== "conservative" && strategy !== "aggressive" && strategy !== "dominant") {
      continue;
    }
    const cls = CLASS_SEGMENTS.find((c) => c === row.class);
    if (!cls) continue;
    const value = num(row.discount_percent, 0);
    if (row.action === "standing") {
      grid[cls][strategy] = value;
      continue;
    }
    const action = ACTION_SEGMENTS.find((a) => a === row.action);
    if (!action) continue;
    actions[action][cls][strategy] = value;
  }

  return { grid, actions, cap };
}

/**
 * Loads the reward grid. `reward_rules` is the source of truth (v8); the
 * cap stays a scalar on app_settings because it is one platform constant,
 * not a rule.
 *
 * Two fallbacks, both deliberate — a ticket must never fail to price:
 * an empty/unreadable rules table falls back to the legacy blob (which is
 * still written on every save), and a missing blob falls back to the locked
 * defaults.
 */
export async function loadRewardsGrid(
  admin: SupabaseClient,
): Promise<RewardsGrid> {
  const [settingsRes, rulesRes] = await Promise.all([
    admin.from("app_settings").select("rewards_config").eq("id", 1).maybeSingle(),
    admin.from("reward_rules").select("strategy, class, action, discount_percent"),
  ]);

  const blob = settingsRes.data?.rewards_config;
  const cap = blob ? coerceRewardsGrid(blob).cap : DEFAULT_REWARDS_GRID.cap;

  const rows = (rulesRes.data ?? []) as RewardRuleRow[];
  if (rows.length > 0) return gridFromRuleRows(rows, cap);

  return blob ? coerceRewardsGrid(blob) : DEFAULT_REWARDS_GRID;
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
  /** A ticket_reviews row exists for this consumer × place (v7 rung). */
  mesitaReviewed?: boolean;
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
  // v7: an action's rate depends on WHO performs it — the guest's class row
  // of the action matrix, falling back to standard for unknown/stale keys.
  const cls: ClassSegment = isClassSegment(ctx.classKey)
    ? ctx.classKey
    : "standard";
  const a = grid.actions;
  const qualifying: number[] = [
    grid.grid.standard[strategy],
    grid.grid[cls][strategy],
  ];
  if (ctx.isFirstVisit) qualifying.push(a.welcome[cls][strategy]);
  if (ctx.storyVerified) qualifying.push(a.story[cls][strategy]);
  if (ctx.reviewVerified) qualifying.push(a.review[cls][strategy]);
  if (ctx.mesitaReviewed) qualifying.push(a.mesita_review[cls][strategy]);
  const best = qualifying.reduce((m, r) => (r > m ? r : m), 0);
  return Math.max(0, Math.min(100, best));
}

// Whether the place's program offers a given action rung at its strategy for
// ANY class — the capability gate the consumer opt-in EFs check before
// accepting a submission. Per-class differentiation happens at rate
// resolution, not here: zeroing an action for one class shouldn't block the
// submission door for everyone (the class rung still applies via best-of).
export function offersAction(
  strategy: GridStrategy,
  grid: RewardsGrid,
  action: ActionSegment,
): boolean {
  return CLASS_SEGMENTS.some(
    (cls) => grid.actions[action][cls][strategy] > 0,
  );
}
