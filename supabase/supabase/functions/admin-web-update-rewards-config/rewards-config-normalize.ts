// Normalize the Rewards Config payload (v8 rules, MESITA-873) — the strict
// gate on save. Mirrors coerceRules in the admin catalog. Self-contained (no
// _shared import) so the contract lives beside the writer.
//
// v8 shape: a flat list of rules, one per (strategy × class × action), where
// "standing" is the None column. v13's split — `grid` for standing plus
// `actions` for the rest — was two shapes for the same fact; collapsing them
// means a future action (TikTok, Referral) is rows, not a schema change.
//
// This gate is LENIENT by design: unknown keys are dropped, missing rules are
// filled from the launch defaults, and every cell is snapped, so a partial or
// slightly-off body can never write a malformed price. The only hard error is
// a non-object body. That leniency is what makes this page immune to the
// client↔EF key drift that broke /lineup-config for a week (MESITA-804).
//
// Rate grid: 5% steps, floor 5%, ceiling 70% (0 = off) — MESITA-866/872.
// Cap: categorical, one of {100, 200, 500, 1000} MXN.

// Worst → best. Influencer sits BELOW Premium (v9, MESITA-877); they used to
// tie, which left the ladder ambiguous.
const CLASS_KEYS = ["standard", "influencer", "premium", "aura"] as const;
type ClassKey = (typeof CLASS_KEYS)[number];

// Also worst → best, by the BUSINESS VALUE each creates. "standing" is the
// None column; welcome comes last because the Google review unlocks it.
const ACTION_KEYS = [
  "standing",
  "mesita_review",
  "story",
  "review",
  "welcome",
] as const;
type ActionKey = (typeof ACTION_KEYS)[number];

// Zero is off by definition and has no rows.
const STRATEGY_KEYS = ["conservative", "aggressive", "dominant"] as const;
type StrategyKey = (typeof STRATEGY_KEYS)[number];

export type RewardRule = {
  strategy: StrategyKey;
  class: ClassKey;
  action: ActionKey;
  discount_percent: number;
};

export type RewardsPayload = { rules: RewardRule[]; cap: number };

const RATE_STEP = 5;
const RATE_FLOOR = 5;
const RATE_MAX = 70;

// The cap is categorical (MESITA-872, narrowed to four steps 2026-08-04):
// a free number allowed both a meaningless cap (MX$37) and MX$0, which
// silently meant NO ceiling — the opposite of what this knob promises.
const ALLOWED_CAPS = [100, 200, 500, 1000] as const;
const CAP_DEFAULT = 500;

// The defaults (v9, MESITA-877). Only cells a caller omits fall back here —
// but they must stay byte-identical to the admin catalog's defaultRateFor
// and the engine's DEFAULT_REWARDS_GRID, or a saved table and a re-rendered
// one disagree (MESITA-805).
//
// One formula for all 60 cells, which is what makes the model's monotonicity
// provable: rate = floor + type step + class step + strategy step. Moving up
// any dimension can only raise a reward, and the dimensions are ordered by
// the BUSINESS VALUE created, not the guest's effort.
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

function defaultFor(
  cls: ClassKey,
  action: ActionKey,
  strategy: StrategyKey,
): number {
  return (
    REWARD_FLOOR + TYPE_STEP[action] + CLASS_STEP[cls] + STRATEGY_STEP[strategy]
  );
}

// Snap to the 5% grid: ≤0 → 0, else clamp to [5,70] rounded to the nearest 5.
function snapRate(v: unknown, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  if (v <= 0) return 0;
  const stepped = Math.round(v / RATE_STEP) * RATE_STEP;
  return Math.max(RATE_FLOOR, Math.min(RATE_MAX, stepped));
}

/** Snap the cap onto the categorical ladder — nearest allowed option. */
function snapCap(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return CAP_DEFAULT;
  let best: number = ALLOWED_CAPS[0];
  for (const option of ALLOWED_CAPS) {
    if (Math.abs(option - v) < Math.abs(best - v)) best = option;
  }
  return best;
}

function isClass(v: unknown): v is ClassKey {
  return (CLASS_KEYS as readonly unknown[]).includes(v);
}
function isAction(v: unknown): v is ActionKey {
  return (ACTION_KEYS as readonly unknown[]).includes(v);
}
function isStrategy(v: unknown): v is StrategyKey {
  return (STRATEGY_KEYS as readonly unknown[]).includes(v);
}

/**
 * Always returns the COMPLETE 60-rule set in canonical order, so an upsert
 * can never leave the table half-written. Sent rules win; anything missing
 * or unrecognised falls back to its launch default.
 */
export function normalizeRewards(
  raw: unknown,
): { ok: true; value: RewardsPayload } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "payload must be an object" };
  }
  const body = raw as Record<string, unknown>;

  // Index whatever the caller sent, dropping unknown keys silently.
  const sent = new Map<string, number>();
  if (Array.isArray(body.rules)) {
    for (const entry of body.rules) {
      if (!entry || typeof entry !== "object") continue;
      const r = entry as Record<string, unknown>;
      if (!isStrategy(r.strategy) || !isClass(r.class) || !isAction(r.action)) {
        continue;
      }
      sent.set(
        `${r.strategy}|${r.class}|${r.action}`,
        snapRate(r.discount_percent, defaultFor(r.class, r.action, r.strategy)),
      );
    }
  }

  const rules: RewardRule[] = [];
  for (const strategy of STRATEGY_KEYS) {
    for (const cls of CLASS_KEYS) {
      for (const action of ACTION_KEYS) {
        const key = `${strategy}|${cls}|${action}`;
        rules.push({
          strategy,
          class: cls,
          action,
          discount_percent: sent.get(key) ?? defaultFor(cls, action, strategy),
        });
      }
    }
  }

  return { ok: true, value: { rules, cap: snapCap(body.cap) } };
}
