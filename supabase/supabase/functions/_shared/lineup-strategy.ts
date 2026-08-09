// Promo rates → RP strategy (MESITA-718).
// Mirrors apps/web-admin/src/lib/business/strategies.ts strategyForPlace.
//
// Product (2026-08-09): three strategies only — Zero / Conservative /
// Aggressive. Dominant retired; its old rate tuple (40/50/20/30) no longer
// matches a preset (migration remaps live rows to Aggressive).

import type { RpStrategy } from "./lineup-scoring.ts";

export type PromoRates = {
  welcome_free_rate: number | null;
  welcome_premium_rate: number | null;
  free_rate: number | null;
  premium_rate: number | null;
};

const PRESETS: { id: RpStrategy; rates: PromoRates }[] = [
  {
    id: "zero",
    rates: {
      welcome_free_rate: null,
      welcome_premium_rate: null,
      free_rate: null,
      premium_rate: null,
    },
  },
  {
    id: "conservative",
    rates: {
      welcome_free_rate: 20,
      welcome_premium_rate: 30,
      free_rate: 10,
      premium_rate: 20,
    },
  },
  {
    id: "aggressive",
    rates: {
      welcome_free_rate: 30,
      welcome_premium_rate: 50,
      free_rate: 10,
      premium_rate: 30,
    },
  },
];

/** Match stored rates to a preset; null = custom/legacy → zero rung. */
export function strategyForRates(rates: PromoRates): RpStrategy | null {
  const match = PRESETS.find(
    (s) =>
      s.rates.welcome_free_rate === rates.welcome_free_rate &&
      s.rates.welcome_premium_rate === rates.welcome_premium_rate &&
      s.rates.free_rate === rates.free_rate &&
      s.rates.premium_rate === rates.premium_rate,
  );
  return match?.id ?? null;
}

export function ratesFromPlace(place: Record<string, unknown>): PromoRates {
  const n = (k: string): number | null => {
    const v = place[k];
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  return {
    welcome_free_rate: n("welcome_free_rate"),
    welcome_premium_rate: n("welcome_premium_rate"),
    free_rate: n("free_rate"),
    premium_rate: n("premium_rate"),
  };
}
