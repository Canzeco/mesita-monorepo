// Promos v6 — the reward program's education model (MESITA-723, segments v6,
// locked by Pato 2026-08-01). Mirrors apps/web-consumer/src/lib/reward-segments.ts
// — when the web file changes, update this in the same PR (mobile ↔ web
// parity).
//
// PRESENTATION model: the rate grid for the Rewards program summary + the
// "up to" banner. Program education, not a per-transaction promise — the
// numbers below are the locked defaults; the admin "Rewards" config page
// persists the editable copy the bill engine reads. Anything quoting a rate
// for a SPECIFIC place reads consumer-web-get-discount-quote instead.
//
// NO LADDER (Pato, MESITA-2044: "either you are diamond or you are not ...
// Diamond List"). Who the guest is comes down to exactly TWO rows: the Base
// every guest gets, and the Diamond List adder on top of it for a guest on
// the list. They are the engine's `bronze` and `diamond` rows under the new
// names — the numbers did not move. Silver and Gold are gone; the actions
// (Story, Welcome, Google review) are unchanged.

import {
  BASE_RATE_HINT,
  BASE_RATE_LABEL,
  DIAMOND_LIST,
  DIAMOND_LIST_ES,
  DIAMOND_LIST_RATE_HINT,
} from '@/lib/consumer-identity';
import { onDiamondList } from '@/lib/consumer-classes';

// The storage key a consumer holds (legacy ids, after the auth provider's
// bridge). STORAGE — never rendered.
export type RewardClassKey = 'standard' | 'premium' | 'influencer' | 'aura';

// The business discount strategy that sets how generous a place's grid is:
// Zero / Conservative / Aggressive (aggressive = peak).
type GridStrategy = 'zero' | 'conservative' | 'aggressive';

//   base   — every guest, every visit
//   action — a rewarded thing the guest does at the table (Story / Google Review)
//   visit  — a state of the visit itself (Welcome = first ticket at the place)
type RewardSegmentKind = 'base' | 'action' | 'visit';

export type RewardSegmentKey = 'base' | 'story' | 'welcome' | 'review';

export type RewardSegment = {
  key: RewardSegmentKey;
  name: string;
  nameEs: string;
  kind: RewardSegmentKind;
  blurb: string;
  /** The locked v6 grid, 5% steps, 0 = off. Peak = aggressive. */
  rates: Record<GridStrategy, number>;
};

/** Base first, then the actions. The Diamond List is NOT a segment: it is an
 *  adder on the Base, so it lives in `identityRateRows` below. */
export const REWARD_SEGMENTS: readonly RewardSegment[] = [
  {
    key: 'base',
    name: BASE_RATE_LABEL,
    nameEs: 'Base',
    kind: 'base',
    blurb: BASE_RATE_HINT,
    rates: { zero: 0, conservative: 5, aggressive: 15 },
  },
  {
    key: 'story',
    name: 'Instagram Story',
    nameEs: 'Historia de Instagram',
    kind: 'action',
    blurb: 'Connect Instagram, post a tagged story — any visit.',
    rates: { zero: 0, conservative: 15, aggressive: 25 },
  },
  {
    key: 'welcome',
    name: 'Welcome Visit',
    nameEs: 'Visita de Bienvenida',
    kind: 'visit',
    blurb: 'Your first ever visit to a place.',
    rates: { zero: 0, conservative: 25, aggressive: 35 },
  },
  {
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

// ── The Diamond List adder (v9, MESITA-877) ─────────────────────────────
//
// Every rate above is the BASE. A guest on the Diamond List gets this on top,
// exactly as the bill engine computes it (it is the engine's diamond-over-
// bronze step, +15, unchanged by MESITA-2044). A strategy that pays nothing
// pays no adder either.
const DIAMOND_LIST_STEP = 15;

/** The adder a guest on the Diamond List gets at this strategy. */
export function diamondListAdder(strategy: GridStrategy = PEAK_STRATEGY): number {
  return REWARD_SEGMENT_BY_KEY.base.rates[strategy] > 0 ? DIAMOND_LIST_STEP : 0;
}

/** One rung's rate for a specific guest — the number they'd actually be paid. */
function rateForSegment(
  key: RewardSegmentKey,
  diamond: boolean,
  strategy: GridStrategy = PEAK_STRATEGY,
): number {
  const base = REWARD_SEGMENT_BY_KEY[key].rates[strategy];
  if (base <= 0) return 0;
  return diamond ? base + diamondListAdder(strategy) : base;
}

/** The guest's standing rate: the Base, plus the adder when on the list. */
export function standingRate(
  classKey: RewardClassKey | string,
  strategy: GridStrategy = PEAK_STRATEGY,
): number {
  return rateForSegment('base', onDiamondList(classKey), strategy);
}

/** The ceiling a consumer can reach across the Base and every action. */
export function peakRateForClass(
  classKey: RewardClassKey | string,
  strategy: GridStrategy = PEAK_STRATEGY,
): number {
  const diamond = onDiamondList(classKey);
  return REWARD_SEGMENTS.reduce(
    (max, seg) => Math.max(max, rateForSegment(seg.key, diamond, strategy)),
    0,
  );
}

// ── The two identity rows every rate surface renders ─────────────────────
//
// Place detail's reward matrix, THE TICKET and Me › Help all show exactly
// these two rows — never a third, never a ladder. The guest's own row carries
// the "You" marker: Base for everyone not on the list, Diamond List for a
// guest on it (who gets the Base too — the adder is on top).

export type IdentityRateRow = {
  key: 'base' | 'diamond';
  label: string;
  labelEs: string;
  hint: string;
  /** Percent. For the Diamond List row this is the ADDER, not a total. */
  value: number;
  /** "12%" for the Base, "+15%" for the adder. */
  display: string;
  mine: boolean;
};

/** Format a Diamond List adder: always signed, because it is on top. */
export function formatAdder(n: number): string {
  return `+${n}%`;
}

export function identityRateRows(
  baseRate: number,
  adder: number,
  diamond: boolean,
): IdentityRateRow[] {
  return [
    {
      key: 'base',
      label: BASE_RATE_LABEL,
      labelEs: 'Base',
      hint: BASE_RATE_HINT,
      value: baseRate,
      display: `${baseRate}%`,
      mine: !diamond,
    },
    {
      key: 'diamond',
      label: DIAMOND_LIST,
      labelEs: DIAMOND_LIST_ES,
      hint: DIAMOND_LIST_RATE_HINT,
      value: adder,
      display: formatAdder(adder),
      mine: diamond,
    },
  ];
}

/** The two rows at a strategy, from the locked grid (education surfaces). */
export function identityRateRowsAt(
  strategy: GridStrategy,
  classKey: RewardClassKey | string,
): IdentityRateRow[] {
  return identityRateRows(
    REWARD_SEGMENT_BY_KEY.base.rates[strategy],
    diamondListAdder(strategy),
    onDiamondList(classKey),
  );
}
