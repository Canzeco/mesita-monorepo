// Country list for the phone dial-code + flag picker. Ported from the
// consumer app's `consumer-data.ts` (keep the two lists in sync when adding
// markets). Ordered roughly by hospitality relevance: Mexico first (the home
// market), Latam + Iberian world next, then a short tail of common origin
// countries. `dial` is the E.164 country calling code (no leading "+"); the
// picker re-adds the plus visually.
export type Country = {
  code: string;
  name: string;
  flag: string;
  dial: string;
};
export const COUNTRIES: Country[] = [
  { code: "MX", name: "Mexico", flag: "🇲🇽", dial: "52" },
  { code: "US", name: "United States", flag: "🇺🇸", dial: "1" },
  { code: "CA", name: "Canada", flag: "🇨🇦", dial: "1" },
  { code: "ES", name: "Spain", flag: "🇪🇸", dial: "34" },
  // LatAm core — Mesita's natural expansion path.
  { code: "AR", name: "Argentina", flag: "🇦🇷", dial: "54" },
  { code: "CO", name: "Colombia", flag: "🇨🇴", dial: "57" },
  { code: "CL", name: "Chile", flag: "🇨🇱", dial: "56" },
  { code: "PE", name: "Peru", flag: "🇵🇪", dial: "51" },
  { code: "BR", name: "Brazil", flag: "🇧🇷", dial: "55" },
  { code: "UY", name: "Uruguay", flag: "🇺🇾", dial: "598" },
  { code: "PY", name: "Paraguay", flag: "🇵🇾", dial: "595" },
  { code: "BO", name: "Bolivia", flag: "🇧🇴", dial: "591" },
  { code: "EC", name: "Ecuador", flag: "🇪🇨", dial: "593" },
  { code: "VE", name: "Venezuela", flag: "🇻🇪", dial: "58" },
  // Central America + Caribbean — second-wave markets.
  { code: "GT", name: "Guatemala", flag: "🇬🇹", dial: "502" },
  { code: "HN", name: "Honduras", flag: "🇭🇳", dial: "504" },
  { code: "SV", name: "El Salvador", flag: "🇸🇻", dial: "503" },
  { code: "NI", name: "Nicaragua", flag: "🇳🇮", dial: "505" },
  { code: "CR", name: "Costa Rica", flag: "🇨🇷", dial: "506" },
  { code: "PA", name: "Panama", flag: "🇵🇦", dial: "507" },
  { code: "DO", name: "Dominican Republic", flag: "🇩🇴", dial: "1" },
  { code: "PR", name: "Puerto Rico", flag: "🇵🇷", dial: "1" },
  // Common visitor origins.
  { code: "UK", name: "United Kingdom", flag: "🇬🇧", dial: "44" },
  { code: "FR", name: "France", flag: "🇫🇷", dial: "33" },
  { code: "IT", name: "Italy", flag: "🇮🇹", dial: "39" },
  { code: "DE", name: "Germany", flag: "🇩🇪", dial: "49" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱", dial: "31" },
  { code: "PT", name: "Portugal", flag: "🇵🇹", dial: "351" },
  { code: "JP", name: "Japan", flag: "🇯🇵", dial: "81" },
  { code: "AU", name: "Australia", flag: "🇦🇺", dial: "61" },
];

export const COUNTRY_BY_CODE: Record<string, Country> = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, c]),
);

// Distinct dial codes, longest first, so prefix matching picks "351" before
// "51" and "52" before "5".
const DIALS_LONGEST_FIRST = [...new Set(COUNTRIES.map((c) => c.dial))].sort(
  (a, b) => b.length - a.length,
);

// Split a stored phone (E.164-ish, with or without a leading + / spaces) into
// an ISO country code + local subscriber digits, so the phone editor can seed
// its dial-code picker and local field. Shared dial codes resolve to the first
// COUNTRIES entry for that dial (MX for 52, US for 1) — good enough for
// pre-filling a picker the user can correct.
export function splitStoredPhone(stored: string | null | undefined): {
  countryCode: string;
  local: string;
} {
  const digits = (stored ?? "").replace(/\D/g, "");
  if (!digits) return { countryCode: "MX", local: "" };
  const dial = DIALS_LONGEST_FIRST.find((d) => digits.startsWith(d));
  if (!dial) return { countryCode: "MX", local: digits };
  const country = COUNTRIES.find((c) => c.dial === dial) ?? COUNTRY_BY_CODE.MX;
  return { countryCode: country.code, local: digits.slice(dial.length) };
}

// Recombine a picked country + local number into strict E.164 (+<dial><digits>,
// no spaces) for storage. Empty local → empty string (nothing to save).
export function combinePhoneE164(countryCode: string, local: string): string {
  const country = COUNTRY_BY_CODE[countryCode] ?? COUNTRY_BY_CODE.MX;
  const digits = local.replace(/\D/g, "");
  if (!digits) return "";
  return `+${country.dial}${digits}`;
}
