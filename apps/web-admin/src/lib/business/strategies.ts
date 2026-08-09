// Promos — Discount strategies + independent discount cap.
//
// Membership (plan ≠ free) and strategy (rate presets) are separate knobs
// (MESITA-912): one MX$1,000/year membership door, free strategy switching
// anytime. Non-members are locked at Zero; members pick any preset.
//
// Product (2026-08-09, Pato): THREE strategies only — Zero / Conservative /
// Aggressive. There is NO Dominant. Discount cap is a SEPARATE parameter
// with three options: MX$200 / MX$500 / MX$1000 (not bundled into strategy).
//
// A member selects ONE strategy (rate bundle) and independently ONE discount
// cap. The presets encode:
//
//   - Welcome ≥ Returning inside a class — winning a guest is worth more than
//     keeping one (retention discounts are partly deadweight).
//   - Premium ≥ Standard in every row — Premium guests always get more.
//   - Rates live on a tens grid, max 50% — "half off" is the strongest
//     credible headline.
//   - Every discount applies to the first N pesos of the bill — N is the
//     place's chosen cap (200 / 500 / 1000), persisted to
//     projects.monthly_promo_cap.
//   - Visibility follows generosity: the ranking judge reads a stronger
//     discount as a stronger card.
//
// Switching strategy writes the four rate columns only (and clears cap on
// Zero / seeds the default cap when leaving Zero). Cap changes write
// monthly_promo_cap alone. Drop membership is a separate Membership-box action.

/** Legal per-place discount caps (MXN). Zero strategy clears the cap. */
export const DISCOUNT_CAPS_MXN = [200, 500, 1000] as const;
export type DiscountCapMxn = (typeof DISCOUNT_CAPS_MXN)[number];

/** Default when a place leaves Zero or has no cap yet. */
export const DEFAULT_DISCOUNT_CAP_MXN: DiscountCapMxn = 500;

/** @deprecated Use DEFAULT_DISCOUNT_CAP_MXN / DISCOUNT_CAPS_MXN — cap is no longer universal. */
export const UNIVERSAL_CAP_MXN = DEFAULT_DISCOUNT_CAP_MXN;

export type StrategyId = "zero" | "conservative" | "aggressive";

// Three rungs — Aggressive is the peak.
type StrategyVisibility = "Low" | "Mid" | "High";

// The four discount cells, keyed by the exact projects column each maps to.
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
};

// Ordered ascending in generosity so the picker reads Zero → Aggressive.
// Cap is NOT part of the strategy — it is an independent place param.
//
//   Level          FR  PR  FW  PW   Visibility
//   ⭕ Zero        off off off off   Low
//   🌿 Conservative 10  20  20  30   Mid
//   ⚡ Aggressive   10  30  30  50   High
//
// Aggressive is Conservative stretched on the Premium/Welcome side.
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
  },
  {
    id: "aggressive",
    name: "Aggressive",
    nameEs: "Agresivo",
    emoji: "⚡",
    tagline: "Conservative stretched — bold headlines to pull a crowd.",
    visibility: "High",
    rates: {
      welcome_free_rate: 30,
      welcome_premium_rate: 50,
      free_rate: 10,
      premium_rate: 30,
    },
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
];

/** Snap any number onto the legal discount-cap ladder (nearest option). */
export function snapDiscountCap(v: unknown): DiscountCapMxn {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    return DEFAULT_DISCOUNT_CAP_MXN;
  }
  let best: DiscountCapMxn = DISCOUNT_CAPS_MXN[0];
  for (const option of DISCOUNT_CAPS_MXN) {
    if (Math.abs(option - v) < Math.abs(best - v)) best = option;
  }
  return best;
}

// Which strategy a place's stored rates currently reflect. Matched on the four
// rate columns (cap is independent, not part of identity). Returns null when
// the rates match no preset — e.g. a legacy place still carrying Dominant
// (40/50/20/30) or a retired 70 — so the UI shows a neutral "custom" state.
// A fresh place (all nulls) matches Zero, which is correct.
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
