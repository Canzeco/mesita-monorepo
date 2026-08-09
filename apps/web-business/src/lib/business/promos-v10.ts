// The v10 promos config, as the business console sees it (MESITA-1001).
//
// WHY THIS FILE EXISTS: the bill engine went additive-v10 in MESITA-992 and
// stopped reading the per-place `*_rate` columns. The console was still
// deriving every displayed rate from the frozen `strategies.ts` presets, so on
// Aggressive it told owners "10% for a returning Standard guest" while the
// engine charged 20%. The console now reads the LIVE config, shipped down on
// `business-web-get-overview.rewardsConfig`, and prices exactly like the
// engine.
//
// TWIN — keep in lockstep (the apps are separate install roots with no shared
// package, the same reason `database.types.ts` is hand-copied):
//   apps/web-admin/src/app/(app)/rewards-config/promos.ts
//   apps/web-admin/src/app/(app)/rewards-config/distribution-model.ts
// `promos-v10.test.ts` pins the outputs to the admin numbers — if a change
// there doesn't land here, that test goes red rather than the consoles
// quietly disagreeing.
//
// ZERO React imports on purpose: vitest imports this under plain node.

import {
  STRATEGY_VISIBILITY_LADDER,
  type StrategyId,
  type StrategyVisibility,
} from "./strategies";

export type StrategyKey = "conservative" | "aggressive";
export type ClassKey = "standard" | "influencer" | "premium" | "aura";

export type PromosBonuses = {
  welcome: number;
  mesita: number;
  story: number;
  /** null = inherit the universal story bonus. */
  story_influencer: number | null;
  google: number;
};

export type PromosConfig = {
  version: 10;
  base: Record<StrategyKey, Record<ClassKey, number>>;
  bonuses: PromosBonuses;
  cap: number;
};

export const STRATEGY_KEYS: readonly StrategyKey[] = [
  "conservative",
  "aggressive",
];
/** Worst → best. */
export const CLASS_KEYS: readonly ClassKey[] = [
  "standard",
  "influencer",
  "premium",
  "aura",
];

export const CLASS_META: Record<ClassKey, { name: string; emoji: string }> = {
  standard: { name: "Standard", emoji: "🙂" },
  influencer: { name: "Influencer", emoji: "📣" },
  premium: { name: "Premium", emoji: "💳" },
  aura: { name: "Aura", emoji: "✨" },
};

/** The ceiling the engine pays on any single additive total. */
export const RATE_MAX = 70;

/** Launch defaults — the fallback when the EF can't hand us the live blob. */
export const DEFAULT_PROMOS: PromosConfig = {
  version: 10,
  base: {
    conservative: { standard: 10, influencer: 15, premium: 20, aura: 25 },
    aggressive: { standard: 20, influencer: 30, premium: 40, aura: 50 },
  },
  bonuses: {
    welcome: 10,
    mesita: 5,
    story: 10,
    story_influencer: 30,
    google: 10,
  },
  cap: 500,
};

const snapRate = (v: unknown, fallback: number): number => {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  if (v <= 0) return 0;
  return Math.max(5, Math.min(RATE_MAX, Math.round(v / 5) * 5));
};

const isStrategy = (v: unknown): v is StrategyKey =>
  (STRATEGY_KEYS as readonly unknown[]).includes(v);
const isClass = (v: unknown): v is ClassKey =>
  (CLASS_KEYS as readonly unknown[]).includes(v);

/** Coerce whatever came off the wire into a complete config. Lenient: gaps
 *  fall back to the launch defaults rather than blanking the page. */
export function coercePromosConfig(raw: unknown): PromosConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return structuredClone(DEFAULT_PROMOS);
  }
  const r = raw as Record<string, unknown>;

  const base: PromosConfig["base"] = {
    conservative: { ...DEFAULT_PROMOS.base.conservative },
    aggressive: { ...DEFAULT_PROMOS.base.aggressive },
  };
  if (r.base && typeof r.base === "object" && !Array.isArray(r.base)) {
    for (const [s, row] of Object.entries(r.base as Record<string, unknown>)) {
      if (!isStrategy(s) || !row || typeof row !== "object") continue;
      for (const [c, v] of Object.entries(row as Record<string, unknown>)) {
        if (!isClass(c)) continue;
        base[s][c] = snapRate(v, DEFAULT_PROMOS.base[s][c]);
      }
    }
  }

  const b = (r.bonuses ?? {}) as Record<string, unknown>;
  const d = DEFAULT_PROMOS.bonuses;
  const bonuses: PromosBonuses = {
    welcome: snapRate(b.welcome, d.welcome),
    mesita: snapRate(b.mesita, d.mesita),
    story: snapRate(b.story, d.story),
    story_influencer:
      b.story_influencer === null
        ? null
        : b.story_influencer === undefined
          ? d.story_influencer
          : snapRate(b.story_influencer, d.story_influencer ?? d.story),
    google: snapRate(b.google, d.google),
  };

  const cap =
    typeof r.cap === "number" && Number.isFinite(r.cap)
      ? r.cap
      : DEFAULT_PROMOS.cap;

  return { version: 10, base, bonuses, cap };
}

