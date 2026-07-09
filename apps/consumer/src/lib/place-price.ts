/**
 * Price chip label for swipe + place profile summary.
 *
 * decision: Pato — show the real price range (e.g. MX$200–300), not $$$.
 * Prefer an explicit numeric `price_range`; fall back to a level-based
 * MXN/USD band; only then to $-symbols when nothing numeric is available.
 */

const LEVEL_RANGES: Record<1 | 2 | 3 | 4, [number, number]> = {
  1: [100, 200],
  2: [200, 300],
  3: [300, 500],
  4: [500, 800],
};

function currencyPrefix(code: string | null | undefined): string {
  if (code === "USD") return "$";
  if (code === "EUR") return "€";
  if (code && code !== "MXN") return `${code} `;
  return "MX$";
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

/** Chip text for place price — always a range when we can derive one. */
export function formatPlacePriceChip(input: {
  priceRange?: string | null;
  priceLevel?: number | null;
  currency?: string | null;
}): string | null {
  const raw = input.priceRange?.trim() ?? "";
  if (raw && /\d/.test(raw)) return withPerPerson(raw);

  const fromLevel = fallbackFromLevel(input.priceLevel, input.currency);
  if (fromLevel) return withPerPerson(fromLevel);

  if (input.priceLevel != null && input.priceLevel >= 1) {
    return "$".repeat(Math.min(4, Math.max(1, Math.round(input.priceLevel))));
  }
  return null;
}
