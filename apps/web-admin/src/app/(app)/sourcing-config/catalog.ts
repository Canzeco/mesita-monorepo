// Sourcing Config catalog — the human-facing taxonomy behind the policy table.
//
// Mesita onboards places sourced from Google Places (New). This catalog groups
// the ~150 Google primary types (Table A) into a handful of Mesita-relevant
// FAMILIES, and names the sourcing CHANNELS the policy is keyed by. The family
// keys and channel keys are the contract shared with the Edge Functions
// (admin-web-{get,update}-sourcing-config) — keep them in lock-step.
//
// The googleTypes arrays are the machine expansion of each family: the Google
// `primaryType` values a place must match to count as that family. They're the
// enforcement contract for the sourcing gate — every channel below is enforced
// live via `_shared/sourcing.ts` (`readChannelPolicy` + `evaluatePlaceForChannel`).
// Anything NOT in an enabled family is ineligible — that's how schools,
// hospitals, gas stations, hotels, shops and transit are kept out without an
// explicit blocklist.

export type FamilyKey =
  | "restaurants"
  | "bars_nightlife"
  | "cafes_bakeries"
  | "wellness_spa"
  | "experiences"
  | "culture_arts";

export type ChannelKey =
  | "admin_search"
  | "admin_add"
  | "business_search"
  | "business_add"
  | "consumer_search"
  | "consumer_add"
  | "memo_search";

type ChannelPolicy = {
  enabled: boolean;
  families: FamilyKey[];
  minRating: number;
  minReviews: number;
};

export type SourcingConfig = Record<ChannelKey, ChannelPolicy>;

type Family = {
  key: FamilyKey;
  label: string;
  emoji: string;
  blurb: string;
  // Representative Google Places (New) Table A primary types. Not exhaustive of
  // every cuisine variant, but the canonical set the gate matches on.
  googleTypes: string[];
};

export const FAMILIES: Family[] = [
  {
    key: "restaurants",
    label: "Restaurants",
    emoji: "🍽️",
    blurb: "Sit-down dining across every cuisine — the core of Mesita.",
    googleTypes: [
      "restaurant",
      "fine_dining_restaurant",
      "steak_house",
      "seafood_restaurant",
      "sushi_restaurant",
      "japanese_restaurant",
      "mexican_restaurant",
      "italian_restaurant",
      "pizza_restaurant",
      "mediterranean_restaurant",
      "american_restaurant",
      "asian_restaurant",
      "chinese_restaurant",
      "thai_restaurant",
      "indian_restaurant",
      "french_restaurant",
      "spanish_restaurant",
      "korean_restaurant",
      "vietnamese_restaurant",
      "middle_eastern_restaurant",
      "vegan_restaurant",
      "vegetarian_restaurant",
      "barbecue_restaurant",
      "hamburger_restaurant",
      "taco_restaurant",
      "ramen_restaurant",
      "tapas_restaurant",
      "brunch_restaurant",
      "breakfast_restaurant",
      "bistro",
      "diner",
      "gastropub",
      "buffet_restaurant",
      "food_court",
    ],
  },
  {
    key: "bars_nightlife",
    label: "Bars & Nightlife",
    emoji: "🍸",
    blurb: "Bars, cocktail lounges, breweries, clubs and live-music places.",
    googleTypes: [
      "bar",
      "cocktail_bar",
      "wine_bar",
      "sports_bar",
      "lounge_bar",
      "pub",
      "irish_pub",
      "gastropub",
      "beer_garden",
      "brewery",
      "brewpub",
      "hookah_bar",
      "night_club",
      "dance_hall",
      "live_music_venue",
      "karaoke",
      "comedy_club",
      "casino",
    ],
  },
  {
    key: "cafes_bakeries",
    label: "Cafés, Bakeries & Dessert",
    emoji: "☕",
    blurb: "Coffee, tea, bakeries, ice cream and dessert spots.",
    googleTypes: [
      "cafe",
      "coffee_shop",
      "coffee_roastery",
      "coffee_stand",
      "cat_cafe",
      "dog_cafe",
      "tea_house",
      "bakery",
      "cake_shop",
      "pastry_shop",
      "bagel_shop",
      "donut_shop",
      "dessert_shop",
      "dessert_restaurant",
      "ice_cream_shop",
      "acai_shop",
      "juice_shop",
      "chocolate_shop",
      "confectionery",
    ],
  },
  {
    key: "wellness_spa",
    label: "Wellness & Spa",
    emoji: "🧖",
    blurb: "Spas, saunas, wellness centers and yoga studios (experiences, not clinics).",
    googleTypes: [
      "spa",
      "massage_spa",
      "massage",
      "sauna",
      "wellness_center",
      "yoga_studio",
      "skin_care_clinic",
    ],
  },
  {
    key: "experiences",
    label: "Experiences & Activities",
    emoji: "🎟️",
    blurb: "Things to do — amusement, arcades, bowling, karting, aquariums, wineries.",
    googleTypes: [
      "tourist_attraction",
      "amusement_park",
      "amusement_center",
      "water_park",
      "aquarium",
      "zoo",
      "bowling_alley",
      "video_arcade",
      "go_karting_venue",
      "paintball_center",
      "miniature_golf_course",
      "ice_skating_rink",
      "escape_room",
      "winery",
      "vineyard",
      "botanical_garden",
      "planetarium",
      "observation_deck",
      "marina",
      "event_venue",
      "banquet_hall",
      "wedding_venue",
    ],
  },
  {
    key: "culture_arts",
    label: "Culture & Arts",
    emoji: "🎭",
    blurb: "Museums, galleries, theaters, concert & opera halls, cultural landmarks.",
    googleTypes: [
      "museum",
      "art_museum",
      "history_museum",
      "art_gallery",
      "cultural_center",
      "cultural_landmark",
      "historical_place",
      "monument",
      "performing_arts_theater",
      "concert_hall",
      "opera_house",
      "philharmonic_hall",
      "movie_theater",
    ],
  },
];

