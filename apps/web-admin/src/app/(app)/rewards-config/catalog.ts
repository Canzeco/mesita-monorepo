// Rewards Config catalog — the v8 NORMALIZED rule list (MESITA-873).
//
// One rule per (strategy × class × action) — 3 × 4 × 5 = 60 rows, listed
// Strategy → Class → Action → Discount, exactly the table Pato wrote out.
// "standing" is the None column: v7 stored the standing discount and the
// action rates in two different shapes for the same fact, and collapsing
// them means a future action (TikTok, Referral, Birthday, Spend $X) is
// INSERTED as rows instead of changing the schema.
//
// Honest limit on that promise: pricing becomes pure data, but ELIGIBILITY
// stays code — the bill engine has to know what verified signal gates an
// action. A new row prices instantly and pays nothing until its signal ships.
//
// Rate grid: 5% steps, floor 5%, ceiling 70% (0 = off) — MESITA-866/872.
// Zero strategy has no rules; it is off by definition.
// The cap is NOT a rule — it is one platform-wide scalar, still on
// app_settings.rewards_config.cap, and categorical (see ALLOWED_CAPS).
//
// Keys are the contract shared with admin-web-{get,update}-rewards-config and
// the fold in _shared/rewards-config.ts gridFromRuleRows — keep them in
// lock-step (MESITA-805 pins this with tests on the EF side).

export type StrategyKey = "conservative" | "aggressive" | "dominant";
export type ClassKey = "standard" | "premium" | "influencer" | "aura";
export type ActionKey =
  | "standing"
  | "mesita_review"
  | "story"
  | "welcome"
  | "review";

export type RewardRule = {
  strategy: StrategyKey;
  class: ClassKey;
  action: ActionKey;
  discount_percent: number;
};

/** The whole editable state: the rule list plus the one scalar. */
export type RewardsConfig = {
  rules: RewardRule[];
  cap: number;
};

export const STRATEGY_KEYS: readonly StrategyKey[] = [
  "conservative",
  "aggressive",
  "dominant",
];
// Worst → best, and the order rows render in. Influencer sits BELOW Premium
// (v9, MESITA-877): they used to tie, which left the ladder ambiguous.
export const CLASS_KEYS: readonly ClassKey[] = [
  "standard",
  "influencer",
  "premium",
  "aura",
];
// Also worst → best, by the BUSINESS VALUE each creates: retention and
// Mesita's own data, then social reach, then acquisition + public proof.
// Welcome comes last because it is unlocked by the Google review.
export const ACTION_KEYS: readonly ActionKey[] = [
  "standing",
  "mesita_review",
  "story",
  "review",
  "welcome",
];

export const RULE_COUNT =
  STRATEGY_KEYS.length * CLASS_KEYS.length * ACTION_KEYS.length; // 60

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
  dominant: {
    name: "Dominant",
    emoji: "👑",
    blurb: "Raises the floor — a strong deal for every guest.",
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
    blurb: "Reach class — Instagram 1,000+, automatic. Story is theirs alone.",
  },
  aura: {
    name: "Aura",
    emoji: "✨",
    blurb: "Invite-only presence class — paid for showing up.",
  },
};

export const ACTION_META: Record<
  ActionKey,
  { name: string; emoji: string; blurb: string }
> = {
  standing: {
    name: "None (Standing)",
    emoji: "🎫",
    blurb: "The standing class discount — no action required.",
  },
  mesita_review: {
    name: "Mesita Review",
    emoji: "🍽️",
    blurb:
      "In-app rating, one per guest per place (updatable). Unpriced (0) at launch.",
  },
  story: {
    name: "Instagram Story",
    emoji: "📸",
    blurb: "Influencer-only — tagged story, self-attested (MESITA-849).",
  },
  welcome: {
    name: "Welcome Visit",
    emoji: "🚪",
    blurb: "First ticket at the place, any class — detected automatically.",
  },
  review: {
    name: "Google Review",
    emoji: "⭐",
    blurb: "One-shot per guest per place, any class — self-attested.",
  },
};

// The 5% grid: off, then 5 → 70 in steps of 5.
const RATE_STEP = 5;
const RATE_FLOOR = 5;
const RATE_MAX = 70;
export const ALLOWED_RATES: readonly number[] = [
  0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70,
];

// The universal cap is CATEGORICAL: four round options. A free number field
// allowed both a meaningless cap (MX$37) and MX$0 — which silently meant NO
// ceiling, the opposite of the promise this knob makes.
export const ALLOWED_CAPS: readonly number[] = [100, 200, 500, 1000];
const CAP_DEFAULT = 500;

