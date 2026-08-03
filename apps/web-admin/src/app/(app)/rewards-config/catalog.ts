// Rewards Config catalog — the v7 Strategy × Class matrix (MESITA-859).
//
// This page lifts Pato's canonical rewards table out of code and onto the
// public.app_settings singleton. Rows are Strategy × Class; columns are the
// standing discount (None) plus every rewarded action — "different discount
// for each item, depending on the tier". The v13 bill engine
// (_shared/rewards-config.ts) reads it on every ticket.
//
// v13 blob: { cap, grid: { <class>: rates }, actions: { <action>: { <class>:
// rates } } }. A v12 blob (flat action rows inside `grid`, no `actions`)
// coerces by IDENTITY — the flat value copies to every class — so a stale row
// renders and bills exactly as before. mesita_review joined in v7 and
// launches at 0 (unpriced) until the operator prices it here.
//
// Grid rule (locked by Pato 2026-07-22): 5% steps, floor 10%, ceiling 50%
// (allowed {0, 10, 15, … 50}; 0 = off). Zero strategy is off by definition.
// Universal cap: every discount applies to the first `cap` MXN of the bill.
//
// Keys are the contract shared with admin-web-{get,update}-rewards-config and
// the best-of resolution in _shared/rewards-config.ts — keep them in
// lock-step (MESITA-805 pins this with tests on the EF side).

export type GridStrategy = "zero" | "conservative" | "aggressive" | "dominant";

export type ClassKey = "standard" | "premium" | "influencer" | "aura";
export type ActionKey = "mesita_review" | "story" | "welcome" | "review";

export type SegmentRates = Record<GridStrategy, number>;

export type RewardsConfig = {
  /** Standing class discounts — the "None" column of the table. */
  grid: Record<ClassKey, SegmentRates>;
  /** Per-class, per-strategy action rates — the rest of the columns. */
  actions: Record<ActionKey, Record<ClassKey, SegmentRates>>;
  /** Universal cap (MXN): the discount applies to the first `cap` of the bill. */
  cap: number;
};

export const CLASS_KEYS: readonly ClassKey[] = [
  "standard",
  "premium",
  "influencer",
  "aura",
];
export const ACTION_KEYS: readonly ActionKey[] = [
  "mesita_review",
  "story",
  "welcome",
  "review",
];

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

// The editable strategies — Zero is off by definition, so it has no rows in
// the matrix (all-None, fixed).
export const EDITABLE_STRATEGIES: readonly {
  key: Exclude<GridStrategy, "zero">;
  label: string;
  blurb: string;
}[] = [
  {
    key: "conservative",
    label: "Conservative",
    blurb: "A calm, sustainable discount.",
  },
  {
    key: "aggressive",
    label: "Aggressive",
    blurb: "Bold headlines to pull a crowd.",
  },
  {
    key: "dominant",
    label: "Dominant",
    blurb: "Raises the floor — a strong deal for every guest.",
  },
];

// The 5% grid: off, then 10 → 50 in steps of 5.
const RATE_STEP = 5;
const RATE_FLOOR = 10;
const RATE_MAX = 50;
export const ALLOWED_RATES: readonly number[] = [
  0, 10, 15, 20, 25, 30, 35, 40, 45, 50,
];

export const CAP_MIN = 0;
export const CAP_MAX = 5000;
const CAP_DEFAULT = 500;

const R = (
  conservative: number,
  aggressive: number,
  dominant: number,
): SegmentRates => ({ zero: 0, conservative, aggressive, dominant });

const FLAT = (r: SegmentRates): Record<ClassKey, SegmentRates> => ({
  standard: { ...r },
  premium: { ...r },
  influencer: { ...r },
  aura: { ...r },
});

// The v7 launch defaults — the identity migration of the locked v6 table.
export const DEFAULT_CONFIG: RewardsConfig = {
  cap: CAP_DEFAULT,
  grid: {
    standard: R(10, 10, 20),
    premium: R(15, 20, 25),
    influencer: R(15, 20, 25),
    aura: R(20, 25, 30),
  },
  actions: {
    mesita_review: FLAT(R(0, 0, 0)),
    story: FLAT(R(20, 30, 40)),
    welcome: FLAT(R(20, 30, 40)),
    review: FLAT(R(30, 50, 50)),
  },
};

/** Snap any number to the 5% grid: ≤0 → 0, else clamp to [10,50] rounded to 5. */
function snapRate(v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 0;
  if (n <= 0) return 0;
  const stepped = Math.round(n / RATE_STEP) * RATE_STEP;
  return Math.max(RATE_FLOOR, Math.min(RATE_MAX, stepped));
}

function clampCap(v: unknown): number {
  const n =
    typeof v === "number" && Number.isFinite(v) ? Math.round(v) : CAP_DEFAULT;
  return Math.max(CAP_MIN, Math.min(CAP_MAX, n));
}

function coerceRow(row: unknown, fallback: SegmentRates): SegmentRates {
  const r =
    row && typeof row === "object" && !Array.isArray(row)
      ? (row as Record<string, unknown>)
      : null;
  return {
    zero: 0, // off by definition
    conservative:
      r && "conservative" in r
        ? snapRate(r.conservative)
        : fallback.conservative,
    aggressive:
      r && "aggressive" in r ? snapRate(r.aggressive) : fallback.aggressive,
    dominant: r && "dominant" in r ? snapRate(r.dominant) : fallback.dominant,
  };
}

/**
 * Coerce whatever the row holds into a renderable v13 matrix. Anything
 * malformed resolves to the launch defaults — the page must always be usable.
 * A v12 blob migrates by identity (flat action rows copy to every class).
 * Mirrors normalizeConfig in the update EF (the strict gate on save).
 */
export function coerceConfig(raw: unknown): RewardsConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return DEFAULT_CONFIG;
  }
  const c = raw as Record<string, unknown>;
  const rawGrid =
    c.grid && typeof c.grid === "object" && !Array.isArray(c.grid)
      ? (c.grid as Record<string, unknown>)
      : {};
  const rawActions =
    c.actions && typeof c.actions === "object" && !Array.isArray(c.actions)
      ? (c.actions as Record<string, unknown>)
      : {};

  const grid = {} as Record<ClassKey, SegmentRates>;
  for (const cls of CLASS_KEYS) {
    grid[cls] = coerceRow(rawGrid[cls], DEFAULT_CONFIG.grid[cls]);
  }

  const actions = {} as Record<ActionKey, Record<ClassKey, SegmentRates>>;
  for (const action of ACTION_KEYS) {
    const rawAction =
      rawActions[action] && typeof rawActions[action] === "object"
        ? (rawActions[action] as Record<string, unknown>)
        : null;
    const legacyFlat = action === "mesita_review" ? null : rawGrid[action];
    const perClass = {} as Record<ClassKey, SegmentRates>;
    for (const cls of CLASS_KEYS) {
      perClass[cls] = coerceRow(
        rawAction?.[cls] ?? legacyFlat,
        DEFAULT_CONFIG.actions[action][cls],
      );
    }
    actions[action] = perClass;
  }

  return { grid, actions, cap: "cap" in c ? clampCap(c.cap) : CAP_DEFAULT };
}
