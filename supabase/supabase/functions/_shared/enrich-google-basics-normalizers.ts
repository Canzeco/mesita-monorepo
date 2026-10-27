type GoogleAddressComponent = { types?: string[]; longText?: string };

export function findAddressComponent(
  components: GoogleAddressComponent[] | undefined,
  types: string[],
): string | null {
  if (!components) return null;
  for (const type of types) {
    const found = components.find((c) => c.types?.includes(type));
    if (found?.longText) return found.longText;
  }
  return null;
}

// Phone must ALWAYS carry the country code. Prefer Google's international
// format outright; a bare national number is only salvaged when we know the
// place's country calling code.
const COUNTRY_CALLING_CODES: Record<string, string> = {
  "México": "+52",
  "Mexico": "+52",
};

export function internationalPhone(
  details: { internationalPhoneNumber?: string; nationalPhoneNumber?: string },
  country: string | null,
): string | null {
  const intl = details.internationalPhoneNumber?.trim();
  if (intl) return intl.startsWith("+") ? intl : `+${intl}`;
  const national = details.nationalPhoneNumber?.trim();
  if (!national) return null;
  if (national.startsWith("+")) return national;
  const code = country ? COUNTRY_CALLING_CODES[country] : undefined;
  return code ? `${code} ${national}` : null;
}

/** Google's `priceRange`: per person, `units` a decimal string. */
export type GooglePriceRange = {
  startPrice?: { currencyCode?: string; units?: string };
  endPrice?: { currencyCode?: string; units?: string };
};

// THE RANGE FEEDS THE $$ (Pato, MESITA-2860: "include price range in $$$$
// stuff"): many places carry no `priceLevel` but do carry Google's numeric
// range ("MX$100–200"). The start price per person picks the level; a
// currency with no ladder here gives none. Tune the ladders, nothing else.
const PRICE_LADDERS: Record<string, [number, number, number]> = {
  MXN: [200, 400, 1000],
  USD: [10, 20, 50],
};

function priceLevelFromRange(
  range: GooglePriceRange | undefined,
): number | null {
  const start = range?.startPrice ?? range?.endPrice;
  const ladder = PRICE_LADDERS[start?.currencyCode?.toUpperCase() ?? ""];
  const units = Number(start?.units);
  if (!ladder || !Number.isFinite(units) || units < 0) return null;
  const step = ladder.findIndex((ceiling) => units < ceiling);
  return step === -1 ? 4 : step + 1;
}

export function priceLevelFromGoogle(
  p: string | undefined,
  range?: GooglePriceRange,
): number | null {
  switch (p) {
    case "PRICE_LEVEL_FREE":
    case "PRICE_LEVEL_INEXPENSIVE":
      return 1;
    case "PRICE_LEVEL_MODERATE":
      return 2;
    case "PRICE_LEVEL_EXPENSIVE":
      return 3;
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return 4;
    default:
      return priceLevelFromRange(range);
  }
}