/** The bonus an action adds for a class (standing = 0). */
function bonusFor(
  cfg: PromosConfig,
  cls: ClassKey,
  action: ActionKey,
): number {
  switch (action) {
    case "standing":
      return 0;
    case "mesita_review":
      return cfg.bonuses.mesita;
    case "story":
      return cls === "influencer" && cfg.bonuses.story_influencer !== null
        ? cfg.bonuses.story_influencer
        : cfg.bonuses.story;
    case "review":
      return cfg.bonuses.google;
    case "welcome":
      return cfg.bonuses.welcome;
  }
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

/** Base + that one action's bonus — one cell of the detail table. */
export function totalFor(
  cfg: PromosConfig,
  strategy: StrategyKey,
  cls: ClassKey,
  action: ActionKey,
): number {
  return Math.min(RATE_MAX, cfg.base[strategy][cls] + bonusFor(cfg, cls, action));
}

// ── Expected-outcome model (twin of admin's distribution-model.ts) ─────────
//
// Operator assumptions about who walks in and what they do. The admin
// Playground lets an operator move these; the card uses the platform
// defaults, which is why the copy beside it says "projected", not "average".

export type Assumptions = {
  welcomePct: number;
  classPct: Record<ClassKey, number>;
  actionPct: { mesita: number; story: number; google: number };
};

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  welcomePct: 20,
  classPct: { standard: 70, influencer: 10, premium: 15, aura: 5 },
  actionPct: { mesita: 30, story: 15, google: 10 },
};

const clampPct = (v: number) => Math.max(0, Math.min(100, v));

/** Total for one concrete visit — every earned bonus stacks on the base. */
function visitTotal(
  cfg: PromosConfig,
  strategy: StrategyKey,
  cls: ClassKey,
  welcome: boolean,
  mesita: boolean,
  story: boolean,
  google: boolean,
): number {
  const storyBonus =
    cls === "influencer" && cfg.bonuses.story_influencer !== null
      ? cfg.bonuses.story_influencer
      : cfg.bonuses.story;
  return Math.min(
    100,
    cfg.base[strategy][cls] +
      (welcome ? cfg.bonuses.welcome : 0) +
      (mesita ? cfg.bonuses.mesita : 0) +
      (story ? storyBonus : 0) +
      (google ? cfg.bonuses.google : 0),
  );
}

export type StrategyDistribution = {
  mean: number;
  p10: number;
  p90: number;
};

/** Exact expected distribution — every combination enumerated and weighted,
 *  no sampling, so the number never jitters between renders. */
export function distributionFor(
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

  const probByValue = new Map<number, number>();
  for (const cls of CLASS_KEYS) {
    const pc = clampPct(assumptions.classPct[cls]) / classSum;
    if (pc === 0) continue;
    for (const w of [false, true]) {
      for (const m of [false, true]) {
        for (const s of [false, true]) {
          for (const g of [false, true]) {
            const p =
              pc *
              (w ? pw : 1 - pw) *
              (m ? pm : 1 - pm) *
              (s ? ps : 1 - ps) *
              (g ? pg : 1 - pg);
            if (p === 0) continue;
            const value = visitTotal(cfg, strategy, cls, w, m, s, g);
            probByValue.set(value, (probByValue.get(value) ?? 0) + p);
          }
        }
      }
    }
  }

  const values = [...probByValue.keys()].sort((a, b) => a - b);
  let mean = 0;
  for (const v of values) mean += v * (probByValue.get(v) ?? 0);

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
// THREE segments, not five: the visibility ladder has exactly three rungs and
// there are exactly three postures, so a longer rail would imply headroom an
// owner could buy. The number is the EXPECTED discount per bill — what the
// posture costs — never a matrix extreme (the top cell lands on ~1.5% of
// visits and still understates the true ceiling, because bonuses stack).

export const METER_SEGMENTS = 3;

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

/** Visibility on the same three-segment rail: Low 1 · Mid 2 · High 3. */
export function visibilityDots(v: StrategyVisibility): number {
  const idx = STRATEGY_VISIBILITY_LADDER.indexOf(v);
  return idx < 0 ? 1 : idx + 1;
}
