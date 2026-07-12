/**
 * Place price labels — two surfaces, two formats (web parity).
 * decision: Pato — swipe shows $$$$ ; profile shows numeric ranges.
 */

const LEVEL_RANGES: Record<1 | 2 | 3 | 4, [number, number]> = {
  1: [100, 200],
  2: [200, 300],
  3: [300, 500],
  4: [500, 800],
};

function currencyPrefix(code: string | null | undefined): string {
  if (code === 'USD') return '$';
  if (code === 'EUR') return '€';
  if (code && code !== 'MXN') return `${code} `;
  return 'MX$';
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
  return `${currencyPrefix(currency)}${min}–${max}`;
}

function clampPriceLevel(
  priceLevel: number | null | undefined,
): 1 | 2 | 3 | 4 | null {
  if (priceLevel == null || priceLevel < 1) return null;
  return Math.min(4, Math.max(1, Math.round(priceLevel))) as 1 | 2 | 3 | 4;
}

export function formatPlacePriceLevelSymbols(
  priceLevel: number | null | undefined,
): string | null {
  const level = clampPriceLevel(priceLevel);
  if (level == null) return null;
  return '$'.repeat(level);
}

/** Place profile: numeric range when available. Accepts object (web) or positional. */
export function formatPlacePriceChip(
  priceRangeOrInput:
    | string
    | null
    | undefined
    | {
        priceRange?: string | null;
        priceLevel?: number | null;
        currency?: string | null;
      },
  priceLevel?: number | null,
  currency?: string | null,
): string | null {
  if (
    priceRangeOrInput &&
    typeof priceRangeOrInput === 'object' &&
    !Array.isArray(priceRangeOrInput)
  ) {
    const raw = priceRangeOrInput.priceRange?.trim() ?? '';
    if (raw && /\d/.test(raw)) return withPerPerson(raw);
    const fromLevel = fallbackFromLevel(
      priceRangeOrInput.priceLevel,
      priceRangeOrInput.currency,
    );
    if (fromLevel) return withPerPerson(fromLevel);
    return formatPlacePriceLevelSymbols(priceRangeOrInput.priceLevel);
  }

  const raw = typeof priceRangeOrInput === 'string' ? priceRangeOrInput : '';
  if (raw && /\d/.test(raw)) return withPerPerson(raw);
  const fromLevel = fallbackFromLevel(priceLevel, currency);
  if (fromLevel) return withPerPerson(fromLevel);
  return formatPlacePriceLevelSymbols(priceLevel);
}
