// Promos v6 — the seven-segment reward ladder (MESITA-723, segments v6,
// locked by Pato 2026-08-01). Verbatim port of
// apps/web-consumer/src/lib/reward-segments.ts — same locked grid, same helpers.
// When the web file changes, update this in the same PR (the two are the
// consumer program-education model, mobile ↔ web parity).
//
// PRESENTATION model: the canonical ladder + its rate grid, for the Rewards
// program summary + the "max % for you" banner. Program education, not a
// per-transaction promise — the numbers below are the locked defaults; the
// admin "Rewards" config page persists the editable copy the bill engine
// reads. Static locked defaults so no new consumer Edge Function is needed.
//
// Segments v6: four classes (Standard / Premium / Influencer / Aura) + three
// actions. Story is a universal action gated on connected Instagram
// (MESITA-909); Review and
// Welcome are universal.

// The class rung a consumer sits on. Mirrors the web ConsumerClass
// ("standard" | "premium" | "influencer" | "aura").
export type RewardClassKey = 'standard' | 'premium' | 'influencer' | 'aura';

// The business discount strategy that sets how generous a place's grid is:
// Zero / Conservative / Aggressive (aggressive = peak).
type GridStrategy = 'zero' | 'conservative' | 'aggressive';

// Ontology of a rung (per the canonical definitions):
//   class  — who the guest is (Standard / Premium / Influencer / Aura)
//   action — a rewarded thing the guest does at the table (Story / Google Review)
//   visit  — a state of the visit itself (Welcome = first ticket at the venue)
type RewardSegmentKind = 'class' | 'action' | 'visit';

export type RewardSegmentKey =
  | 'standard'
  | 'premium'
  | 'influencer'
  | 'aura'
  | 'story'
  | 'welcome'
  | 'review';

export type RewardSegment = {
  /** Pato's worst→best ladder rank (1 Standard … 7 Google Review). */
  rank: number;
  key: RewardSegmentKey;
  name: string;
  nameEs: string;
  kind: RewardSegmentKind;
  blurb: string;
  /** The locked v6 grid, 5% steps, floor 10, 0 = off. Peak = aggressive. */
  rates: Record<GridStrategy, number>;
};

// The canonical ladder, stored worst→best (rank order — the class ladder is
// standard < influencer < premium < aura, per classes.rank and the CLASS_STEP
// money (+5 influencer / +10 premium / +15 aura); the class BASE rows tie on rates
// today, as do {Story, Welcome} — best-of makes ties harmless).
export const REWARD_SEGMENTS: readonly RewardSegment[] = [
  {
    rank: 1,
    key: 'standard',
    name: 'Standard',
    nameEs: 'Estándar',
    kind: 'class',
    blurb: 'The base rate every guest gets, always.',
    rates: { zero: 0, conservative: 5, aggressive: 15 },
  },
  {
    rank: 3,
    key: 'premium',
    name: 'Premium',
    nameEs: 'Premium',
    kind: 'class',
    blurb: 'Mesita Premium — a bigger base at every place.',
    rates: { zero: 0, conservative: 5, aggressive: 15 },
  },
  {
    rank: 2,
    key: 'influencer',
    name: 'Influencer',
    nameEs: 'Influencer',
    kind: 'class',
    blurb: '2,000+ Instagram followers — automatic class upgrade.',
    rates: { zero: 0, conservative: 5, aggressive: 15 },
  },
  {
    rank: 4,
    key: 'aura',
    name: 'Aura',
    nameEs: 'Aura',
    kind: 'class',
    blurb: 'Invite-only — the highest base, just for showing up.',
    rates: { zero: 0, conservative: 5, aggressive: 15 },
  },
  {
    rank: 5,
    key: 'story',
    name: 'Instagram Story',
    nameEs: 'Historia de Instagram',
    kind: 'action',
    blurb: 'Connect Instagram, post a tagged story — any class, any visit.',
    rates: { zero: 0, conservative: 15, aggressive: 25 },
  },
  {
    rank: 7,
    key: 'welcome',
    name: 'Welcome Visit',
    nameEs: 'Visita de Bienvenida',
    kind: 'visit',
    blurb: 'Your first ever visit to a place.',
    rates: { zero: 0, conservative: 25, aggressive: 35 },
  },
  {
    rank: 6,
    key: 'review',
    name: 'Google Review',
    nameEs: 'Reseña de Google',
    kind: 'action',
    blurb: 'Leave a Google review at the table — once per place.',
    rates: { zero: 0, conservative: 20, aggressive: 30 },
  },
];

export const REWARD_SEGMENT_BY_KEY = Object.fromEntries(
  REWARD_SEGMENTS.map((s) => [s.key, s]),
) as Record<RewardSegmentKey, RewardSegment>;

// The peak column — what "up to" quotes. Aggressive is the most generous strategy.
export const PEAK_STRATEGY: GridStrategy = 'aggressive';

// Which class rung a consumer sits on. Consumer classes map one-to-one onto
// their same-named ladder rungs.
export function segmentKeyForClass(classKey: RewardClassKey): RewardSegmentKey {
  return classKey;
}

// The rungs a given consumer can actually reach: their own class rung plus
// the universal actions (Welcome, Google review, Instagram Story —
// MESITA-909). Story's Instagram-connected gate is enforced at create /
// submit, not here — this set drives "up to" quotes. Returned worst→best.
function reachableSegments(classKey: RewardClassKey): RewardSegment[] {
  const mine = segmentKeyForClass(classKey);
  const universal: RewardSegmentKey[] = ['welcome', 'review', 'story'];
  return REWARD_SEGMENTS.filter(
    (s) => s.key === mine || universal.includes(s.key),
  );
}

/** Your class rung's peak rate — the "just for being you" number. */
// ── The class step (v9, MESITA-877) ─────────────────────────────────────
//
// Every rate above is stored on the STANDARD row. A guest's real rate adds
// their class step, exactly as the bill engine computes it:
//
//   rate = 5 + type step + CLASS STEP + strategy step
//
// Keeping the step here rather than baking four copies of every rung into
// the table is what lets this file stay a flat ladder while still matching
// the engine cell for cell.
const CLASS_STEP: Record<RewardClassKey, number> = {
  standard: 0,
  influencer: 5,
  premium: 10,
  aura: 15,
};

/** One rung's rate for a specific guest — the number they'd actually be paid. */
function rateForSegment(
  key: RewardSegmentKey,
  classKey: RewardClassKey,
  strategy: GridStrategy = PEAK_STRATEGY,
): number {
  const base = REWARD_SEGMENT_BY_KEY[key].rates[strategy];
  return base <= 0 ? 0 : base + CLASS_STEP[classKey];
}

/** The ceiling a consumer can reach across every rung they can unlock. */
export function peakRateForClass(
  classKey: RewardClassKey,
  strategy: GridStrategy = PEAK_STRATEGY,
): number {
  return reachableSegments(classKey).reduce(
    (max, seg) => Math.max(max, rateForSegment(seg.key, classKey, strategy)),
    0,
  );
}
