// Ascending class ladder: standard (default) < premium (paid) < magnetic
// (top, invite-only via Instagram reach). "class" is the consumer membership
// axis — distinct from a business's billing "plan" (free/pro/ultra).
export const CLASS_ORDER = ["standard", "premium", "magnetic"] as const;
type Class = (typeof CLASS_ORDER)[number];

// Premium-perk gate: everything above Standard (Premium and Magnetic) unlocks
// the elevated perks (bigger rewards, AI connect, unlimited reservations).
export function isElevatedClass(classKey: Class | string): boolean {
  return classKey === "premium" || classKey === "magnetic";
}

// NOTE: The original Lovable export shipped a large local `Place` type
// (with fields for popular-times bars, visitor avatars, etc.). Discover
// surfaces now consume `Place` from `@/lib/api/places` — the EF-backed
// shape — and the rich detail surface reads `PlaceDetail` from
// `@/lib/mock/place`. This module no longer carries a Place type; the
// SAVED_PLACES export below is typed against the public api Place.

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

export const CLASSES: {
  id: Class;
  label: string;
  req: string;
  /** Monthly subscription price in MXN. 0 for Standard (the default class)
   *  and Magnetic (earned with Instagram reach, never paid). Premium is
   *  granted upfront on payment — no spend accumulation required. */
  priceMxn: number;
  /** Follower threshold via Instagram verification. 0 = no threshold. */
  followerThreshold: number;
  reward: string;
  perk: string;
}[] = [
  // The class IS the brand — rendered as "Mesita Standard" / "Mesita Premium" /
  // "Mesita Magnetic" in marketing and subscribe surfaces. The compact `label`
  // here is used inside tight UI (class badges, table rows) where the "Mesita"
  // prefix is noise.
  {
    id: "standard",
    label: "Standard",
    req: "Default account",
    priceMxn: 0,
    followerThreshold: 0,
    reward: "Base discount",
    perk: "Welcome to the club",
  },
  {
    id: "premium",
    label: "Premium",
    req: "Invitation · or $100 MXN / mo",
    priceMxn: 100,
    followerThreshold: 0,
    reward: "Bigger discount",
    perk: "Better recs · more reservations",
  },
  {
    id: "magnetic",
    label: "Magnetic",
    req: "1K+ IG followers · post a story each visit",
    priceMxn: 0,
    followerThreshold: 1_000,
    reward: "Top discount",
    perk: "The invite-only tier for real Instagram reach",
  },
];

// Canonical bg + text class per class. Used wherever a class needs the
// brand-color chip treatment (avatars, pills, hero rows). Compose with
// cn() at the call site when extra modifiers (size, rounding) are needed.
export function classBadgeClass(classKey: Class): string {
  switch (classKey) {
    case "standard":
      return "bg-tier-free text-foreground";
    case "premium":
      return "bg-tier-premium text-white";
    case "magnetic":
      // Magnetic is the top tier — the gold treatment (existing bg-tier-gold
      // design token) sets it apart from Premium's violet.
      return "bg-tier-gold text-white";
  }
}

// Compact Title-Case label per class. Used by the swipe overlay, the
// promo chip, the /coupons promo card, and the place detail rewards
// box — anywhere we render "Mesita Standard" / "Mesita Premium" /
// "Mesita Magnetic" alongside the lower-case class id.
//
// Accepts a strictly-typed Class or a plain string so callers can hand us
// either (e.g. a server-sourced class_key that flows as string) without an
// extra cast; unknown values fall back to the "Mesita" brand word.
const CLASS_LABELS: Record<Class, string> = {
  standard: "Standard",
  premium: "Premium",
  magnetic: "Magnetic",
};

export function classProperLabel(classKey: Class | string): string {
  return CLASS_LABELS[classKey as Class] ?? "Mesita";
}

// NOTE: The SAVED_PLACES mock catalog lives in `@/lib/mock/saved-places-mock`
// alongside the other entity mocks (reservations-mock, coupons-mock).
