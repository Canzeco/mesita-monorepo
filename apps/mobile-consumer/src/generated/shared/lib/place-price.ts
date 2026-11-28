import { DEFAULT_CURRENCY } from "./money";

/**
 * Place price labels — two surfaces, two formats.
 *
 * decision: Pato — swipe shows $$$$ (price_level symbols); place profile
 * shows the numeric amount range (e.g. $500–800MX per person).
 */

const LEVEL_RANGES = {
  1: [100, 200],
  2: [200, 300],
  3: [300, 500],
  4: [500, 800],
} as const satisfies Record<1 | 2 | 3 | 4, readonly [number, number]>;

function currencyPrefix(code: string | null | undefined): string {
  if (code === "USD") return "$";
  if (code === "EUR") return "€";
  if (code && code !== DEFAULT_CURRENCY) return `${code} `;
  return "$";
}

/** Pesos carry MX after the amount (MESITA-3491): "$200–300MX". */
function currencySuffix(code: string | null | undefined): string {
  return !code || code === "MXN" ? "MX" : "";
}

function withPerPerson(label: string): string {
  if (/per person/i.test(label)) return label;
  return `${label} per person`;
}

function fallbackFromLevel(
  priceLevel: number | null | undefined,
  currency: string | null | undefined,
): string | null {
  if (priceLevel == null || priceLevel < 1 || priceLevel > 4) return null;
  const level = Math.round(priceLevel) as 1 | 2 | 3 | 4;
  const [min, max] = LEVEL_RANGES[level];
  return `${currencyPrefix(currency)}${min}–${max}${currencySuffix(currency)}`;
}

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
  return "$".repeat(level);
}

/** Place profile: numeric range when available (e.g. $500–800MX per person). */
export function formatPlacePriceChip(input: {
  priceRange?: string | null;
  priceLevel?: number | null;
  currency?: string | null;
}): string | null {
  const raw = input.priceRange?.trim() ?? "";
  if (raw && /\d/.test(raw)) return withPerPerson(raw.replace(/^MX\$\s*([\d.,]+(?:\s*[–-]\s*[\d.,]+)?)/, "$$$1MX"));

  const fromLevel = fallbackFromLevel(input.priceLevel, input.currency);
  if (fromLevel) return withPerPerson(fromLevel);

  return formatPlacePriceLevelSymbols(input.priceLevel);
}
