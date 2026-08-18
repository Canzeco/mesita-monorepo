// Promos bill engine — v11 additive (MESITA-1069) over the legacy v6/v13
// best-of grid (MESITA-723).
//
// Source of truth when present: app_settings.rewards_config.v11
//   { version: 11, visits, orders, cap }
// A bill pays visits base (strategy × class × plan) + welcome (first verified
// ticket at the place, D3-A) + each earned action bonus (mesita / story /
// google), applied to the first cap-pesos.
//
// CONTEXT: only the `visits` ladder is ever read. `orders` is parked — no
// ticket carries a remote context yet — so a remote bill cannot be priced and
// nothing here looks at those rates.
//
// IDENTITY: v11 prices two axes, class (bronze/silver/gold/diamond) and plan
// (free/premium), but `consumers` still stores only the legacy `class_key`.
// identityForClassKey bridges the two until `consumers.plan` lands.
//
// A stored v10 blob is migrated forward on read, so the engine keeps pricing
// correctly between the config-shape deploy and the operator's first save.
//
// Fallback (no v10 blob yet): the legacy reward_rules table / v13 grid
// blob, priced BEST-OF. Cap is a SEPARATE per-place param
// (monthly_promo_cap); the config `cap` is the platform fallback.
//
// A place's STRATEGY (zero/conservative/aggressive) is derived from its
// v4 rate columns via strategyForRates. Dominant (40/50/20/30) coerces to
// aggressive (D5) — never the silent-underpay-to-zero path.
//
// Segments v6 (2026-08-01) + Story gate v2 (MESITA-909) + doors rank flip
// (MESITA-972): four classes — standard, influencer (Instagram ≥ 2,000
// followers, automatic), premium (paid), aura (invite-only) — plus actions.
// Story is a UNIVERSAL
// action gated on a connected Instagram (`instagram_handle`), not on
// Influencer class; Review / Welcome / Mesita stay universal too. Class
// segments resolve generically (any known class key qualifies for its own
// grid row), so a future class/tier is a classes-table INSERT + one entry
// here — never per-class branches.

import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { strategyForRates, ratesFromPlace, type PromoRates } from "./promo-strategy.ts";
import {
  identityForClassKey,
  legacyRulesFromV11,
  normalizePromosV11,
  type PromosConfigV11,
} from "../admin-web-update-rewards-config/promos-v11-normalize.ts";

export type { PromosConfigV11 };
export { identityForClassKey };

// Class segments in rank order (mirrors public.classes: rank 0..3 —
// MESITA-972: standard < influencer < premium < aura).
export const CLASS_SEGMENTS = [
  "standard",
  "influencer",
  "premium",
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

// Three strategies (2026-08-09): Dominant retired for good. Anything
// unrecognised (custom/legacy, including a leftover Dominant rate tuple)
// coerces to zero.
export type GridStrategy = "zero" | "conservative" | "aggressive";
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
  /** When set, resolveTicketRate uses additive v11 math (MESITA-1069). */
  promos?: PromosConfigV11;
};

// The defaults (v9, MESITA-877) — the LAST-RESORT fallback, used only when
// both reward_rules and app_settings come back empty, so a ticket degrades to
// the canonical table rather than to zero. Must stay byte-identical to the
// admin catalog's defaultRateFor and the update EF's defaultFor.
//
// EVERY CELL COMES FROM ONE FORMULA, which is what makes the model's
// monotonicity provable instead of eyeballed:
//
//   rate = REWARD_FLOOR + type step + class step + strategy step
//
// so moving up ANY of the three dimensions can only raise the reward. The
// dimensions are ordered by the BUSINESS VALUE they create, not by how much
// effort they cost the guest:
//
//   type      Base & Mesita (retention + Mesita's own data)
//               < Story (social reach)
//               < Google & Welcome (acquisition + permanent public proof)
//   class     Standard < Influencer < Premium < Aura
//   strategy  Zero < Conservative < Aggressive
//
// The two groupings Pato wrote as ties are made STRICT by one step each —
// Mesita = Base + 5, Welcome = Google + 5. Under best-of a tie is a DEAD
// RUNG: an action worth exactly what the guest already had pays nothing for
// doing it, which would make both the Mesita review and the Welcome coupling
// decorative.
const REWARD_FLOOR = 5;

const TYPE_STEP = {
  standing: 0,
  mesita_review: 5,
  story: 10,
  review: 15,
  welcome: 20,
} as const;

