// The promos config, as the business console sees it (MESITA-1001, v11 in
// MESITA-1069).
//
// WHY THIS FILE EXISTS: the bill engine went additive in MESITA-992 and
// stopped reading the per-place `*_rate` columns. The console was still
// deriving every displayed rate from the frozen `strategies.ts` presets, so on
// Aggressive it told owners "10% for a returning Standard guest" while the
// engine charged 20%. The console now reads the LIVE config, shipped down on
// `business-web-get-overview.rewardsConfig`, and prices exactly like the
// engine.
//
// v11 splits the axes v10 conflated: CLASS (bronze→diamond, who you are) and
// PLAN (free/premium, what you pay). The console renders the CLASS ladder at
// the FREE plan — the floor a place is guaranteed to pay for that class — and
// states the Premium uplift once, rather than printing a per-guest plan
// anywhere. Plan is private (Notion §2.7): a place learns what it is giving,
// never who it is giving it to. The expected-cost meter still blends both
// plans, so "what will this cost me" stays exact.
//
// TWIN — keep in lockstep (the apps are separate install roots with no shared
// package, the same reason `database.types.ts` is hand-copied):
//   apps/web-admin/src/app/(app)/rewards-config/promos.ts
//   apps/web-admin/src/app/(app)/rewards-config/distribution-model.ts
// `promos.test.ts` pins the outputs to the admin numbers — if a change there
// doesn't land here, that test goes red rather than the consoles quietly
// disagreeing.
//
// ZERO React imports on purpose: vitest imports this under plain node.

import {
  STRATEGY_VISIBILITY_LADDER,
  type StrategyId,
  type StrategyVisibility,
} from "./strategies";

export type StrategyKey = "conservative" | "aggressive" | "dominant";
export type ClassKey = "bronze" | "silver" | "gold" | "diamond";
export type PlanKey = "free" | "premium";

export type ContextBonuses = {
  welcome: number;
  mesita: number;
  story: number;
  google: number;
};

/** Bonuses are per strategy as well as per context (admin twin). */
export type StrategyBonuses = Record<StrategyKey, ContextBonuses>;

export type PromosConfig = {
  version: 11;
  visits: {
    base: Record<StrategyKey, Record<ClassKey, Record<PlanKey, number>>>;
    bonuses: StrategyBonuses;
  };
  orders: {
    base: Record<StrategyKey, Record<PlanKey, number>>;
    bonuses: StrategyBonuses;
    soon: boolean;
  };
  cap: number;
};

const STRATEGY_KEYS: readonly StrategyKey[] = [
  "conservative",
  "aggressive",
  "dominant",
];
/** Columns a place can pick. Dominant stays in the blob for leftover rows. */
export const LIVE_STRATEGY_KEYS = ["conservative", "aggressive"] as const;
/** Worst → best. */
export const CLASS_KEYS: readonly ClassKey[] = [
  "bronze",
  "silver",
  "gold",
  "diamond",
];
export const PLAN_KEYS: readonly PlanKey[] = ["free", "premium"];

export const CLASS_META: Record<ClassKey, { name: string; emoji: string }> = {
  bronze: { name: "Bronze", emoji: "🥉" },
  silver: { name: "Silver", emoji: "🥈" },
  gold: { name: "Gold", emoji: "🥇" },
  diamond: { name: "Diamond", emoji: "💎" },
};

/** The ceiling the engine pays on any single additive total. */
export const RATE_MAX = 70;

/** Launch defaults — the fallback when the EF can't hand us the live blob. */
export const DEFAULT_PROMOS: PromosConfig = {
  version: 11,
  visits: {
    base: {
      conservative: {
        bronze: { free: 10, premium: 20 },
        silver: { free: 15, premium: 25 },
        gold: { free: 20, premium: 30 },
        diamond: { free: 25, premium: 35 },
      },
      aggressive: {
        bronze: { free: 20, premium: 40 },
        silver: { free: 30, premium: 50 },
        gold: { free: 40, premium: 60 },
        diamond: { free: 50, premium: 70 },
      },
      dominant: {
        bronze: { free: 40, premium: 55 },
        silver: { free: 45, premium: 60 },
        gold: { free: 50, premium: 65 },
        diamond: { free: 55, premium: 70 },
      },
    },
    bonuses: {
      conservative: { welcome: 10, mesita: 5, story: 10, google: 15 },
      aggressive: { welcome: 10, mesita: 5, story: 10, google: 15 },
      dominant: { welcome: 10, mesita: 10, story: 10, google: 15 },
    },
  },
  orders: {
    base: {
      conservative: { free: 5, premium: 10 },
      aggressive: { free: 10, premium: 15 },
      dominant: { free: 15, premium: 20 },
    },
    bonuses: {
      conservative: { welcome: 5, mesita: 5, story: 5, google: 10 },
      aggressive: { welcome: 5, mesita: 5, story: 5, google: 10 },
      dominant: { welcome: 10, mesita: 10, story: 10, google: 15 },
    },
    soon: true,
  },
  cap: 500,
};

