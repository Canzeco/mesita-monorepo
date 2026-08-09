// Promos catalog — the v10 ADDITIVE model (MESITA-991).
//
// v8/v9 priced every (strategy × class × action) cell independently — 40
// knobs. v10 compresses that to the 14 the model actually has: a base reward
// per (strategy × class), one special bonus (Welcome), three action bonuses
// (Mesita / Story / Google) universal across strategies and classes, plus a
// single Influencer override on Story. A bill pays base + welcome + each
// earned action bonus (additive — the engine flip is MESITA-992; until it
// ships, saves keep the legacy best-of rules in sync via legacyRulesFrom).
//
// The cap stays what #816 made it: the platform DEFAULT a place inherits
// when it has not picked its own monthly_promo_cap.
//
// Pure module on purpose — vitest can't import server-action chains
// (see promo-state.ts precedent), and the EF normalizer mirrors this file
// (admin-web-update-rewards-config/promos-v10-normalize.ts) — keep them in
// lock-step.

export type StrategyKey = "conservative" | "aggressive";
export type ClassKey = "standard" | "premium" | "influencer" | "aura";
export type ActionKey =
  | "standing"
  | "mesita_review"
  | "story"
  | "welcome"
  | "review";

export type PromosBonuses = {
  welcome: number;
  mesita: number;
  story: number;
  /** null = "Same as universal" (inherit story) — decision 2A. */
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
// Worst → best (v9 ladder, MESITA-877).
export const CLASS_KEYS: readonly ClassKey[] = [
  "standard",
  "influencer",
  "premium",
  "aura",
];
// Wire order for the legacy rule list (matches the v8 EF contract).
export const ACTION_KEYS: readonly ActionKey[] = [
  "standing",
  "mesita_review",
  "story",
  "review",
  "welcome",
];

export const STRATEGY_META: Record<
  StrategyKey,
  { name: string; emoji: string; blurb: string }
> = {
  conservative: {
    name: "Conservative",
    emoji: "🌿",
    blurb: "A calm, sustainable discount.",
  },
  aggressive: {
    name: "Aggressive",
    emoji: "⚡",
    blurb: "Bold headlines to pull a crowd.",
  },
};

export const CLASS_META: Record<
  ClassKey,
  { name: string; emoji: string; blurb: string }
> = {
  standard: {
    name: "Standard",
    emoji: "🙂",
    blurb: "Base class — the floor every guest inherits.",
  },
  premium: {
    name: "Premium",
    emoji: "💳",
    blurb: "Paid class — MX$100/mo, the consumer revenue lever.",
  },
  influencer: {
    name: "Influencer",
    emoji: "📣",
    blurb: "Reach class — Instagram 2,000+, automatic.",
  },
  aura: {
    name: "Aura",
    emoji: "✨",
    blurb: "Invite-only presence class — paid for showing up.",
  },
};

// Shared action vocabulary — consumed by manage-single's per-strategy matrix
// besides this page. "standing" is the base/None column.
export const ACTION_META: Record<
  ActionKey,
  { name: string; emoji: string }
> = {
  standing: { name: "None (Standing)", emoji: "🎫" },
  mesita_review: { name: "Mesita Review", emoji: "🍽️" },
  story: { name: "Instagram Story", emoji: "📸" },
  welcome: { name: "Welcome Visit", emoji: "🚪" },
  review: { name: "Google Review", emoji: "⭐" },
};

export type BonusKey = keyof PromosBonuses;

export const BONUS_META: Record<
  BonusKey,
  { name: string; emoji: string; qualifier: string }
> = {
  welcome: {
    name: "Welcome Visit",
    emoji: "🚪",
    // "Verified" on purpose — there is no reliable pre-create first-visit
    // detection; the bonus is granted at check time (decision D3-A).
    qualifier: "First verified ticket at the place",
  },
  mesita: {
    name: "Mesita Review",
    emoji: "🍽️",
    qualifier: "In-app rating, one per guest per place",
  },
  story: {
    name: "Instagram Story",
    emoji: "📸",
    qualifier: "Tagged story, self-attested",
  },
  story_influencer: {
    name: "Influencer override",
    emoji: "📣",
    qualifier: "Story bonus for the Influencer class",
  },
  google: {
    name: "Google Review",
    emoji: "⭐",
    qualifier: "One-shot per guest per place, self-attested",
  },
};

// The 5% grid: off, then 5 → 70 in steps of 5.
const RATE_STEP = 5;
const RATE_FLOOR = 5;
const RATE_MAX = 70;
export const ALLOWED_RATES: readonly number[] = [
  0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70,
];

// Default cap ladder — a place's own monthly_promo_cap wins at bill time (#816).
export const ALLOWED_CAPS: readonly number[] = [200, 500, 1000];
const CAP_DEFAULT = 500;

// ── The v10 launch defaults (Pato, 2026-08-09 — MESITA-991) ──────────────
// The numbers Pato wrote in the planning sheet: base doubles Conservative →
// Aggressive; bonuses are flat and small; the one override pays Influencer
// stories for their reach.
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
  cap: CAP_DEFAULT,
};

