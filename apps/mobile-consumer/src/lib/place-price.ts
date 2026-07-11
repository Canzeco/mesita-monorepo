/**
 * Place price labels — swipe uses $$$$ symbols (web parity).
 * decision: Pato — swipe shows $$$$ ; profile shows numeric ranges.
 */

function clampPriceLevel(
  priceLevel: number | null | undefined,
): 1 | 2 | 3 | 4 | null {
  if (priceLevel == null || priceLevel < 1) return null;
  return Math.min(4, Math.max(1, Math.round(priceLevel))) as 1 | 2 | 3 | 4;
}

/** Swipe / deck: $-symbols from price_level (e.g. $$$$). */
export function formatPlacePriceLevelSymbols(
  priceLevel: number | null | undefined,
): string | null {
  const level = clampPriceLevel(priceLevel);
  if (level == null) return null;
  return '$'.repeat(level);
}