const CLASS_STEP: Record<ClassSegment, number> = {
  standard: 0,
  influencer: 5,
  premium: 10,
  aura: 15,
};

const STRATEGY_STEP = { conservative: 0, aggressive: 10 } as const;

function defaultCell(
  type: keyof typeof TYPE_STEP,
  cls: ClassSegment,
  strategy: keyof typeof STRATEGY_STEP,
): number {
  return REWARD_FLOOR + TYPE_STEP[type] + CLASS_STEP[cls] + STRATEGY_STEP[strategy];
}

const defaultRow = (
  type: keyof typeof TYPE_STEP,
  cls: ClassSegment,
): SegmentRates => ({
  zero: 0, // off by definition
  conservative: defaultCell(type, cls, "conservative"),
  aggressive: defaultCell(type, cls, "aggressive"),
});

const defaultMatrix = (
  type: keyof typeof TYPE_STEP,
): Record<ClassSegment, SegmentRates> => ({
  standard: defaultRow(type, "standard"),
  influencer: defaultRow(type, "influencer"),
  premium: defaultRow(type, "premium"),
  aura: defaultRow(type, "aura"),
});

export const DEFAULT_REWARDS_GRID: RewardsGrid = {
  cap: 500,
  grid: defaultMatrix("standing"),
  actions: {
    mesita_review: defaultMatrix("mesita_review"),
    story: defaultMatrix("story"),
    welcome: defaultMatrix("welcome"),
    review: defaultMatrix("review"),
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
    grid[cls] = { ...DEFAULT_REWARDS_GRID.grid[cls], conservative: 0, aggressive: 0 };
  }
  const actions = {} as ActionMatrix;
  for (const action of ACTION_SEGMENTS) {
    const perClass = {} as Record<ClassSegment, SegmentRates>;
    for (const cls of CLASS_SEGMENTS) {
      perClass[cls] = { zero: 0, conservative: 0, aggressive: 0 };
    }
    actions[action] = perClass;
  }

  for (const row of rows) {
    const strategy = row.strategy;
    if (strategy !== "conservative" && strategy !== "aggressive") {
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
    admin.from("app_config").select("rewards_config").eq("id", 1).maybeSingle(),
    admin.from("reward_rules").select("strategy, class, action, discount_percent"),
  ]);

  const blob = settingsRes.data?.rewards_config;
  const raw =
    blob && typeof blob === "object" && !Array.isArray(blob)
      ? (blob as Record<string, unknown>)
      : {};

  // v11 additive SoT (MESITA-1069). reward_rules stays frozen as a mirror
  // written on save; the live engine no longer prices from it once a config
  // exists. A leftover v10 blob is migrated on read (normalizePromosV11
  // accepts both shapes), so pricing survives the gap between this deploy and
  // the operator's first v11 save.
  const stored = raw.v11 ?? raw.v10;
  if (stored && typeof stored === "object" && !Array.isArray(stored)) {
    const norm = normalizePromosV11(stored);
    if (norm.ok) {
      const legacy = gridFromRuleRows(
        legacyRulesFromV11(norm.value),
        norm.value.cap,
      );
      return { ...legacy, promos: norm.value };
    }
  }

  const cap = blob ? coerceRewardsGrid(blob).cap : DEFAULT_REWARDS_GRID.cap;
  const rows = (rulesRes.data ?? []) as RewardRuleRow[];
  if (rows.length > 0) return gridFromRuleRows(rows, cap);

  return blob ? coerceRewardsGrid(blob) : DEFAULT_REWARDS_GRID;
}

// Retired Dominant rate tuple (pre-2026-08-09). Migration remapped live
// rows; this catch keeps any leftover from silently underpaying as Zero.
const RETIRED_DOMINANT_RATES: PromoRates = {
  welcome_free_rate: 40,
  welcome_premium_rate: 50,
  free_rate: 20,
  premium_rate: 30,
};

let dominantCoerceLogged = false;

function ratesEqual(a: PromoRates, b: PromoRates): boolean {
  return (
    a.welcome_free_rate === b.welcome_free_rate &&
    a.welcome_premium_rate === b.welcome_premium_rate &&
    a.free_rate === b.free_rate &&
    a.premium_rate === b.premium_rate
  );
}