const RATE_STEP = 5;

const snapRate = (v: unknown, fallback: number): number => {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  if (v <= 0) return 0;
  return Math.max(5, Math.min(RATE_MAX, Math.round(v / RATE_STEP) * RATE_STEP));
};

const isStrategy = (v: unknown): v is StrategyKey =>
  (STRATEGY_KEYS as readonly unknown[]).includes(v);
const isClass = (v: unknown): v is ClassKey =>
  (CLASS_KEYS as readonly unknown[]).includes(v);
const isPlan = (v: unknown): v is PlanKey =>
  (PLAN_KEYS as readonly unknown[]).includes(v);

function coerceOneBonusSet(raw: unknown, d: ContextBonuses): ContextBonuses {
  const b = (raw ?? {}) as Record<string, unknown>;
  return {
    welcome: snapRate(b.welcome, d.welcome),
    mesita: snapRate(b.mesita, d.mesita),
    story: snapRate(b.story, d.story),
    google: snapRate(b.google, d.google),
  };
}

/** Accepts BOTH the flat legacy shape and the per-strategy one. */
function coerceBonuses(raw: unknown, d: StrategyBonuses): StrategyBonuses {
  const b = (raw ?? {}) as Record<string, unknown>;
  const isFlat = STRATEGY_KEYS.every((s) => b[s] === undefined);
  const out = {} as StrategyBonuses;
  for (const s of STRATEGY_KEYS) {
    out[s] = coerceOneBonusSet(isFlat ? b : b[s], d[s]);
  }
  return out;
}

const midpoint = (a: number, b: number) =>
  Math.round((a + b) / 2 / RATE_STEP) * RATE_STEP;

/**
 * Migrate a v10 blob — the old four-class rows carried both axes at once:
 * standard→bronze·free, influencer→silver·free, premium→bronze·premium,
 * aura→diamond·free. Gold interpolates; the plan uplift is what `premium`
 * paid over `standard`. Mirrors the admin + EF migration exactly.
 */
function migrateV10(r: Record<string, unknown>): PromosConfig {
  const d = DEFAULT_PROMOS;
  const rawBase = (r.base ?? {}) as Record<string, unknown>;
  const at = (s: StrategyKey, c: string): number | undefined => {
    const row = rawBase[s];
    if (!row || typeof row !== "object") return undefined;
    const v = (row as Record<string, unknown>)[c];
    return typeof v === "number" && Number.isFinite(v) ? v : undefined;
  };

  const base = structuredClone(d.visits.base);
  for (const s of STRATEGY_KEYS) {
    const bronzeFree = snapRate(at(s, "standard"), d.visits.base[s].bronze.free);
    const bronzePremium = snapRate(
      at(s, "premium"),
      d.visits.base[s].bronze.premium,
    );
    const silverFree = snapRate(
      at(s, "influencer"),
      d.visits.base[s].silver.free,
    );
    const diamondFree = snapRate(at(s, "aura"), d.visits.base[s].diamond.free);
    const goldFree = midpoint(silverFree, diamondFree);
    const uplift = Math.max(0, bronzePremium - bronzeFree);
    const up = (free: number) => Math.min(RATE_MAX, free + uplift);

    base[s] = {
      bronze: { free: bronzeFree, premium: bronzePremium },
      silver: { free: silverFree, premium: up(silverFree) },
      gold: { free: goldFree, premium: up(goldFree) },
      diamond: { free: diamondFree, premium: up(diamondFree) },
    };
  }

  return {
    version: 11,
    visits: { base, bonuses: coerceBonuses(r.bonuses, d.visits.bonuses) },
    orders: structuredClone(d.orders),
    cap:
      typeof r.cap === "number" && Number.isFinite(r.cap) ? r.cap : d.cap,
  };
}

/** Coerce whatever came off the wire into a complete config. Lenient: gaps
 *  fall back to the launch defaults rather than blanking the page. */
