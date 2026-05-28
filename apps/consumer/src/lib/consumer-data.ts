export const TIER_ORDER = ["bronze", "silver", "gold", "diamond"] as const;
type Tier = (typeof TIER_ORDER)[number];

// NOTE: The original Lovable export shipped a large local `Venue` type
// (with fields for popular-times bars, visitor avatars, etc.). Discover
// surfaces now consume `Venue` from `@/lib/api/venues` — the EF-backed
// shape — and the rich detail surface reads `VenueDetail` from
// `@/lib/mock/venue`. This module no longer carries a Venue type; the
// SAVED_VENUES export below is typed against the public api Venue.

export const AI_SUGGESTIONS = [
  "Rooftop with a sunset view",
  "Romantic dinner in Polanco",
  "Sunday family brunch",
  "Mezcal and vinyl after midnight",
  "Most fashionable club in San Pedro",
  "Famous Luis Miguel spot in Acapulco",
];

// Country list — used both by the Country residence dropdown and the
// phone-input dial-code picker. Ordered roughly by hospitality relevance:
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

// How the current tier was granted. The Class tab shows different copy
// depending on origin (e.g. "earned via 7.3K Instagram followers" vs
// "subscribed · renews Dec 12"), and `subscription` is the only origin
// that allows a downgrade/cancel action.
type TierOrigin = "default" | "instagram" | "subscription" | "appeal";

// Mock consumer used by the Profile + Discover header until real
// consumer-side reads are wired up. Only carries the fields the UI
// actually reads. The real cashback balance comes from the consumer
// profile EF (`apiFetchConsumerProfile().cashback_balance_cents`); the
// mock no longer carries a duplicate `balance` field.
export const CURRENT_USER = {
  tier: "gold" as Tier,
  tierOrigin: "instagram" as TierOrigin,
  /** Only meaningful when `tierOrigin === "subscription"`. ISO date string. */
  tierRenewsAt: null as string | null,
  followers: 7320,
};

export const TIERS: {
  id: Tier;
  label: string;
  req: string;
  /** Monthly subscription price in USD. 0 for Bronze (the default tier).
   *  Granted upfront — no spend accumulation required. */
  priceUsd: number;
  /** Follower threshold via social verification (Instagram or LinkedIn). */
  followerThreshold: number;
  cashback: string;
  perk: string;
}[] = [
  // The tier IS the brand — rendered as "Mesita Bronze" / "Mesita Silver"
  // / "Mesita Gold" / "Mesita Diamond" in marketing and subscribe surfaces.
  // The compact `label` here is used inside tight UI (tier badges, table
  // rows) where the "Mesita" prefix would just add noise.
  {
    id: "bronze",
    label: "Bronze",
    req: "Default · no IG or under 1K followers",
    priceUsd: 0,
    followerThreshold: 0,
    cashback: "Base cashback",
    perk: "Welcome to the club",
  },
  {
    id: "silver",
    label: "Silver",
    req: "1K+ followers · or $10 / mo",
    priceUsd: 10,
    followerThreshold: 1_000,
    cashback: "More cashback",
    perk: "Insider perks",
  },
  {
    id: "gold",
    label: "Gold",
    req: "5K+ followers · or $50 / mo",
    priceUsd: 50,
    followerThreshold: 5_000,
    cashback: "Even more cashback",
    perk: "Priority access",
  },
  {
    id: "diamond",
    label: "Diamond",
    req: "20K+ followers · or $200 / mo · or appeal",
    priceUsd: 200,
    followerThreshold: 20_000,
    cashback: "Most cashback",
    perk: "VIP · private events",
  },
];

// Canonical bg + text class per tier. Used wherever a tier needs the
// brand-color chip treatment (avatars, pills, hero rows). Compose with
// cn() at the call site when extra modifiers (size, rounding) are needed.
export function tierBadgeClass(tier: Tier): string {
  switch (tier) {
    case "bronze":
      return "bg-tier-bronze text-white";
    case "silver":
      return "bg-tier-silver text-zinc-900";
    case "gold":
      return "bg-tier-gold text-black";
    case "diamond":
      return "bg-tier-diamond text-white";
  }
}

// NOTE: The SAVED_VENUES mock catalog lives in `@/lib/mock/saved-venues-mock`
// alongside the other entity mocks (reservations-mock, coupons-mock).