const ALL_FAMILY_KEYS: FamilyKey[] = FAMILIES.map((f) => f.key);

type ChannelVerb = "search" | "add";

type Channel = {
  key: ChannelKey;
  actor: "Admin" | "Business" | "Consumer" | "Memo";
  verb: ChannelVerb;
  label: string;
  description: string;
  // Where the policy is enforced today. Must stay honest with Edge Function
  // callers of readChannelPolicy / evaluatePlaceForChannel (MESITA-736).
  live: boolean;
};

// Two kinds of channel:
//   search — what may be VISIBLE in that surface's searchbar, INCLUDING Google
//            places not yet in Mesita (surfaced as "add this place" candidates).
//            This is the visibility filter: a place the search policy rejects
//            never appears at all, even as a suggestion.
//   add    — what may actually be ONBOARDED into Mesita (created as a place).
// A place can be searchable but not addable (e.g. surfaced for context yet below
// the onboarding bar). Ordered actor-by-actor, search before add.
//
// All seven channels are enforced live today via `_shared/sourcing.ts`.
export const CHANNELS: Channel[] = [
  {
    key: "admin_search",
    actor: "Admin",
    verb: "search",
    label: "Admin · Search",
    description:
      "What surfaces in the admin discovery searchbar (admin-web-discover-places / admin-web-suggest-places), including Google places not yet in Mesita.",
    live: true,
  },
  {
    key: "admin_add",
    actor: "Admin",
    verb: "add",
    label: "Admin · Add",
    description:
      "A super-admin onboards a place from the console (Manage Single / Multiple). Most permissive — trusted operators.",
    live: true,
  },
  {
    key: "business_search",
    actor: "Business",
    verb: "search",
    label: "Business · Search",
    description:
      "What a business owner sees when searching for their place to claim — including places not yet in Mesita. Kept broad so they can find even a brand-new listing.",
    live: true,
  },
  {
    key: "business_add",
    actor: "Business",
    verb: "add",
    label: "Business · Add",
    description:
      "A business owner claims or adds their own place. No review floor by default — you own your place even when it's brand-new.",
    live: true,
  },
  {
    key: "consumer_search",
    actor: "Consumer",
    verb: "search",
    label: "Consumer · Search",
    description:
      "What a consumer sees in search — including Google places not yet in Mesita, surfaced as suggestions. Gated so junk never shows up, even as an 'add' candidate.",
    live: true,
  },
  {
    key: "consumer_add",
    actor: "Consumer",
    verb: "add",
    label: "Consumer · Add",
    description:
      "A consumer suggests or adds a place. Quality-gated to keep junk and personal listings out.",
    live: true,
  },
  {
    key: "memo_search",
    actor: "Memo",
    verb: "search",
    label: "Memo · Search",
    description:
      "What Memo, the consumer concierge, may surface or recommend. Gated to well-reviewed spots.",
    live: true,
  },
];

// Fail-closed placeholder / coerce seed — must match live app_config +
// `_shared/sourcing.ts` DEFAULT_POLICY (shipped code > historical migration
// seed). Used as the pre-load placeholder and as the fallback if the config
// read fails. consumer_search minRating is 1★; consumer_add is 2★ / 50 reviews
// (live app_config floors — not the old migration seed 3.5★ / 100).
export const DEFAULT_CONFIG: SourcingConfig = {
  admin_search: { enabled: true, families: [...ALL_FAMILY_KEYS], minRating: 0, minReviews: 0 },
  admin_add: { enabled: true, families: [...ALL_FAMILY_KEYS], minRating: 0, minReviews: 0 },
  business_search: { enabled: true, families: [...ALL_FAMILY_KEYS], minRating: 0, minReviews: 0 },
  business_add: { enabled: true, families: [...ALL_FAMILY_KEYS], minRating: 0, minReviews: 0 },
  consumer_search: { enabled: true, families: [...ALL_FAMILY_KEYS], minRating: 1, minReviews: 50 },
  consumer_add: { enabled: true, families: [...ALL_FAMILY_KEYS], minRating: 2, minReviews: 50 },
  memo_search: { enabled: true, families: [...ALL_FAMILY_KEYS], minRating: 4.0, minReviews: 50 },
};

// Coerce an arbitrary loaded object into a full, well-typed SourcingConfig,
// filling any missing channel from DEFAULT_CONFIG and dropping unknown families.
// The page always works on a complete object even if the row is partial.
export function coerceConfig(raw: unknown): SourcingConfig {
  const out = {} as SourcingConfig;
  const src = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  for (const ch of CHANNELS) {
    const d = DEFAULT_CONFIG[ch.key];
    const p = src[ch.key];
    if (!p || typeof p !== "object") {
      out[ch.key] = { ...d, families: [...d.families] };
      continue;
    }
    const o = p as Record<string, unknown>;
    const families = Array.isArray(o.families)
      ? (o.families.filter(
          (f): f is FamilyKey => typeof f === "string" && ALL_FAMILY_KEYS.includes(f as FamilyKey),
        ) as FamilyKey[])
      : [...d.families];
    out[ch.key] = {
      enabled: typeof o.enabled === "boolean" ? o.enabled : d.enabled,
      families,
      minRating: typeof o.minRating === "number" ? o.minRating : d.minRating,
      minReviews: typeof o.minReviews === "number" ? o.minReviews : d.minReviews,
    };
  }
  return out;
}
