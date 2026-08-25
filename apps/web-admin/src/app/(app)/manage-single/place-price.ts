/**
 * Numeric band for Google price_level. Same 1–4 bands the consumer chip
 * uses (MX$100–200 … MX$500–800). price_level + currency are already on
 * the place row — this only formats them.
 *
 * decision: Pato live 2026-08-25 — admin Profile Google price shows the
 * numbers too, not only $$$$ + Casual.
 */

const LEVEL_RANGES: Record<1 | 2 | 3 | 4, [number, number]> = {
  1: [100, 200],
  2: [200, 300],
  3: [300, 500],
  4: [500, 800],
};

const PRICE_NAMES = ["", "Budget", "Casual", "Upscale", "Fine dining"] as const;
export const MAX_PRICE_LEVEL = PRICE_NAMES.length - 1;

export function priceLevelName(
  level: number | null | undefined,
): string | null {
  if (level == null || level < 1) return null;
  const n = Math.min(MAX_PRICE_LEVEL, Math.round(level));
  return PRICE_NAMES[n];
}

function currencyPrefix(code: string | null | undefined): string {
  if (code === "USD") return "$";
  if (code === "EUR") return "€";
  if (code && code !== "MXN") return `${code} `;
  return "MX$";
}

/** e.g. MX$500–800 per person. Null when price_level is missing. */
export function formatPlacePriceRange(
  priceLevel: number | null | undefined,
  currency: string | null | undefined,
): string | null {
  if (priceLevel == null || priceLevel < 1 || priceLevel > 4) return null;
  const level = Math.round(priceLevel) as 1 | 2 | 3 | 4;
  const [min, max] = LEVEL_RANGES[level];
  return `${currencyPrefix(currency)}${min}–${max} per person`;
}