export function coercePromosConfig(raw: unknown): PromosConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return structuredClone(DEFAULT_PROMOS);
  }
  const r = raw as Record<string, unknown>;
  if (r.version === 10 || (r.base != null && r.visits == null)) {
    return migrateV10(r);
  }

  const d = DEFAULT_PROMOS;
  const visitsRaw = (r.visits ?? {}) as Record<string, unknown>;
  const ordersRaw = (r.orders ?? {}) as Record<string, unknown>;

  const visitsBase = structuredClone(d.visits.base);
  if (visitsRaw.base && typeof visitsRaw.base === "object") {
    for (const [s, byClass] of Object.entries(
      visitsRaw.base as Record<string, unknown>,
    )) {
      if (!isStrategy(s) || !byClass || typeof byClass !== "object") continue;
      for (const [c, byPlan] of Object.entries(
        byClass as Record<string, unknown>,
      )) {
        if (!isClass(c) || !byPlan || typeof byPlan !== "object") continue;
        for (const [p, v] of Object.entries(byPlan as Record<string, unknown>)) {
          if (!isPlan(p)) continue;
          visitsBase[s][c][p] = snapRate(v, d.visits.base[s][c][p]);
        }
      }
    }
  }

  const ordersBase = structuredClone(d.orders.base);
  if (ordersRaw.base && typeof ordersRaw.base === "object") {
    for (const [s, byPlan] of Object.entries(
      ordersRaw.base as Record<string, unknown>,
    )) {
      if (!isStrategy(s) || !byPlan || typeof byPlan !== "object") continue;
      for (const [p, v] of Object.entries(byPlan as Record<string, unknown>)) {
        if (!isPlan(p)) continue;
        ordersBase[s][p] = snapRate(v, d.orders.base[s][p]);
      }
    }
  }

  return {
    version: 11,
    visits: {
      base: visitsBase,
      bonuses: coerceBonuses(visitsRaw.bonuses, d.visits.bonuses),
    },
    orders: {
      base: ordersBase,
      bonuses: coerceBonuses(ordersRaw.bonuses, d.orders.bonuses),
      soon: true,
    },
    cap:
      typeof r.cap === "number" && Number.isFinite(r.cap) ? r.cap : d.cap,
  };
}

export type ActionKey =
  | "standing"
  | "mesita_review"
  | "story"
  | "review"
  | "welcome";

export const ACTION_KEYS: readonly ActionKey[] = [
  "standing",
  "mesita_review",
  "story",
  "review",
  "welcome",
];

export const ACTION_META: Record<ActionKey, { name: string; emoji: string }> = {
  standing: { name: "None (Standing)", emoji: "🎫" },
  mesita_review: { name: "Mesita Review", emoji: "🍽️" },
  story: { name: "Instagram Story", emoji: "📸" },
  welcome: { name: "Welcome Visit", emoji: "🚪" },
  review: { name: "Google Review", emoji: "⭐" },
};

/** The bonus an action adds on a visit (standing = 0). */
function bonusFor(
  cfg: PromosConfig,
  strategy: StrategyKey,
  action: ActionKey,
): number {
  const b = cfg.visits.bonuses[strategy];
  switch (action) {
    case "standing":
      return 0;
    case "mesita_review":
      return b.mesita;
    case "story":
      return b.story;
    case "review":
      return b.google;
    case "welcome":
      return b.welcome;
  }
}

/**
 * Base + that one action's bonus — one cell of the detail table. `plan`
 * defaults to Free: the console prints the class ladder at the floor and
 * states the Premium uplift separately rather than exposing a per-guest plan.
 */
export function totalFor(
  cfg: PromosConfig,
  strategy: StrategyKey,
  cls: ClassKey,
  action: ActionKey,
  plan: PlanKey = "free",
): number {
  return Math.min(
    RATE_MAX,
    cfg.visits.base[strategy][cls][plan] + bonusFor(cfg, strategy, action),
  );
}

/**
 * How many points a Premium subscriber resolves above Free at this class —
 * the one number the console states instead of a second rate column.
 */
export function premiumUplift(
  cfg: PromosConfig,
  strategy: StrategyKey,
  cls: ClassKey,
): number {
  const row = cfg.visits.base[strategy][cls];
  return Math.max(0, row.premium - row.free);
}

// ── Expected-outcome model (twin of admin's distribution-model.ts) ─────────
//
// Operator assumptions about who walks in and what they do. The admin
// Playground lets an operator move these; the card uses the platform
// defaults, which is why the copy beside it says "projected", not "average".

export type Assumptions = {
  welcomePct: number;
  classPct: Record<ClassKey, number>;
  /** % of guests on the Premium plan — independent of class. */
  premiumPct: number;
  actionPct: { mesita: number; story: number; google: number };
};

const DEFAULT_ASSUMPTIONS: Assumptions = {
  welcomePct: 20,
  classPct: { bronze: 70, silver: 15, gold: 10, diamond: 5 },
  premiumPct: 15,
  actionPct: { mesita: 30, story: 15, google: 10 },
};

