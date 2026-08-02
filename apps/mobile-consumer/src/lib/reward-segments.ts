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
// actions. Story is the Influencer class's EXCLUSIVE action; Review and
// Welcome are universal.

// The class rung a consumer sits on. Mirrors the web ConsumerClass
// ("standard" | "premium" | "influencer" | "aura").
export type RewardClassKey = 'standard' | 'premium' | 'influencer' | 'aura';

// The business discount strategy that sets how generous a place's grid is.
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
// standard < premium ≤ influencer < aura; {Premium, Influencer} tie on rates
// today, as do {Story, Welcome} — best-of makes ties harmless).
export const REWARD_SEGMENTS: readonly RewardSegment[] = [
  {
    rank: 1,
    key: 'standard',
    name: 'Standard',
    nameEs: 'Estándar',
    kind: 'class',
    blurb: 'The base rate every guest gets, always.',
    rates: { zero: 0, conservative: 10, aggressive: 10 },
  },
  {
    rank: 2,
    key: 'premium',
    name: 'Premium',
    nameEs: 'Premium',
    kind: 'class',
    blurb: 'Mesita Premium — a bigger base at every place.',
    rates: { zero: 0, conservative: 15, aggressive: 20 },
  },
  {
    rank: 3,
    key: 'influencer',
    name: 'Influencer',
    nameEs: 'Influencer',
    kind: 'class',
    blurb: '1,000+ Instagram followers — and the Story bonus is yours.',
    rates: { zero: 0, conservative: 15, aggressive: 20 },
  },
  {
    rank: 4,
    key: 'aura',
    name: 'Aura',
    nameEs: 'Aura',
    kind: 'class',
    blurb: 'Invite-only — the highest base, just for showing up.',
    rates: { zero: 0, conservative: 20, aggressive: 25 },
  },
  {
    rank: 5,
    key: 'story',
    name: 'Instagram Story',
    nameEs: 'Historia de Instagram',
    kind: 'action',
    blurb: 'Influencers only — post a story tagging the place, any visit.',
    rates: { zero: 0, conservative: 20, aggressive: 30 },
  },
  {
    rank: 6,
    key: 'welcome',
    name: 'Welcome Visit',
    nameEs: 'Visita de Bienvenida',
    kind: 'visit',
    blurb: 'Your first ever visit to a place.',
    rates: { zero: 0, conservative: 20, aggressive: 30 },
  },
  {
    rank: 7,
    key: 'review',
    name: 'Google Review',
    nameEs: 'Reseña de Google',
    kind: 'action',
    blurb: 'Leave a Google review at the table — once per place.',
    rates: { zero: 0, conservative: 30, aggressive: 50 },
  },
];

const REWARD_SEGMENT_BY_KEY = Object.fromEntries(
  REWARD_SEGMENTS.map((s) => [s.key, s]),
) as Record<RewardSegmentKey, RewardSegment>;

// The peak column — what "up to" quotes.
export const PEAK_STRATEGY: GridStrategy = 'aggressive';

// Which class rung a consumer sits on. Consumer classes map one-to-one onto
// their same-named ladder rungs.
export function segmentKeyForClass(classKey: RewardClassKey): RewardSegmentKey {
  return classKey;
}

// The rungs a given consumer can actually reach: their own class rung, the two
// universal rungs any class can unlock at the table (a first visit, a Google
// review), and — for Influencers only — the Story action. Returned worst→best.
// Exported because the Rewards pass renders exactly this set: the v6 story
// gate lives here and must never be re-derived in a component.
export function reachableSegments(classKey: RewardClassKey): RewardSegment[] {
  const mine = segmentKeyForClass(classKey);
  const universal: RewardSegmentKey[] = ['welcome', 'review'];
  return REWARD_SEGMENTS.filter(
    (s) =>
      s.key === mine ||
      universal.includes(s.key) ||
      (s.key === 'story' && classKey === 'influencer'),
  );
}

/** Your class rung's peak rate — the "just for being you" number. */
export function baseRateForClass(
  classKey: RewardClassKey,
  strategy: GridStrategy = PEAK_STRATEGY,
): number {
  return REWARD_SEGMENT_BY_KEY[segmentKeyForClass(classKey)].rates[strategy];
}

/** The ceiling a consumer can reach across every rung they can unlock. */
export function peakRateForClass(
  classKey: RewardClassKey,
  strategy: GridStrategy = PEAK_STRATEGY,
): number {
  return reachableSegments(classKey).reduce(
    (max, s) => Math.max(max, s.rates[strategy]),
    0,
  );
}