/** Snap any number to the 5% grid: ≤0 → 0, else clamp to [5,70] rounded to 5. */
export function snapRate(v: unknown, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  if (v <= 0) return 0;
  const stepped = Math.round(v / RATE_STEP) * RATE_STEP;
  return Math.max(RATE_FLOOR, Math.min(RATE_MAX, stepped));
}

/** Snap the cap onto the categorical ladder — nearest allowed option. */
export function snapCap(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return CAP_DEFAULT;
  let best = ALLOWED_CAPS[0];
  for (const option of ALLOWED_CAPS) {
    if (Math.abs(option - v) < Math.abs(best - v)) best = option;
  }
  return best;
}

const isStrategy = (v: unknown): v is StrategyKey =>
  (STRATEGY_KEYS as readonly unknown[]).includes(v);
const isClass = (v: unknown): v is ClassKey =>
  (CLASS_KEYS as readonly unknown[]).includes(v);

/**
 * Coerce whatever came off the wire into a complete v10 config. Lenient by
 * design (the MESITA-804 lesson): unknown keys drop, gaps fall back to the
 * launch defaults, every rate snaps to the grid. Only a non-object resolves
 * to plain defaults.
 */
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

  return { version: 10, base, bonuses, cap: snapCap(r.cap) };
}

// ── Legacy bridge (until MESITA-992 flips the engine) ────────────────────

type LegacyRule = {
  strategy: StrategyKey;
  class: ClassKey;
  action: ActionKey;
  discount_percent: number;
};

/** The bonus an action adds for a class (standing = 0). */
export function bonusForAction(
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

/**
 * The additive total a guest with this class earns for this single action
 * under this strategy — base + that action's bonus. The full-bill total under
 * v10 stacks several of these bonuses on one base; this per-action figure is
 * what the preview table shows and what the legacy best-of cell stores.
 */
export function totalFor(
  cfg: PromosConfig,
  strategy: StrategyKey,
  cls: ClassKey,
  action: ActionKey,
): number {
  return cfg.base[strategy][cls] + bonusForAction(cfg, cls, action);
}

/**
 * Derive the 40 legacy best-of rules from the v10 knobs so the LIVE engine
 * keeps tracking operator edits until MESITA-992 ships the additive flip.
 * Cells clamp to the engine's 70% ceiling and stay on the 5% grid.
 */
export function legacyRulesFrom(cfg: PromosConfig): LegacyRule[] {
  const rules: LegacyRule[] = [];
  for (const strategy of STRATEGY_KEYS) {
    for (const cls of CLASS_KEYS) {
      for (const action of ACTION_KEYS) {
        rules.push({
          strategy,
          class: cls,
          action,
          discount_percent: Math.min(RATE_MAX, totalFor(cfg, strategy, cls, action)),
        });
      }
    }
  }
  return rules;
}

/**
 * Seed a v10 config from the stored legacy rules — used the first time the
 * page loads before any v10 save exists. Base cells map 1:1 from the
 * "standing" rules; bonuses read as (action cell − standing) on the
 * Conservative · Standard row; the Influencer story override is kept only
 * when it differs from the universal story bonus. Exact for formula-shaped
 * tables, a reviewable approximation for hand-tuned ones.
 */
export function seedFromLegacyRules(rawRules: unknown): PromosConfig | null {
  if (!Array.isArray(rawRules) || rawRules.length === 0) return null;
  const cell = new Map<string, number>();
  for (const entry of rawRules) {
    if (!entry || typeof entry !== "object") continue;
    const r = entry as Record<string, unknown>;
    if (
      typeof r.strategy !== "string" ||
      typeof r.class !== "string" ||
      typeof r.action !== "string" ||
      typeof r.discount_percent !== "number"
    ) {
      continue;
    }
    cell.set(`${r.strategy}|${r.class}|${r.action}`, r.discount_percent);
  }
  if (cell.size === 0) return null;

  const at = (s: StrategyKey, c: ClassKey, a: ActionKey) =>
    cell.get(`${s}|${c}|${a}`);

  const base: PromosConfig["base"] = {
    conservative: { ...DEFAULT_PROMOS.base.conservative },
    aggressive: { ...DEFAULT_PROMOS.base.aggressive },
  };
  for (const s of STRATEGY_KEYS) {
    for (const c of CLASS_KEYS) {
      base[s][c] = snapRate(at(s, c, "standing"), DEFAULT_PROMOS.base[s][c]);
    }
  }

  const refBase = at("conservative", "standard", "standing");
  const diff = (a: ActionKey, fallback: number) => {
    const v = at("conservative", "standard", a);
    return typeof v === "number" && typeof refBase === "number"
      ? snapRate(v - refBase, fallback)
      : fallback;
  };
  const d = DEFAULT_PROMOS.bonuses;
  const story = diff("story", d.story);

  const inflBase = at("conservative", "influencer", "standing");
  const inflStory = at("conservative", "influencer", "story");
  const inflBonus =
    typeof inflBase === "number" && typeof inflStory === "number"
      ? snapRate(inflStory - inflBase, story)
      : story;

  return {
    version: 10,
    base,
    bonuses: {
      welcome: diff("welcome", d.welcome),
      mesita: diff("mesita_review", d.mesita),
      story,
      story_influencer: inflBonus === story ? null : inflBonus,
      google: diff("review", d.google),
    },
    cap: CAP_DEFAULT,
  };
}
