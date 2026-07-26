// Rewards Config catalog — the six-segment reward grid (Promos v5, MESITA-723).
//
// This page lifts the canonical v5 rate table out of code (business/admin
// strategies.ts hardcode it) and onto the public.app_settings singleton, so an
// operator can tune, for each posture (Zero / Conservative / Aggressive), what
// each of the six segments pays. It is the source of truth the v5 bill engine
// will read once it lands; today it persists ahead of enforcement, exactly like
// the Sourcing / Reservations knobs did before their pipelines read them.
//
// Grid rule (locked by Pato 2026-07-22): 5% steps, floor 10%, ceiling 50%
// (allowed {0, 10, 15, … 50}; 0 = off). Zero posture is off by definition — its
// column is always 0. Universal cap: every discount applies to the first `cap`
// MXN of the bill (monthly_promo_cap).
//
// Keys are the contract shared with admin-web-{get,update}-rewards-config and
// (eventually) the v5 best-of resolution in _shared/membership.ts — keep them
// in lock-step with apps/web-consumer/src/lib/reward-segments.ts.

export type RewardPosture = "zero" | "conservative" | "aggressive";

export type RewardSegmentKey =
  | "standard"
  | "magnetic"
  | "premium"
  | "story"
  | "welcome"
  | "review";

export type SegmentRates = Record<RewardPosture, number>;

// What a qualifying Instagram Story must carry to earn the Story discount.
// Three independent toggles (staff still verify the post) — persisted ahead of
// enforcement, like the rest of this blob.
export type StorySegmentTags = {
  /** The story tags Mesita's own handle (@mesita). */
  mesita: boolean;
  /** The story tags the venue's own handle. */
  venue: boolean;
  /** The story carries the venue's location (geotag / location sticker). */
  geo: boolean;
};

// Segment-qualification rules — the two Instagram follower bars and the Story
// requirements. INVARIANT: magneticFollowers ≥ storyFollowers (a guest with
// Magnetic reach already sits on a higher rung than the Story action), enforced
// live in the editor and again in coerceSegments / the save normalizer.
export type SegmentsConfig = {
  /** Instagram followers at/above which a guest is auto-assigned the Magnetic class (the higher bar). */
  magneticFollowers: number;
  /** Minimum Instagram followers to earn the Instagram-Story discount (the lower bar). */
  storyFollowers: number;
  /** What a qualifying Instagram Story must tag. */
  storyTags: StorySegmentTags;
};

export type RewardsConfig = {
  /** Per-segment rate under each posture. 0 = off. */
  grid: Record<RewardSegmentKey, SegmentRates>;
  /** Universal cap (MXN): the discount applies to the first `cap` of the bill. */
  cap: number;
  /** Follower bars + Story requirements that gate the Instagram-driven rungs. */
  segments: SegmentsConfig;
};

// Ontology of a rung: class (who the guest is), action (a rewarded thing they
// do at the table), visit (a state of the visit). Drives the row grouping.
export type RewardSegmentKind = "class" | "action" | "visit";

export type SegmentMeta = {
  key: RewardSegmentKey;
  /** Pato's worst→best ladder rank (1 Standard … 6 Google Review). */
  rank: number;
  name: string;
  nameEs: string;
  kind: RewardSegmentKind;
  emoji: string;
  blurb: string;
};

// Rows, in ladder order (worst→best). Amounts tie within {Magnetic, Premium}
// and {Story, Welcome} — best-of at the bill makes ties harmless.
export const SEGMENTS: readonly SegmentMeta[] = [
  {
    key: "standard",
    rank: 1,
    name: "Standard Customer",
    nameEs: "Estándar",
    kind: "class",
    emoji: "🙂",
    blurb: "Base class — the floor every guest inherits.",
  },
  {
    key: "premium",
    rank: 2,
    name: "Premium Customer",
    nameEs: "Premium",
    kind: "class",
    emoji: "👑",
    blurb: "Paid class — MX$100/mo, the consumer revenue lever.",
  },
  {
    key: "magnetic",
    rank: 3,
    name: "Magnetic Customer",
    nameEs: "Magnético",
    kind: "class",
    emoji: "🧲",
    blurb: "Invite-only class for guests with real Instagram reach.",
  },
  {
    key: "story",
    rank: 4,
    name: "Instagram Story Bonus",
    nameEs: "Historia de Instagram",
    kind: "action",
    emoji: "📸",
    blurb: "Repeatable action — a story tagging the place, staff-verified.",
  },
  {
    key: "welcome",
    rank: 5,
    name: "Welcome Visit Bonus",
    nameEs: "Visita de Bienvenida",
    kind: "visit",
    emoji: "🚪",
    blurb: "First ticket at the venue, any class — once per place.",
  },
  {
    key: "review",
    rank: 6,
    name: "Google Review Bonus",
    nameEs: "Reseña de Google",
    kind: "action",
    emoji: "⭐",
    blurb: "One-shot action — a Google review at the table, claimable once.",
  },
];