// ── The defaults (v9, Pato 2026-08-04 — MESITA-877) ─────────────────────
//
// These are the numbers "Launch defaults" restores, and what a gap in the
// stored table falls back to. EVERY CELL COMES FROM ONE FORMULA:
//
//   rate = REWARD_FLOOR + type step + class step + strategy step
//
// which is what makes the model's monotonicity provable rather than
// eyeballed — moving up any of the three dimensions can only raise a reward.
// The dimensions are ordered by the BUSINESS VALUE created, not by the
// effort the guest spends:
//
//   type      Base & Mesita (retention + Mesita's own data)
//               < Story (social reach)
//               < Google & Welcome (acquisition + permanent public proof)
//   class     Standard < Influencer < Premium < Aura
//   strategy  Zero < Conservative < Aggressive < Dominant
//
// The two groupings Pato wrote as ties are made STRICT by one step each —
// Mesita = Base + 5, Welcome = Google + 5. Under best-of a tie is a DEAD
// RUNG: an action worth exactly what the guest already had pays nothing for
// doing it, which would leave both the Mesita review and the Welcome
// coupling decorative.
const REWARD_FLOOR = 5;

const TYPE_STEP: Record<ActionKey, number> = {
  standing: 0,
  mesita_review: 5,
  story: 10,
  review: 15,
  welcome: 20,
};

const CLASS_STEP: Record<ClassKey, number> = {
  standard: 0,
  influencer: 5,
  premium: 10,
  aura: 15,
};

const STRATEGY_STEP: Record<StrategyKey, number> = {
  conservative: 0,
  aggressive: 10,
  dominant: 20,
};

export function defaultRateFor(
  strategy: StrategyKey,
  cls: ClassKey,
  action: ActionKey,
): number {
  return (
    REWARD_FLOOR + TYPE_STEP[action] + CLASS_STEP[cls] + STRATEGY_STEP[strategy]
  );
}

export const ruleKey = (
  strategy: StrategyKey,
  cls: ClassKey,
  action: ActionKey,
) => `${strategy}|${cls}|${action}`;

/** The complete rule list in canonical order, at launch prices. */
export function defaultRules(): RewardRule[] {
  const rules: RewardRule[] = [];
  for (const strategy of STRATEGY_KEYS) {
    for (const cls of CLASS_KEYS) {
      for (const action of ACTION_KEYS) {
        rules.push({
          strategy,
          class: cls,
          action,
          discount_percent: defaultRateFor(strategy, cls, action),
        });
      }
    }
  }
  return rules;
}

export const DEFAULT_CONFIG: RewardsConfig = {
  rules: defaultRules(),
  cap: CAP_DEFAULT,
};

/**
 * One rule's rate out of the flat list. The normalized shape's tradeoff:
 * lookups are a find instead of a nested index, so any surface reading more
 * than a couple of cells should index once (see the map in the editor) —
 * this helper is for the handful-of-cells case.
 */
export function rateFromRules(
  rules: readonly RewardRule[],
  strategy: StrategyKey,
  cls: ClassKey,
  action: ActionKey,
): number {
  const hit = rules.find(
    (r) => r.strategy === strategy && r.class === cls && r.action === action,
  );
  return hit?.discount_percent ?? defaultRateFor(strategy, cls, action);
}

/** Snap any number to the 5% grid: ≤0 → 0, else clamp to [5,70] rounded to 5. */
function snapRate(v: unknown, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  if (v <= 0) return 0;
  const stepped = Math.round(v / RATE_STEP) * RATE_STEP;
  return Math.max(RATE_FLOOR, Math.min(RATE_MAX, stepped));
}

/** Snap the cap onto the categorical ladder — nearest allowed option. */
function snapCap(v: unknown): number {
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
const isAction = (v: unknown): v is ActionKey =>
  (ACTION_KEYS as readonly unknown[]).includes(v);

/**
 * Coerce whatever the EF returned into a COMPLETE, renderable rule set —
 * always all 60, in canonical order. A partially-seeded table, an unknown
 * key, or a stale shape all resolve to launch defaults for the gap rather
 * than rendering a hole. Mirrors normalizeRewards in the update EF.
 */
export function coerceRules(rawRules: unknown, rawCap: unknown): RewardsConfig {
  const sent = new Map<string, number>();
  if (Array.isArray(rawRules)) {
    for (const entry of rawRules) {
      if (!entry || typeof entry !== "object") continue;
      const r = entry as Record<string, unknown>;
      if (!isStrategy(r.strategy) || !isClass(r.class) || !isAction(r.action)) {
        continue;
      }
      sent.set(
        ruleKey(r.strategy, r.class, r.action),
        snapRate(
          r.discount_percent,
          defaultRateFor(r.strategy, r.class, r.action),
        ),
      );
    }
  }

  const rules: RewardRule[] = [];
  for (const strategy of STRATEGY_KEYS) {
    for (const cls of CLASS_KEYS) {
      for (const action of ACTION_KEYS) {
        const key = ruleKey(strategy, cls, action);
        rules.push({
          strategy,
          class: cls,
          action,
          discount_percent:
            sent.get(key) ?? defaultRateFor(strategy, cls, action),
        });
      }
    }
  }

  return { rules, cap: snapCap(rawCap) };
}
