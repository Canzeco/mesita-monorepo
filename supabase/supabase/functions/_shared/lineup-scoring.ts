// Lineup v12 — pure scoring math for Deno Edge Functions.
// Mirrors apps/web-admin/src/lib/business/scores.ts (MESITA-714/717/718).
// Keep in lockstep when the console model changes.

export type SubscoreId = "em" | "sm" | "gp" | "rp" | "xx" | "mp";
export type LaneId = "organic" | "inorganic";

export type Lane = {
  id: LaneId;
  parts: readonly SubscoreId[];
};

// MP (Manual Priority) multiplies EVERY lane — the operator's per-place
// override, trailing each formula (MESITA / Pato 2026-07-22).
export const LANES: readonly Lane[] = [
  { id: "organic", parts: ["em", "sm", "gp", "mp", "xx"] },
  { id: "inorganic", parts: ["em", "sm", "rp", "mp", "xx"] },
];

/** MP baseline for an untouched place (mirrors the DB column default). */
export const DEFAULT_MANUAL_PRIORITY = 0.1;

export const MERGE_ROTATION: readonly LaneId[] = ["organic", "inorganic"];

const clamp01 = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

export function laneScore(lane: Lane, subs: Record<SubscoreId, number>): number {
  let s = 1;
  for (const p of lane.parts) s *= clamp01(subs[p]);
  return s;
}

export function emScore(cos: number): number {
  return clamp01(Math.max(0, cos));
}

// ── SM ─────────────────────────────────────────────────────────────────

const DIST_EXP = 3;
const ZONE_SPILL_FRAC = 0.3;
const DEFAULT_POINT_TOL_KM = 5;
export const TIME_BLOCK_H = 0.5;
export const OPENNESS_DAYS = 7;
export const OPENNESS_SLOTS = 2 * 24 * 7; // 336

export type SmParams = {
  where: { defaultTolKm: number };
  when: { patience: number };
  what: { tol: number };
};

export const DEFAULT_SM_PARAMS: SmParams = {
  where: { defaultTolKm: DEFAULT_POINT_TOL_KM },
  when: { patience: 0.35 },
  what: { tol: 0.5 },
};

function whereScore(km: number | null, tolKm: number): number {
  if (km == null) return 1;
  const tol = Math.max(0.5, tolKm);
  if (km <= 0) return 1;
  return 1 / (1 + Math.pow(km / tol, DIST_EXP));
}

export function whenFromOpenness(bits: readonly boolean[], patience: number): number {
  const p = clamp01(patience);
  let opensIn: number | null = null;
  for (let i = 0; i < bits.length; i++) {
    if (bits[i]) {
      opensIn = i;
      break;
    }
  }
  if (opensIn == null) return 0;
  let run = 0;
  for (let i = opensIn; i < bits.length && bits[i]; i++) run++;
  const waitTol = p * 48;
  const needRun = 1 + (1 - p) * 5;
  const wait = opensIn === 0
    ? 1
    : waitTol <= 0
    ? 0
    : 1 / (1 + Math.pow(opensIn / waitTol, 4));
  const fit = Math.min(1, run / needRun);
  return clamp01(wait * fit);
}

export type WhatRelation = "exact" | "sibling" | "mismatch" | "none";

function whatScore(rel: WhatRelation, tol: number): number {
  const t = clamp01(tol);
  switch (rel) {
    case "exact":
      return 1;
    case "sibling":
      return t;
    case "mismatch":
      return t * t;
    case "none":
      return 1;
  }
}

export function smScore(opts: {
  km: number | null;
  tolKm: number | null;
  zoneMode: boolean;
  openness: readonly boolean[] | null;
  hoursUnknown: boolean;
  whatRel: WhatRelation;
  sm: SmParams;
}): number {
  const baseTol = opts.tolKm ?? opts.sm.where.defaultTolKm;
  const tolKm = opts.zoneMode ? baseTol * ZONE_SPILL_FRAC : baseTol;
  const where = whereScore(opts.km, tolKm);
  const when = opts.hoursUnknown || !opts.openness
    ? 1
    : whenFromOpenness(opts.openness, opts.sm.when.patience);
  const what = whatScore(opts.whatRel, opts.sm.what.tol);
  return where * when * what;
}

// ── GP / RP / XX ───────────────────────────────────────────────────────

export type GpParams = { lnCeiling: number; ratingPow: number };
export const DEFAULT_GP_PARAMS: GpParams = { lnCeiling: 10, ratingPow: 1 };

