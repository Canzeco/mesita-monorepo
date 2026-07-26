// Normalize the Rewards Config blob (Promos v5, MESITA-723) — the strict gate on
// save. Mirrors coerceConfig in the admin catalog. Self-contained (no _shared
// import) so the contract lives beside the writer.
//
// Grid rule: 5% steps, floor 10%, ceiling 50% (0 = off). Zero posture is off by
// definition. Every cell is snapped to the grid and every segment is present, so
// a partial or slightly-off body can never write a malformed row; the only hard
// error is a non-object body.

const SEGMENT_KEYS = [
  "standard",
  "premium",
  "magnetic",
  "story",
  "welcome",
  "review",
] as const;
type SegmentKey = (typeof SEGMENT_KEYS)[number];

type SegmentRates = { zero: number; conservative: number; aggressive: number };
type StorySegmentTags = { mesita: boolean; venue: boolean; geo: boolean };
type SegmentsConfig = {
  magneticFollowers: number;
  storyFollowers: number;
  storyTags: StorySegmentTags;
};
type RewardsConfig = {
  grid: Record<SegmentKey, SegmentRates>;
  cap: number;
  segments: SegmentsConfig;
};

const RATE_STEP = 5;
const RATE_FLOOR = 10;
const RATE_MAX = 50;
const CAP_MIN = 0;
const CAP_MAX = 5000;
const CAP_DEFAULT = 500;

// Instagram follower bars — whole non-negative counts, generously bounded.
const FOLLOWERS_MIN = 0;
const FOLLOWERS_MAX = 100_000_000;
const MAGNETIC_FOLLOWERS_DEFAULT = 10_000;
const STORY_FOLLOWERS_DEFAULT = 1_000;
const STORY_TAGS_DEFAULT: StorySegmentTags = {
  mesita: true,
  venue: true,
  geo: false,
};

// The locked v5 defaults — the fallback for any absent/invalid cell.
const DEFAULTS: Record<SegmentKey, SegmentRates> = {
  standard: { zero: 0, conservative: 10, aggressive: 10 },
  magnetic: { zero: 0, conservative: 15, aggressive: 25 },
  premium: { zero: 0, conservative: 15, aggressive: 20 },
  story: { zero: 0, conservative: 20, aggressive: 30 },
  welcome: { zero: 0, conservative: 20, aggressive: 30 },
  review: { zero: 0, conservative: 30, aggressive: 50 },
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

function clampFollowers(v: unknown, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.max(FOLLOWERS_MIN, Math.min(FOLLOWERS_MAX, Math.round(v)));
}

// Segment-qualification block. Missing/invalid → v5 defaults; the Story bar is
// clamped to never exceed the auto-Magnetic bar (the load-bearing invariant).
// Mirrors coerceSegments in the admin catalog.
function normalizeSegments(raw: unknown): SegmentsConfig {
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

  const grid = {} as Record<SegmentKey, SegmentRates>;
  for (const key of SEGMENT_KEYS) {
    const row =
      rawGrid[key] && typeof rawGrid[key] === "object" && !Array.isArray(rawGrid[key])
        ? (rawGrid[key] as Record<string, unknown>)
        : {};
    const d = DEFAULTS[key];
    grid[key] = {
      zero: 0, // off by definition
      conservative: snapRate(row.conservative, d.conservative),
      aggressive: snapRate(row.aggressive, d.aggressive),
    };
  }

  return {
    ok: true,
    value: { grid, cap: clampCap(c.cap), segments: normalizeSegments(c.segments) },
  };
}
