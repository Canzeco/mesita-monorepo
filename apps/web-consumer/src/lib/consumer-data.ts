export const CLASS_ORDER = ["free", "premium"] as const;
type Class = (typeof CLASS_ORDER)[number];

// NOTE: The original Lovable export shipped a large local `Place` type
// (with fields for popular-times bars, visitor avatars, etc.). Discover
// surfaces now consume `Place` from `@/lib/api/places` — the EF-backed
// shape — and the rich detail surface reads `PlaceDetail` from
// `@/lib/mock/place`. This module no longer carries a Place type; the
// SAVED_PLACES export below is typed against the public api Place.

export const AI_SUGGESTIONS = [
  "Rooftop with a sunset view",
  "Romantic dinner in Polanco",
  "Sunday family brunch",
  "Mezcal and vinyl after midnight",
  "Most fashionable club in San Pedro",
  "Famous Luis Miguel spot in Acapulco",
];

// Country list — used by the phone-input dial-code picker (the residence
// dropdown was retired; country is inferred from the phone's dial code).
// Ordered roughly by hospitality relevance:
// Mexico first (the home market), Latam + Iberian world next, then a
// short tail of common origin countries. `dial` is the E.164 country
// calling code (no leading "+"); the picker re-adds the plus visually.
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

export const CLASSES: {
  id: Class;
  label: string;
  req: string;
  /** Monthly subscription price in MXN. 0 for Free (the default class).
   *  Granted upfront — no spend accumulation required. */
  priceMxn: number;
  /** Follower threshold via Instagram verification. 0 = no threshold. */
  followerThreshold: number;
  reward: string;
  perk: string;
}[] = [
  // The class IS the brand — rendered as "Mesita Free" / "Mesita Premium" in
  // marketing and subscribe surfaces. The compact `label` here is used inside
  // tight UI (class badges, table rows) where the "Mesita" prefix is noise.
  {
    id: "free",
    label: "Free",
    req: "Default account",
    priceMxn: 0,
    followerThreshold: 0,
    reward: "Base discount",
    perk: "Welcome to the club",
  },
  {
    id: "premium",
    label: "Premium",
    req: "1K+ IG followers · invitation · or $100 MXN / mo",
    priceMxn: 100,
    followerThreshold: 1_000,
    reward: "Bigger discount",
    perk: "Better recs · more reservations",
  },
];

// Canonical bg + text class per class. Used wherever a class needs the
// brand-color chip treatment (avatars, pills, hero rows). Compose with
// cn() at the call site when extra modifiers (size, rounding) are needed.
export function classBadgeClass(classKey: Class): string {
  switch (classKey) {
    case "free":
      return "bg-tier-free text-foreground";
    case "premium":
      return "bg-tier-premium text-white";
  }
}

// Compact Title-Case label per class. Used by the swipe overlay, the
// promo chip, the /coupons promo card, and the place detail rewards
// box — anywhere we render "Mesita Free" / "Mesita Premium" alongside
// the lower-case class id (`free` / `premium`).
//
// Accepts a strictly-typed Class or a plain string so callers can hand us
// either (e.g. a server-sourced class_key that flows as string) without an
// extra cast; unknown values fall back to the "Mesita" brand word.
const CLASS_LABELS: Record<Class, string> = {
  free: "Free",
  premium: "Premium",
};

export function classProperLabel(classKey: Class | string): string {
  return CLASS_LABELS[classKey as Class] ?? "Mesita";
}

// NOTE: The SAVED_PLACES mock catalog lives in `@/lib/mock/saved-places-mock`
// alongside the other entity mocks (reservations-mock, coupons-mock).