export function gpScore(
  reviews: number | null | undefined,
  rating: number | null | undefined,
  p: GpParams = DEFAULT_GP_PARAMS,
): number {
  const n = Math.max(
    0,
    Math.round(typeof reviews === "number" && Number.isFinite(reviews) ? reviews : 0),
  );
  const r = typeof rating === "number" && Number.isFinite(rating) ? rating : null;
  const pow = Math.min(2, Math.max(1, p.ratingPow));
  const raw = r == null ? 0 : Math.pow(Math.max(0, r), pow) * n;
  return clamp01(Math.log(1 + raw) / Math.max(1, p.lnCeiling));
}

export type RpStrategy = "zero" | "conservative" | "aggressive";
export type RpRungs = Record<RpStrategy, number>;
export const DEFAULT_RP_RUNGS: RpRungs = {
  zero: 0, // literal 0 — the paid lane is strictly pay-to-play (no whisper)
  conservative: 0.5,
  aggressive: 1.0, // peak — Dominant retired 2026-08-09
};

export function rpScore(strategy: RpStrategy | null, rungs: RpRungs = DEFAULT_RP_RUNGS): number {
  return clamp01(rungs[strategy ?? "zero"]);
}

// XX is a TABLE, not a dial (Pato 2026-08-09). The consumer's Randomness
// filter is a word ladder (low · medium · high · extra · max — the consumer
// apps' `RANDOMNESS_LABELS`, level index 0–4); this config says what each word
// MEANS: one integer control 0–5 per rung. A request with no level = the
// consumer never touched the filter = the `low` rung, which is exactly what
// the old flat `xx.control` was.
export const RANDOMNESS_LEVELS = ["low", "medium", "high", "extra", "max"] as const;
export type RandomnessLevelKey = (typeof RANDOMNESS_LEVELS)[number];
export const XX_CONTROL_MIN = 0;
export const XX_CONTROL_MAX = 5;

export type XxParams = { levels: Record<RandomnessLevelKey, number> };
export const DEFAULT_XX_PARAMS: XxParams = {
  levels: { low: 0, medium: 1, high: 2, extra: 3, max: 5 },
};

/** The control for a 0–4 level index; out of range / absent → the `low` rung. */
export function xxControlForLevel(p: XxParams, level?: number | null): number {
  const i = typeof level === "number" && Number.isFinite(level)
    ? Math.min(RANDOMNESS_LEVELS.length - 1, Math.max(0, Math.round(level)))
    : 0;
  const key = RANDOMNESS_LEVELS[i];
  const v = p.levels?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : DEFAULT_XX_PARAMS.levels[key];
}

/** Read a request's Randomness rung (0–4); anything else → null (= `low`). */
export function parseRandomnessLevel(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.min(RANDOMNESS_LEVELS.length - 1, Math.max(0, Math.round(v)));
}

export function xxScore(u: number, control: number): number {
  const c = Math.max(XX_CONTROL_MIN, Math.min(XX_CONTROL_MAX, control));
  return clamp01(Math.pow(clamp01(u), c));
}

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Deterministic U ~ Uniform[0,1) per (seed, place, lane). */
export function unitDraw(seed: string, placeId: string, laneId: LaneId): number {
  return hash32(`${seed}·${placeId}·${laneId}`) / 4294967296;
}

// ── Merge ──────────────────────────────────────────────────────────────

export type LaneCounts = Record<LaneId, number>;
export const DEFAULT_LANE_COUNTS: LaneCounts = { organic: 8, inorganic: 8 };
export const LANE_N_MAX = 50;

export function laneCountsTotal(counts: LaneCounts): number {
  return counts.organic + counts.inorganic;
}

export type DeckCandidate = { id: string; scores: Record<LaneId, number> };
export type DeckSlot = { id: string; laneId: LaneId; score: number };

export function composeFinalDeck(
  candidates: readonly DeckCandidate[],
  counts: LaneCounts,
): { slots: DeckSlot[] } {
  const n = {} as Record<LaneId, number>;
  for (const lane of LANES) {
    n[lane.id] = Math.max(0, Math.min(LANE_N_MAX, Math.round(counts[lane.id] ?? 0)));
  }
  const lanes = {} as Record<LaneId, DeckSlot[]>;
  for (const lane of LANES) {
    const ranked = candidates
      .filter((c) => (c.scores[lane.id] ?? 0) > 0)
      .slice()
      .sort((a, b) => b.scores[lane.id] - a.scores[lane.id] || (a.id < b.id ? -1 : 1));
    lanes[lane.id] = ranked
      .slice(0, n[lane.id])
      .map((c) => ({ id: c.id, laneId: lane.id, score: c.scores[lane.id] }));
  }

  const cursor: Record<LaneId, number> = { organic: 0, inorganic: 0 };
  const seen = new Set<string>();
  const slots: DeckSlot[] = [];
  let progress = true;
  while (progress) {
    progress = false;
    for (const laneId of MERGE_ROTATION) {
      const lane = lanes[laneId];
      while (cursor[laneId] < lane.length) {
        progress = true;
        const slot = lane[cursor[laneId]++];
        if (seen.has(slot.id)) continue;
        seen.add(slot.id);
        slots.push(slot);
        break;
      }
    }
  }
  return { slots };
}

