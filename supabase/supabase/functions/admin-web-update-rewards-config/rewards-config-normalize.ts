// Normalize the Rewards Config blob (v7 matrix, MESITA-859) — the strict gate
// on save. Mirrors coerceConfig in the admin catalog. Self-contained (no
// _shared import) so the contract lives beside the writer.
//
// v13 shape: `grid` holds the four STANDING class rows (the "None" column of
// Pato's table); `actions` prices every rewarded action PER CLASS per
// strategy. A v12 body (flat story/welcome/review rows inside `grid`, no
// `actions`) is accepted and migrated by IDENTITY — the flat value copies to
// every class; mesita_review, absent from v12, lands at its 0 default.
//
// Grid rule: 5% steps, floor 10%, ceiling 50% (0 = off). Zero strategy is off
// by definition. Every cell is snapped and every key is present, so a partial
// or slightly-off body can never write a malformed row; the only hard error is
// a non-object body.

const CLASS_KEYS = ["standard", "premium", "influencer", "aura"] as const;
type ClassKey = (typeof CLASS_KEYS)[number];

const ACTION_KEYS = ["mesita_review", "story", "welcome", "review"] as const;
type ActionKey = (typeof ACTION_KEYS)[number];

type SegmentRates = {
  zero: number;
  conservative: number;
  aggressive: number;
  dominant: number;
};
type RewardsConfig = {
  grid: Record<ClassKey, SegmentRates>;
  actions: Record<ActionKey, Record<ClassKey, SegmentRates>>;
  cap: number;
};

const RATE_STEP = 5;
const RATE_FLOOR = 10;
const RATE_MAX = 50;
const CAP_MIN = 0;
const CAP_MAX = 5000;
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
const DEFAULTS: RewardsConfig = {
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

// Snap to the 5% grid: ≤0 → 0, else clamp to [10,50] rounded to the nearest 5.
function snapRate(v: unknown, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  if (v <= 0) return 0;
  const stepped = Math.round(v / RATE_STEP) * RATE_STEP;
  return Math.max(RATE_FLOOR, Math.min(RATE_MAX, stepped));
}

function clampCap(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return CAP_DEFAULT;
  return Math.max(CAP_MIN, Math.min(CAP_MAX, Math.round(v)));
}

function snapRow(row: unknown, d: SegmentRates): SegmentRates {
  const r =
    row && typeof row === "object" && !Array.isArray(row)
      ? (row as Record<string, unknown>)
      : {};
  return {
    zero: 0, // off by definition
    conservative: snapRate(r.conservative, d.conservative),
    aggressive: snapRate(r.aggressive, d.aggressive),
    dominant: snapRate(r.dominant, d.dominant),
  };
}

export function normalizeConfig(
  raw: unknown,
): { ok: true; value: RewardsConfig } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "config must be an object" };
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
    grid[cls] = snapRow(rawGrid[cls], DEFAULTS.grid[cls]);
  }

  const actions = {} as Record<ActionKey, Record<ClassKey, SegmentRates>>;
  for (const action of ACTION_KEYS) {
    const rawAction =
      rawActions[action] &&
      typeof rawActions[action] === "object" &&
      !Array.isArray(rawActions[action])
        ? (rawActions[action] as Record<string, unknown>)
        : null;
    // v12 fallback: the action's flat row lived inside `grid` (never for
    // mesita_review, which v12 didn't price).
    const legacyFlat = action === "mesita_review" ? null : rawGrid[action];
    const perClass = {} as Record<ClassKey, SegmentRates>;
    for (const cls of CLASS_KEYS) {
      perClass[cls] = snapRow(
        rawAction?.[cls] ?? legacyFlat,
        DEFAULTS.actions[action][cls],
      );
    }
    actions[action] = perClass;
  }

  return { ok: true, value: { grid, actions, cap: clampCap(c.cap) } };
}
