// Promos v5 — the six-segment reward ladder (MESITA-723). Verbatim port of
// apps/web-consumer/src/lib/reward-segments.ts — same locked grid, same helpers.
// When the web file changes, update this in the same PR (the two are the
// consumer program-education model, mobile ↔ web parity).
//
// PRESENTATION model: the canonical ladder + its rate grid, for the Rewards
// program summary + the "max % for you" banner. Program education, not a
// per-transaction promise — the live bill still applies the v4 rates until the
// v5 backend lands (tracked under MESITA-723). Static locked defaults so no new
// consumer Edge Function is needed.

// The class rung a consumer sits on. Mirrors the web ConsumerClass
// ("standard" | "premium" | "magnetic").
export type RewardClassKey = 'standard' | 'premium' | 'magnetic';

// The business discount strategy that sets how generous a place's grid is.
type GridStrategy = 'zero' | 'conservative' | 'aggressive';

type RewardSegmentKind = 'class' | 'action' | 'visit';

export type RewardSegmentKey =
  | 'standard'
  | 'magnetic'
  | 'premium'
  | 'story'
  | 'welcome'
  | 'review';

export type RewardSegment = {
  rank: number;
  key: RewardSegmentKey;
  name: string;
  nameEs: string;
  kind: RewardSegmentKind;
  blurb: string;
  rates: Record<GridStrategy, number>;
};

// Canonical ladder, worst→best (rank order). Ties within {Magnetic, Premium}
// and {Story, Welcome} are harmless — best-of pays only the highest.
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
    key: 'magnetic',
    name: 'Magnetic',
    nameEs: 'Magnético',
    kind: 'class',
    blurb: 'Invite-only, for guests with real Instagram reach.',
    rates: { zero: 0, conservative: 15, aggressive: 20 },
  },
  {
    rank: 3,
    key: 'premium',
    name: 'Premium',
    nameEs: 'Premium',
    kind: 'class',
    blurb: 'Mesita Premium — a bigger base at every place.',
    rates: { zero: 0, conservative: 15, aggressive: 20 },
  },
  {
    rank: 4,
    key: 'story',
    name: 'Instagram Story',
    nameEs: 'Historia de Instagram',
    kind: 'action',
    blurb: 'Post a story tagging the place — every visit.',
    rates: { zero: 0, conservative: 20, aggressive: 30 },
  },
  {
    rank: 5,
    key: 'welcome',
    name: 'Welcome Visit',
    nameEs: 'Visita de Bienvenida',
    kind: 'visit',
    blurb: 'Your first ever visit to a place.',
    rates: { zero: 0, conservative: 20, aggressive: 30 },
  },
  {
    rank: 6,
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

export function segmentKeyForClass(classKey: RewardClassKey): RewardSegmentKey {
  return classKey;
}

// The rungs a consumer can reach: their class rung + the three universal rungs
// (a first visit, a story, a Google review). A Standard/Premium guest never
// reaches Magnetic (invite-only); a Magnetic guest reaches it via their rung.
export function reachableSegments(classKey: RewardClassKey): RewardSegment[] {
  const mine = segmentKeyForClass(classKey);
  const universal: RewardSegmentKey[] = ['story', 'welcome', 'review'];
  return REWARD_SEGMENTS.filter(
    (s) => s.key === mine || universal.includes(s.key),
  );
}

/** Your class rung's peak rate — 10% Standard, 20% Premium. */
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
