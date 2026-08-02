// Rewards Config catalog — the seven-segment reward grid (Promos v6, MESITA-723).
//
// This page lifts the canonical rate table out of code and onto the
// public.app_settings singleton, so an operator can tune, for each strategy
// (Zero / Conservative / Aggressive / Dominant), what each of the seven
// segments pays.
// The v6 bill engine (_shared/rewards-config.ts) reads it on every ticket.
//
// Segments v6 (2026-08-01): four classes — Standard, Premium, Influencer
// (Instagram ≥ 1,000 followers, automatic), Aura (invite-only presence class)
// — plus three actions. Story is the Influencer class's exclusive action;
// Review and Welcome are universal. One tier per class for launch; future
// tiers are classes-table INSERTs + a row here.
//
// Grid rule (locked by Pato 2026-07-22): 5% steps, floor 10%, ceiling 50%
// (allowed {0, 10, 15, … 50}; 0 = off). Zero strategy is off by definition — its
// column is always 0. Universal cap: every discount applies to the first `cap`
// MXN of the bill (monthly_promo_cap).
//
// Keys are the contract shared with admin-web-{get,update}-rewards-config and
// the best-of resolution in _shared/rewards-config.ts — keep them in lock-step
// with apps/web-consumer/src/lib/reward-segments.ts.

export type GridStrategy = "zero" | "conservative" | "aggressive" | "dominant";

export type RewardSegmentKey =
  | "standard"
  | "premium"
  | "influencer"
  | "aura"
  | "story"
  | "welcome"
  | "review";

type SegmentRates = Record<GridStrategy, number>;

export type RewardsConfig = {
  /** Per-segment rate under each strategy. 0 = off. */
  grid: Record<RewardSegmentKey, SegmentRates>;
  /** Universal cap (MXN): the discount applies to the first `cap` of the bill. */
  cap: number;
};

// Ontology of a rung: class (who the guest is), action (a rewarded thing they
// do at the table), visit (a state of the visit). Drives the row grouping.
type RewardSegmentKind = "class" | "action" | "visit";

type SegmentMeta = {
  key: RewardSegmentKey;
  /** Pato's worst→best ladder rank (1 Standard … 7 Google Review). */
  rank: number;
  name: string;
  nameEs: string;
  kind: RewardSegmentKind;
  emoji: string;
  blurb: string;
};

// Rows, in ladder order (worst→best). The class ladder is
// standard < premium ≤ influencer < aura; amounts tie within
// {Premium, Influencer} and {Story, Welcome} — best-of at the bill makes
// ties harmless.
export const SEGMENTS: readonly SegmentMeta[] = [
  {
    key: "standard",
    rank: 1,
    name: "Standard",
    nameEs: "Estándar",
    kind: "class",
    emoji: "🙂",
    blurb: "Base class — the floor every guest inherits.",
  },
  {
    key: "premium",
    rank: 2,
    name: "Premium",
    nameEs: "Premium",
    kind: "class",
    emoji: "💳",
    blurb: "Paid class — MX$100/mo, the consumer revenue lever.",
  },
  {
    key: "influencer",
    rank: 3,
    name: "Influencer",
    nameEs: "Influencer",
    kind: "class",
    emoji: "📣",
    blurb: "Reach class — Instagram 1,000+ followers, automatic. Story is theirs.",
  },
  {
    key: "aura",
    rank: 4,
    name: "Aura",
    nameEs: "Aura",
    kind: "class",
    emoji: "✨",
    blurb: "Invite-only presence class — paid for showing up, no posting required.",
  },
  {
    key: "story",
    rank: 5,
    name: "Instagram Story",
    nameEs: "Historia de Instagram",
    kind: "action",
    emoji: "📸",
    blurb: "Influencer-only action — a story tagging the place, staff-verified.",
  },
  {
    key: "welcome",
    rank: 6,
    name: "Welcome Visit",
    nameEs: "Visita de Bienvenida",
    kind: "visit",
    emoji: "🚪",
    blurb: "First ticket at the venue, any class — once per place.",
  },
  {
    key: "review",
    rank: 7,
    name: "Google Review",
    nameEs: "Reseña de Google",
    kind: "action",
    emoji: "⭐",
    blurb: "One-shot action, any class — a Google review at the table, claimable once.",
  },
];

export const STRATEGY_IDS: readonly {
  key: GridStrategy;
  label: string;
  blurb: string;
  /** Zero is off by definition — its column is fixed, not editable. */
  editable: boolean;
}[] = [
  { key: "zero", label: "Zero", blurb: "No discounts — listed only.", editable: false },
  {
    key: "conservative",
    label: "Conservative",
    blurb: "A calm, sustainable discount.",
    editable: true,
  },
  {
    key: "aggressive",
    label: "Aggressive",
    blurb: "Bold headlines to pull a crowd.",
    editable: true,
  },
  {
    key: "dominant",
    label: "Dominant",
    blurb: "Raises the floor — a strong deal for every guest.",
    editable: true,
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

// The locked v6 defaults. Zero column is all 0 by definition; Dominant raises
// the floor over Aggressive, never the ceiling (Review is already at 50).
export const DEFAULT_CONFIG: RewardsConfig = {
  cap: CAP_DEFAULT,
  grid: {
    standard: { zero: 0, conservative: 10, aggressive: 10, dominant: 20 },
    premium: { zero: 0, conservative: 15, aggressive: 20, dominant: 25 },
    influencer: { zero: 0, conservative: 15, aggressive: 20, dominant: 25 },
    aura: { zero: 0, conservative: 20, aggressive: 25, dominant: 30 },
    story: { zero: 0, conservative: 20, aggressive: 30, dominant: 40 },
    welcome: { zero: 0, conservative: 20, aggressive: 30, dominant: 40 },
    review: { zero: 0, conservative: 30, aggressive: 50, dominant: 50 },
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
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : CAP_DEFAULT;
  return Math.max(CAP_MIN, Math.min(CAP_MAX, n));
}

/**
 * Coerce whatever the row holds into a renderable grid. Anything malformed
 * resolves to the v6 default — the page must always be usable. Zero strategy is
 * forced to 0 (off by definition). Mirrors normalizeConfig in the update EF
 * (the strict gate on save).
 */
export function coerceConfig(raw: unknown): RewardsConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return DEFAULT_CONFIG;
  const c = raw as Record<string, unknown>;
  const rawGrid =
    c.grid && typeof c.grid === "object" && !Array.isArray(c.grid)
      ? (c.grid as Record<string, unknown>)
      : {};

  const grid = {} as Record<RewardSegmentKey, SegmentRates>;
  for (const seg of SEGMENTS) {
    const row =
      rawGrid[seg.key] && typeof rawGrid[seg.key] === "object"
        ? (rawGrid[seg.key] as Record<string, unknown>)
        : {};
    const fallback = DEFAULT_CONFIG.grid[seg.key];
    grid[seg.key] = {
      zero: 0, // off by definition
      conservative:
        seg.key in rawGrid && "conservative" in row
          ? snapRate(row.conservative)
          : fallback.conservative,
      aggressive:
        seg.key in rawGrid && "aggressive" in row
          ? snapRate(row.aggressive)
          : fallback.aggressive,
      dominant:
        seg.key in rawGrid && "dominant" in row
          ? snapRate(row.dominant)
          : fallback.dominant,
    };
  }

  return { grid, cap: "cap" in c ? clampCap(c.cap) : CAP_DEFAULT };
}