// A place's strategy from its v4 rate columns → the three grid keys.
export function placeStrategy(place: Record<string, unknown>): GridStrategy {
  const rates = ratesFromPlace(place);
  const p = strategyForRates(rates);
  if (p === "conservative") return "conservative";
  if (p === "aggressive") return "aggressive";
  // D5 (MESITA-992): Dominant → Aggressive. Log once per isolate.
  if (ratesEqual(rates, RETIRED_DOMINANT_RATES)) {
    if (!dominantCoerceLogged) {
      console.log(
        "placeStrategy: coercing retired Dominant rates → aggressive (D5)",
      );
      dominantCoerceLogged = true;
    }
    return "aggressive";
  }
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
  /**
   * THIS ticket carries the guest's Mesita review (v9, MESITA-877).
   * Deliberately per-TICKET, not per consumer × place: the review itself is
   * one-per-account-per-place and stays editable (MESITA-825), but the
   * REWARD is granted once — the Google/Yelp model. Asking "has this guest
   * ever reviewed here" would pay the rung on every future visit forever.
   */
  mesitaReviewed?: boolean;
};

function clampPercent(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/**
 * v11 additive resolution (MESITA-1069, carrying D1-A / D3-A forward).
 * total = visits base(strategy × class × plan) + welcome(first ticket) + each
 * earned bonus. Only the visits ladder resolves — orders is parked.
 *
 * The per-class Instagram story override is GONE: it keyed on the retired
 * `influencer` class, and Classes v2 prices no per-class bonus. Class is paid
 * for in the base, once, where the ladder is legible.
 */
function resolveAdditiveRate(
  strategy: Exclude<GridStrategy, "zero">,
  cfg: PromosConfigV11,
  ctx: RateContext,
): number {
  const { cls, plan } = identityForClassKey(ctx.classKey);
  // Bonuses are per strategy: Aggressive out-pays Conservative on the actions
  // exactly as it does on standing.
  const b = cfg.visits.bonuses[strategy];
  let total = cfg.visits.base[strategy][cls][plan];
  // D3-A: Welcome grants on the first verified ticket at the place — not
  // gated on a Google review (that was the v9 coupling).
  if (ctx.isFirstVisit) total += b.welcome;
  if (ctx.storyVerified) total += b.story;
  if (ctx.reviewVerified) total += b.google;
  if (ctx.mesitaReviewed) total += b.mesita;
  return clampPercent(total);
}

/**
 * Legacy best-of over the v13 grid. Kept as the fallback when no v10 blob
 * has been saved yet. Story eligibility is settled UPSTREAM (MESITA-909).
 */
function resolveBestOfRate(
  strategy: GridStrategy,
  grid: RewardsGrid,
  ctx: RateContext,
): number {
  const cls: ClassSegment = isClassSegment(ctx.classKey)
    ? ctx.classKey
    : "standard";
  const a = grid.actions;
  const qualifying: number[] = [
    grid.grid.standard[strategy],
    grid.grid[cls][strategy],
  ];
  // v9 coupling kept for the legacy path only.
  if (ctx.isFirstVisit && ctx.reviewVerified) {
    qualifying.push(a.welcome[cls][strategy]);
  }
  if (ctx.storyVerified) qualifying.push(a.story[cls][strategy]);
  if (ctx.reviewVerified) qualifying.push(a.review[cls][strategy]);
  if (ctx.mesitaReviewed) qualifying.push(a.mesita_review[cls][strategy]);
  return clampPercent(qualifying.reduce((m, r) => (r > m ? r : m), 0));
}

// Resolve a ticket's discount percent — and ONLY that (blended-rate privacy).
// Prefers v10 additive when loadRewardsGrid attached a v10 blob.
export function resolveTicketRate(
  strategy: GridStrategy,
  grid: RewardsGrid,
  ctx: RateContext,
): number {
  if (strategy === "zero") return 0;
  if (grid.promos) return resolveAdditiveRate(strategy, grid.promos, ctx);
  return resolveBestOfRate(strategy, grid, ctx);
}

// Whether the place's program offers a given action rung at its strategy.
export function offersAction(
  strategy: GridStrategy,
  grid: RewardsGrid,
  action: ActionSegment,
): boolean {
  if (strategy === "zero") return false;
  if (grid.promos) {
    const b = grid.promos.visits.bonuses[strategy];
    switch (action) {
      case "welcome":
        return b.welcome > 0;
      case "mesita_review":
        return b.mesita > 0;
      case "story":
        return b.story > 0;
      case "review":
        return b.google > 0;
    }
  }
  return CLASS_SEGMENTS.some(
    (cls) => grid.actions[action][cls][strategy] > 0,
  );
}
