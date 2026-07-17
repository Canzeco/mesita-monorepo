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

export function priceLevelFromGoogle(p?: string): number | null {
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
      return null;
  }
}