// ── Blob coerce ────────────────────────────────────────────────────────

export type ScoringSettings = {
  v: 12;
  laneN: LaneCounts;
  sm: SmParams;
  gp: GpParams;
  rp: RpRungs;
  xx: XxParams;
};

export const DEFAULT_SCORING_SETTINGS: ScoringSettings = {
  v: 12,
  laneN: DEFAULT_LANE_COUNTS,
  sm: DEFAULT_SM_PARAMS,
  gp: DEFAULT_GP_PARAMS,
  rp: DEFAULT_RP_RUNGS,
  xx: DEFAULT_XX_PARAMS,
};

function num(v: unknown, fallback: number, lo: number, hi: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
}

function coerceLaneCounts(v: unknown, fallback: LaneCounts): LaneCounts {
  if (typeof v === "number" && Number.isFinite(v)) {
    const n = Math.round(Math.min(LANE_N_MAX, Math.max(0, v)));
    return { organic: n, inorganic: n };
  }
  const raw = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const counts: LaneCounts = {
    organic: Math.round(num(raw.organic, fallback.organic, 0, LANE_N_MAX)),
    inorganic: Math.round(num(raw.inorganic, fallback.inorganic, 0, LANE_N_MAX)),
  };
  const sum = counts.organic + counts.inorganic;
  return sum < 1 ? { ...fallback } : counts;
}

/** Coerce a raw jsonb blob (or null) into valid ScoringSettings. */
export function coerceScoringSettings(raw: unknown): ScoringSettings {
  const d = DEFAULT_SCORING_SETTINGS;
  if (!raw || typeof raw !== "object") return d;
  const r = raw as Record<string, unknown>;
  const sm = (r.sm ?? {}) as Record<string, unknown>;
  const smWhere = (sm.where ?? {}) as Record<string, unknown>;
  const smWhen = (sm.when ?? {}) as Record<string, unknown>;
  const smWhat = (sm.what ?? {}) as Record<string, unknown>;
  const gp = (r.gp ?? {}) as Record<string, unknown>;
  const rp = (r.rp ?? {}) as Record<string, unknown>;
  const xx = (r.xx ?? {}) as Record<string, unknown>;

  return {
    v: 12,
    laneN: coerceLaneCounts(r.laneN, d.laneN),
    sm: {
      where: {
        defaultTolKm: num(smWhere.defaultTolKm, d.sm.where.defaultTolKm, 0.5, 20),
      },
      when: {
        patience: num(smWhen.patience ?? smWhen.waitFloor, d.sm.when.patience, 0, 1),
      },
      what: {
        tol: num(smWhat.tol ?? smWhat.sibling, d.sm.what.tol, 0, 1),
      },
    },
    gp: {
      lnCeiling: num(gp.lnCeiling, d.gp.lnCeiling, 5, 15),
      ratingPow: num(gp.ratingPow, d.gp.ratingPow, 1, 2),
    },
    rp: {
      zero: num(rp.zero, d.rp.zero, 0, 1),
      conservative: num(rp.conservative, d.rp.conservative, 0, 1),
      aggressive: num(rp.aggressive, d.rp.aggressive, 0, 1),
    },
    xx: { levels: coerceXxLevels(xx, d.xx) },
  };
}

/**
 * The XX word→control table. Integers only, 0–5. A pre-table blob carried ONE
 * flat `xx.control` (the no-filter default) — it becomes the `low` rung, since
 * that is the rung an untouched filter selects; the other rungs seed from code
 * defaults.
 */
function coerceXxLevels(
  raw: Record<string, unknown>,
  fallback: XxParams,
): Record<RandomnessLevelKey, number> {
  const levels = (raw.levels ?? {}) as Record<string, unknown>;
  const legacy = raw.control;
  const out = {} as Record<RandomnessLevelKey, number>;
  for (const key of RANDOMNESS_LEVELS) {
    const v = levels[key] ?? (key === "low" ? legacy : undefined);
    out[key] = Math.round(
      num(v, fallback.levels[key], XX_CONTROL_MIN, XX_CONTROL_MAX),
    );
  }
  return out;
}
