// Promos v4 — Discount strategies (business Promos page).
//
// The Promos page no longer exposes four independent rate pickers or a
// Free/Pro/Ultra subscription ladder. A business now picks ONE of four preset
// strategies; each is a bundle of the four per-tier promo rates plus the one
// universal ticket cap. The presets encode the product invariants directly
// (design 2026-07-11 — "Promos v4"):
//
//   - Welcome ≥ Returning inside a class — winning a guest is worth more than
//     keeping one (retention discounts are partly deadweight).
//   - Premium ≥ Standard in every row — Premium guests always get more.
//   - Rates live on a tens grid, max 50% — "half off" is the strongest
//     credible headline; 70 was retired on margin math.
//   - Every discount applies to the first MX$500 of the bill — one
//     platform-wide constant, always displayed, bounded + predictable cost.
//   - Visibility follows generosity: the ranking judge reads a stronger
//     discount as a stronger card, so visibility isn't a separate knob — just
//     a label that rises with the strategy.
//
// Picking a strategy writes the four rate columns + monthly_promo_cap in a
// single apiUpdatePlace call. Zero clears every rate (null) and the cap.

// The universal, platform-wide cap: every discount applies to the first
// MX$500 of the bill. Persisted to places.monthly_promo_cap for the bill EF
// (computeTicketBill → promoEligibleSubtotalCents reads it), and always shown.
export const UNIVERSAL_CAP_MXN = 500;

export type StrategyId = "zero" | "conservative" | "aggressive" | "dominant";

// Four rungs, distinct from the plan visibility of the old model.
type StrategyVisibility = "Low" | "Mid" | "High" | "Max";

// The four discount cells, keyed by the exact places column each maps to.
//   welcome_* → first visit at the place · unprefixed → every visit after.
//   *_free_*  → Standard guests         · *_premium_* → Premium guests.
type StrategyRates = {
  welcome_free_rate: number | null; // FW — Free · Welcome (first visit)
  welcome_premium_rate: number | null; // PW — Premium · Welcome
  free_rate: number | null; // FR — Free · Returning
  premium_rate: number | null; // PR — Premium · Returning
};

export type Strategy = {
  id: StrategyId;
  name: string; // English chrome (app chrome stays English)
  nameEs: string; // Spanish gloss — the names translate cleanly
  emoji: string;
  tagline: string;
  visibility: StrategyVisibility;
  rates: StrategyRates;
  // Cap written alongside the rates. Null for Zero (no promo → no cap).
  cap: number | null;
};

// Ordered ascending in generosity so the picker reads Zero → Dominant.
// The rate tuples are the canonical Promos table (four Strategies):
//
//   Level          FR  PR  FW  PW   Cap   Visibility
//   ⭕ Zero        off off off off   —     Low
//   🌿 Conservative 10  20  20  30   500   Mid
//   ⚡ Aggressive   10  30  30  50   500   High
//   👑 Dominant     20  30  40  50   500   Max
//
// Aggressive is Conservative stretched ×2 on the Premium/Welcome side;
// Dominant raises the floor (FR/FW), not the ceiling (PW stays 50).
export const STRATEGIES: readonly Strategy[] = [
  {
    id: "zero",
    name: "Zero",
    nameEs: "Cero",
    emoji: "⭕",
    tagline: "Listed on Mesita — no discounts.",
    visibility: "Low",
    rates: {
      welcome_free_rate: null,
      welcome_premium_rate: null,
      free_rate: null,
      premium_rate: null,
    },
    cap: null,
  },
  {
    id: "conservative",
    name: "Conservative",
    nameEs: "Conservador",
    emoji: "🌿",
    tagline: "A calm, sustainable discount that still earns a look.",
    visibility: "Mid",
    rates: {
      welcome_free_rate: 20,
      welcome_premium_rate: 30,
      free_rate: 10,
      premium_rate: 20,
    },
    cap: UNIVERSAL_CAP_MXN,
  },
  {
    id: "aggressive",
    name: "Aggressive",
    nameEs: "Agresivo",
    emoji: "⚡",
    tagline: "Conservative doubled — bold headlines to pull a crowd.",
    visibility: "High",
    rates: {
      welcome_free_rate: 30,
      welcome_premium_rate: 50,
      free_rate: 10,
      premium_rate: 30,
    },
    cap: UNIVERSAL_CAP_MXN,
  },
  {
    id: "dominant",
    name: "Dominant",
    nameEs: "Dominante",
    emoji: "👑",
    tagline: "Raise the floor — every guest walks in to a strong deal.",
    visibility: "Max",
    rates: {
      welcome_free_rate: 40,
      welcome_premium_rate: 50,
      free_rate: 20,
      premium_rate: 30,
    },
    cap: UNIVERSAL_CAP_MXN,
  },
];

export const STRATEGY_BY_ID = Object.fromEntries(
  STRATEGIES.map((s) => [s.id, s]),
) as Record<StrategyId, Strategy>;

// The visibility ladder, ascending — drives the compact rail.
export const STRATEGY_VISIBILITY_LADDER: readonly StrategyVisibility[] = [
  "Low",
  "Mid",
  "High",
  "Max",
];

// Which strategy a place's stored rates currently reflect. Matched on the four
// rate columns (the cap is derived, not part of identity). Returns null when
// the rates match no preset — e.g. a legacy place still carrying a retired 70,
// or hand-tuned values — so the UI shows a neutral "custom" state rather than
// mislabeling. A fresh place (all nulls) matches Zero, which is correct.
export function strategyForPlace(rates: StrategyRates): StrategyId | null {
  const match = STRATEGIES.find(
    (s) =>
      s.rates.welcome_free_rate === rates.welcome_free_rate &&
      s.rates.welcome_premium_rate === rates.welcome_premium_rate &&
      s.rates.free_rate === rates.free_rate &&
      s.rates.premium_rate === rates.premium_rate,
  );
  return match?.id ?? null;
}