const clampPct = (v: number) => Math.max(0, Math.min(100, v));

/** Total for one concrete visit — every earned bonus stacks on the base. */
function visitTotal(
  cfg: PromosConfig,
  strategy: StrategyKey,
  cls: ClassKey,
  plan: PlanKey,
  welcome: boolean,
  mesita: boolean,
  story: boolean,
  google: boolean,
): number {
  const b = cfg.visits.bonuses[strategy];
  return Math.min(
    100,
    cfg.visits.base[strategy][cls][plan] +
      (welcome ? b.welcome : 0) +
      (mesita ? b.mesita : 0) +
      (story ? b.story : 0) +
      (google ? b.google : 0),
  );
}

export type StrategyDistribution = {
  mean: number;
  p10: number;
  p90: number;
};

/** Exact expected distribution — every combination enumerated and weighted,
 *  no sampling, so the number never jitters between renders. */
function distributionFor(
  cfg: PromosConfig,
  assumptions: Assumptions,
  strategy: StrategyKey,
): StrategyDistribution {
  const classSum =
    CLASS_KEYS.reduce((t, c) => t + clampPct(assumptions.classPct[c]), 0) || 1;
  const pw = clampPct(assumptions.welcomePct) / 100;
  const pm = clampPct(assumptions.actionPct.mesita) / 100;
  const ps = clampPct(assumptions.actionPct.story) / 100;
  const pg = clampPct(assumptions.actionPct.google) / 100;
  const pPremium = clampPct(assumptions.premiumPct) / 100;
  const planWeight: Record<PlanKey, number> = {
    free: 1 - pPremium,
    premium: pPremium,
  };

  const probByValue = new Map<number, number>();
  for (const cls of CLASS_KEYS) {
    const pc = clampPct(assumptions.classPct[cls]) / classSum;
    if (pc === 0) continue;
    for (const plan of PLAN_KEYS) {
      const pp = pc * planWeight[plan];
      if (pp === 0) continue;
      for (const w of [false, true]) {
        for (const m of [false, true]) {
          for (const s of [false, true]) {
            for (const g of [false, true]) {
              const p =
                pp *
                (w ? pw : 1 - pw) *
                (m ? pm : 1 - pm) *
                (s ? ps : 1 - ps) *
                (g ? pg : 1 - pg);
              if (p === 0) continue;
              const value = visitTotal(cfg, strategy, cls, plan, w, m, s, g);
              probByValue.set(value, (probByValue.get(value) ?? 0) + p);
            }
          }
        }
      }
    }
  }

  const values = [...probByValue.keys()].sort((a, b) => a - b);
  // Accumulate over SIMULATED_VISITS-scaled counts, exactly as the admin twin
  // does, then divide back. Mathematically identical to summing `v * p`, but
  // NOT bit-identical: summing probabilities directly lands the Conservative
  // default on 20.499999999999996 where the true mean is exactly 20.5, so the
  // two consoles rounded to 20 and 21 and the drift alarm fired on a value
  // neither of them had actually changed. Same accumulation order = same
  // double, and the lockstep test compares like with like.
  const SIMULATED_VISITS = 1000;
  let mean = 0;
  for (const v of values) {
    mean += v * ((probByValue.get(v) ?? 0) * SIMULATED_VISITS);
  }
  mean /= SIMULATED_VISITS;

  const percentile = (target: number): number => {
    let cum = 0;
    for (const v of values) {
      cum += probByValue.get(v) ?? 0;
      if (cum >= target) return v;
    }
    return values[values.length - 1] ?? 0;
  };

  return { mean, p10: percentile(0.1), p90: percentile(0.9) };
}

// ── Card-face meters ───────────────────────────────────────────────────────
//
// FOUR segments, not five: the visibility ladder has exactly four rungs and
// there are exactly four postures, so a longer rail would imply headroom an
// owner could buy — and a SHORTER one would render Max identically to High,
// hiding the rung Dominant added. The number is the EXPECTED discount per bill
// — what the posture costs — never a matrix extreme (the top cell lands on
// ~1.5% of visits and still understates the true ceiling, because bonuses
// stack).

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
  if (id === "zero") return { dots: 0, mean: 0, p10: 0, p90: 0 };

  const key = id as StrategyKey;
  const mine = distributionFor(cfg, DEFAULT_ASSUMPTIONS, key);
  const top = Math.max(
    ...STRATEGY_KEYS.map(
      (s) => distributionFor(cfg, DEFAULT_ASSUMPTIONS, s).mean,
    ),
  );

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