export const POSTURES: readonly {
  key: RewardPosture;
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
];

// The 5% grid: off, then 10 → 50 in steps of 5.
export const RATE_STEP = 5;
export const RATE_FLOOR = 10;
export const RATE_MAX = 50;
export const ALLOWED_RATES: readonly number[] = [
  0, 10, 15, 20, 25, 30, 35, 40, 45, 50,
];

export const CAP_MIN = 0;
export const CAP_MAX = 5000;
export const CAP_DEFAULT = 500;

// Instagram follower bars — whole non-negative counts, generously bounded.
export const FOLLOWERS_MIN = 0;
export const FOLLOWERS_MAX = 100_000_000;
export const MAGNETIC_FOLLOWERS_DEFAULT = 10_000;
export const STORY_FOLLOWERS_DEFAULT = 1_000;
export const STORY_TAGS_DEFAULT: StorySegmentTags = {
  mesita: true,
  venue: true,
  geo: false,
};

// The locked v5 defaults (MESITA-723). Zero column is all 0 by definition.
export const DEFAULT_CONFIG: RewardsConfig = {
  cap: CAP_DEFAULT,
  grid: {
    standard: { zero: 0, conservative: 10, aggressive: 10 },
    premium: { zero: 0, conservative: 15, aggressive: 20 },
    magnetic: { zero: 0, conservative: 15, aggressive: 25 },
    story: { zero: 0, conservative: 20, aggressive: 30 },
    welcome: { zero: 0, conservative: 20, aggressive: 30 },
    review: { zero: 0, conservative: 30, aggressive: 50 },
  },
  segments: {
    magneticFollowers: MAGNETIC_FOLLOWERS_DEFAULT,
    storyFollowers: STORY_FOLLOWERS_DEFAULT,
    storyTags: { ...STORY_TAGS_DEFAULT },
  },
};

/**
 * Snap a rate to the 5% grid: a non-number resolves to `fallback`, a number ≤0 →
 * 0 (Off), else clamp to [10,50] rounded to 5. Signature/behavior mirror snapRate
 * in the update EF's rewards-config-normalize.ts, so coerce (display) and
 * normalize (save gate) treat a present-but-invalid cell identically.
 */
export function snapRate(v: unknown, fallback = 0): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  if (v <= 0) return 0;
  const stepped = Math.round(v / RATE_STEP) * RATE_STEP;
  return Math.max(RATE_FLOOR, Math.min(RATE_MAX, stepped));
}

function clampCap(v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : CAP_DEFAULT;
  return Math.max(CAP_MIN, Math.min(CAP_MAX, n));
}

function clampFollowers(v: unknown, fallback: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.max(FOLLOWERS_MIN, Math.min(FOLLOWERS_MAX, n));
}

/**
 * Coerce the segment-qualification block. Missing/invalid → v5 defaults; the
 * Story bar is clamped to never exceed the auto-Magnetic bar (the load-bearing
 * invariant). Mirrors normalizeSegments in the update EF.
 */
export function coerceSegments(raw: unknown): SegmentsConfig {
  const s =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const magneticFollowers = clampFollowers(
    s.magneticFollowers,
    MAGNETIC_FOLLOWERS_DEFAULT,
  );
  const storyFollowers = Math.min(
    clampFollowers(s.storyFollowers, STORY_FOLLOWERS_DEFAULT),
    magneticFollowers,
  );
  const tags =
    s.storyTags && typeof s.storyTags === "object" && !Array.isArray(s.storyTags)
      ? (s.storyTags as Record<string, unknown>)
      : {};
  return {
    magneticFollowers,
    storyFollowers,
    storyTags: {
      mesita: typeof tags.mesita === "boolean" ? tags.mesita : STORY_TAGS_DEFAULT.mesita,
      venue: typeof tags.venue === "boolean" ? tags.venue : STORY_TAGS_DEFAULT.venue,
      geo: typeof tags.geo === "boolean" ? tags.geo : STORY_TAGS_DEFAULT.geo,
    },
  };
}

/**
 * Coerce whatever the row holds into a renderable grid. Anything malformed
 * resolves to the v5 default — the page must always be usable. Zero posture is
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
          ? snapRate(row.conservative, fallback.conservative)
          : fallback.conservative,
      aggressive:
        seg.key in rawGrid && "aggressive" in row
          ? snapRate(row.aggressive, fallback.aggressive)
          : fallback.aggressive,
    };
  }

  return {
    grid,
    cap: "cap" in c ? clampCap(c.cap) : CAP_DEFAULT,
    segments: coerceSegments(c.segments),
  };
}
