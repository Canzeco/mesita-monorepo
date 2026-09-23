// Promos v6 — the seven-segment reward ladder (MESITA-723, segments v6,
// locked by Pato 2026-08-01).
//
// This is the PRESENTATION model: the canonical ladder + its rate grid, used by
// the /rewards program summary and the "max % for you" banner. It is program
// education — the shape of the Mesita reward program — not a per-transaction
// promise. The numbers below are the locked defaults; the admin "Rewards"
// config page persists the editable copy in app_config.promos_config that
// the bill engine reads. The consumer surface intentionally uses these static
// defaults so it needs no new consumer Edge Function.
//
// The Diamond List (MESITA-2044): two identity rows (Base / Diamond List) +
// three actions. Story is a universal action gated on connected Instagram
// (MESITA-909); Review and
// Welcome are universal.

import type { ClassKey } from "@/lib/consumer-data";

// The business discount strategy that sets how generous a place's grid is:
// Zero / Conservative / Aggressive (aggressive = peak).
type GridStrategy = "zero" | "conservative" | "aggressive";

// Ontology of a rung (per the canonical definitions):
//   class  — who the guest is: everyone (Base) or on the Diamond List. The
//            kind stays "class" and the keys stay `bronze`/`diamond` because
//            those are the engine's storage keys; neither is ever printed.
//   action — a rewarded thing the guest does at the table (Story / Google Review)
//   visit  — a state of the visit itself (Welcome = first ticket at the place)
type RewardSegmentKind = "class" | "action" | "visit";

export type RewardSegmentKey =
  | "bronze"
  | "diamond"
  | "story"
  | "welcome"
  | "review";

type RewardSegment = {
  /** Pato's worst→best program order (1 Base … 7 Welcome). */
  rank: number;
  key: RewardSegmentKey;
  /** English chrome (app chrome stays English). */
  name: string;
  /** Spanish gloss — the names translate cleanly. */
  nameEs: string;
  kind: RewardSegmentKind;
  /** One consumer-facing line: how you land on this rung. */
  blurb: string;
  /** The locked v6 grid, 5% steps, floor 10, 0 = off. Peak = aggressive. */
  rates: Record<GridStrategy, number>;
};

// The canonical program, stored worst→best. The two identity rows tie on
// rates; the CLASS_STEP below (+15 for the Diamond List) breaks the tie —
// best-of makes ties harmless. Silver and Gold are gone (MESITA-2044).
export const REWARD_SEGMENTS: readonly RewardSegment[] = [
  {
    rank: 1,
    key: "bronze",
    name: "Base",
    nameEs: "Base",
    kind: "class",
    blurb: "The base rate every guest gets, always.",
    rates: { zero: 0, conservative: 5, aggressive: 15 },
  },
  {
    rank: 4,
    key: "diamond",
    name: "Diamond List",
    nameEs: "Lista Diamante",
    kind: "class",
    blurb: "Invitation only — more on top of the base.",
    rates: { zero: 0, conservative: 5, aggressive: 15 },
  },
  {
    rank: 5,
    key: "story",
    name: "Instagram Story",
    nameEs: "Historia de Instagram",
    kind: "action",
    blurb: "Connect Instagram, post a tagged story — every guest, any visit.",
    rates: { zero: 0, conservative: 15, aggressive: 25 },
  },
  {
    rank: 7,
    key: "welcome",
    name: "Welcome Visit",
    nameEs: "Visita de Bienvenida",
    kind: "visit",
    blurb: "Your first ever visit to a place.",
    rates: { zero: 0, conservative: 25, aggressive: 35 },
  },
  {
    rank: 6,
    key: "review",
    name: "Google Review",
    nameEs: "Reseña de Google",
    kind: "action",
    blurb: "Leave a Google review at the table — once per place.",
    rates: { zero: 0, conservative: 20, aggressive: 30 },
  },
];

export const REWARD_SEGMENT_BY_KEY = Object.fromEntries(
  REWARD_SEGMENTS.map((s) => [s.key, s]),
) as Record<RewardSegmentKey, RewardSegment>;

// The peak column — what "up to" quotes. Aggressive is the most generous
// strategy, so the top of the ladder a place can reach is its aggressive rate.
export const PEAK_STRATEGY: GridStrategy = "aggressive";

// Which identity row a consumer sits on. Storage keys map one-to-one.
function segmentKeyForClass(classKey: ClassKey): RewardSegmentKey {
  return classKey;
}

// The rungs a given consumer can actually reach: their own class rung plus
// the universal actions (Welcome, Google review, Instagram Story —
// MESITA-909). Story's Instagram-connected gate is enforced at create /
// submit, not here — this set drives "up to" quotes. Returned worst→best.
function reachableSegments(classKey: ClassKey): RewardSegment[] {
  const mine = segmentKeyForClass(classKey);
  const universal: RewardSegmentKey[] = ["welcome", "review", "story"];
  return REWARD_SEGMENTS.filter(
    (s) => s.key === mine || universal.includes(s.key),
  );
}

/** Your class rung's peak rate — the "just for being you" number. */
// ── The class step (v9, MESITA-877) ─────────────────────────────────────
//
// Every rate above is stored on the BRONZE row. A guest's real rate adds
// their class step, exactly as the bill engine computes it:
//
//   rate = 5 + type step + CLASS STEP + strategy step
//
// Keeping the step here rather than baking four copies of every rung into
// the table is what lets this file stay a flat ladder while still matching
// the engine cell for cell.
const CLASS_STEP: Record<ClassKey, number> = {
  bronze: 0,
  diamond: 15,
};

/** One rung's rate for a specific guest — the number they'd actually be paid. */
export function rateForSegment(
  key: RewardSegmentKey,
  classKey: ClassKey,
  strategy: GridStrategy = PEAK_STRATEGY,
): number {
  const base = REWARD_SEGMENT_BY_KEY[key].rates[strategy];
  return base <= 0 ? 0 : base + CLASS_STEP[classKey];
}

/**
 * The ceiling a consumer can reach — the best rate across every rung they can
 * unlock, under the most generous strategy. This is the "Max X% for you" number.
 * Universal actions (a Google review) put the top of the ladder within reach of
 * any class, so this is 50% today; the class rung still shows below it.
 */
export function peakRateForClass(
  classKey: ClassKey,
  strategy: GridStrategy = PEAK_STRATEGY,
): number {
  return reachableSegments(classKey).reduce(
    (max, seg) => Math.max(max, rateForSegment(seg.key, classKey, strategy)),
    0,
  );
}
