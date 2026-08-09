// Normalize the Promos Config v10 payload (MESITA-991) — the strict-shape,
// lenient-values gate on save. Mirrors coercePromosConfig + legacyRulesFrom in
// web-admin app/(app)/rewards-config/promos.ts — keep them in lock-step.
//
// v10 is the ADDITIVE model: a bill pays base (strategy × class) + welcome +
// each earned action bonus, on the first cap-pesos. Until the engine flip
// (MESITA-992) the live bill still prices best-of from reward_rules, so the
// writer derives those 40 cells from the v10 knobs on every save
// (legacyRulesFromV10) — the engine keeps tracking operator edits.
//
// Lenient by design (the MESITA-804 lesson): unknown keys drop, gaps fall
// back to the v10 launch defaults, every rate snaps to the 5% grid. The only
// hard error is a non-object body.

const STRATEGY_KEYS = ["conservative", "aggressive"] as const;
type StrategyKey = (typeof STRATEGY_KEYS)[number];

const CLASS_KEYS = ["standard", "influencer", "premium", "aura"] as const;
type ClassKey = (typeof CLASS_KEYS)[number];

const ACTION_KEYS = [
  "standing",
  "mesita_review",
  "story",
  "review",
  "welcome",
] as const;
type ActionKey = (typeof ACTION_KEYS)[number];

export type PromosBonuses = {
  welcome: number;
  mesita: number;
  story: number;
  /** null = "Same as universal" (inherit story). */
  story_influencer: number | null;
  google: number;
};

export type PromosConfigV10 = {
  version: 10;
  base: Record<StrategyKey, Record<ClassKey, number>>;
  bonuses: PromosBonuses;
  cap: number;
};

export type LegacyRuleRow = {
  strategy: StrategyKey;
  class: ClassKey;
  action: ActionKey;
  discount_percent: number;
};

const RATE_STEP = 5;
const RATE_FLOOR = 5;
const RATE_MAX = 70;

const ALLOWED_CAPS = [200, 500, 1000] as const;
const CAP_DEFAULT = 500;

// The v10 launch defaults (Pato, 2026-08-09 — MESITA-991). Byte-identical to
// DEFAULT_PROMOS in the web-admin promos catalog.
export const DEFAULT_PROMOS_V10: PromosConfigV10 = {
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

function snapRate(v: unknown, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  if (v <= 0) return 0;
  const stepped = Math.round(v / RATE_STEP) * RATE_STEP;
  return Math.max(RATE_FLOOR, Math.min(RATE_MAX, stepped));
}

function snapCap(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return CAP_DEFAULT;
  let best: number = ALLOWED_CAPS[0];
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
 * Coerce an unknown body into a complete v10 config. Returns an error only
 * for a non-object payload; everything else resolves via defaults + snapping.
 */
export function normalizePromosV10(
  raw: unknown,
): { ok: true; value: PromosConfigV10 } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "config must be an object" };
  }
  const r = raw as Record<string, unknown>;

  const base: PromosConfigV10["base"] = {
    conservative: { ...DEFAULT_PROMOS_V10.base.conservative },
    aggressive: { ...DEFAULT_PROMOS_V10.base.aggressive },
  };
  if (r.base && typeof r.base === "object" && !Array.isArray(r.base)) {
    for (const [s, row] of Object.entries(r.base as Record<string, unknown>)) {
      if (!isStrategy(s) || !row || typeof row !== "object") continue;
      for (const [c, v] of Object.entries(row as Record<string, unknown>)) {
        if (!isClass(c)) continue;
        base[s][c] = snapRate(v, DEFAULT_PROMOS_V10.base[s][c]);
      }
    }
  }

  const b = (r.bonuses ?? {}) as Record<string, unknown>;
  const d = DEFAULT_PROMOS_V10.bonuses;
  const bonuses: PromosBonuses = {
    welcome: snapRate(b.welcome, d.welcome),
    mesita: snapRate(b.mesita, d.mesita),
    story: snapRate(b.story, d.story),
    story_influencer: b.story_influencer === null
      ? null
      : b.story_influencer === undefined
      ? d.story_influencer
      : snapRate(b.story_influencer, d.story_influencer ?? d.story),
    google: snapRate(b.google, d.google),
  };

  return {
    ok: true,
    value: { version: 10, base, bonuses, cap: snapCap(r.cap) },
  };
}

function bonusForAction(
  cfg: PromosConfigV10,
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
 * Derive the complete 40-cell legacy best-of rule set from the v10 knobs —
 * cell = base + that action's bonus, clamped to the engine's 70% ceiling.
 * This is what keeps the LIVE engine tracking edits until MESITA-992.
 */
export function legacyRulesFromV10(cfg: PromosConfigV10): LegacyRuleRow[] {
  const rules: LegacyRuleRow[] = [];
  for (const strategy of STRATEGY_KEYS) {
    for (const cls of CLASS_KEYS) {
      for (const action of ACTION_KEYS) {
        rules.push({
          strategy,
          class: cls,
          action,
          discount_percent: Math.min(
            RATE_MAX,
            cfg.base[strategy][cls] + bonusForAction(cfg, cls, action),
          ),
        });
      }
    }
  }
  return rules;
}
