import {
  DEFAULT_DISCOUNT_CAP_MXN,
  STRATEGIES,
  STRATEGY_BY_ID,
  strategyForPlace,
  type Strategy,
  type StrategyId,
} from "@/lib/business/strategies";
import { type AdminPlace } from "../../actions";

// Controls tab — the pure bits every controls/ file shares. Moved out of
// PromosSection.tsx (2026-09-02) with no behaviour change: that file was 1482
// lines and 20 top-level components, which is too much to restructure in
// place. Make the change easy, then make the easy change.

export const MEMBERSHIP_PRICE_MXN = 1000;

/** The free, no-discount strategy — the "leaving"/"not paid" boundary. */
export const ZERO_STRATEGY_ID: StrategyId = "zero";

export const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

export function formatMoney(amount: number, currency: string | null): string {
  const prefix = !currency || currency === "MXN" ? "MX$" : "$";
  return `${prefix}${amount.toLocaleString("en-US")}`;
}

/** Zero · Conservative · Aggressive. Dominant is not a picker option. */
export function pickerStrategies(): readonly Strategy[] {
  return STRATEGIES.filter((s) => s.id !== "dominant");
}

export function strategyRatesOnly(s: Strategy) {
  return {
    welcome_free_rate: s.rates.welcome_free_rate,
    welcome_premium_rate: s.rates.welcome_premium_rate,
    free_rate: s.rates.free_rate,
    premium_rate: s.rates.premium_rate,
  };
}

/** Strategy writes the four rate columns; Zero clears cap; leaving Zero seeds default cap when null. */
export function strategySwitchPatch(
  target: StrategyId,
  place: AdminPlace,
  storedStrategy: StrategyId | null,
): Record<string, number | null> {
  const rates = strategyRatesOnly(STRATEGY_BY_ID[target]);
  if (target === ZERO_STRATEGY_ID) {
    return { ...rates, monthly_promo_cap: null };
  }
  const fromZero =
    storedStrategy === ZERO_STRATEGY_ID || strategyForPlace(place) === ZERO_STRATEGY_ID;
  if (fromZero && place.monthly_promo_cap == null) {
    return { ...rates, monthly_promo_cap: DEFAULT_DISCOUNT_CAP_MXN };
  }
  return rates;
}
