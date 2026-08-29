// Google type → Super Category map. Search and Add eligibility is Discovery ›
// Map (`evaluatePlaceForMap`); this file expands Table A types onto the six
// Atlas Super Categories. Atlas slugs live in place-taxonomy.ts — this map
// is the Google-pin / leftover-slug fallback. A Google primaryType in no
// family is ineligible (hotels, schools, shops).

export type FamilyKey =
  | "restaurants"
  | "bars_nightlife"
  | "cafes_bakeries"
  | "wellness_spa"
  | "experiences"
  | "culture_arts";

// Machine expansion of each family — the Google `primaryType` values a place
// must match to count as that family.
const FAMILY_GOOGLE_TYPES: Record<FamilyKey, readonly string[]> = {
  restaurants: [
    "restaurant", "fine_dining_restaurant", "steak_house", "seafood_restaurant",
    "sushi_restaurant", "japanese_restaurant", "mexican_restaurant", "italian_restaurant",
    "pizza_restaurant", "mediterranean_restaurant", "american_restaurant", "asian_restaurant",
    "chinese_restaurant", "thai_restaurant", "indian_restaurant", "french_restaurant",
    "spanish_restaurant", "korean_restaurant", "vietnamese_restaurant", "middle_eastern_restaurant",
    "vegan_restaurant", "vegetarian_restaurant", "barbecue_restaurant", "hamburger_restaurant",
    "taco_restaurant", "ramen_restaurant", "tapas_restaurant", "brunch_restaurant",
    "breakfast_restaurant", "bistro", "diner", "gastropub", "buffet_restaurant", "food_court",
  ],
  bars_nightlife: [
    "bar", "cocktail_bar", "wine_bar", "sports_bar", "lounge_bar", "pub", "irish_pub",
    "gastropub", "beer_garden", "brewery", "brewpub", "hookah_bar", "night_club",
    "dance_hall", "live_music_venue", "karaoke", "comedy_club", "casino",
  ],
  cafes_bakeries: [
    "cafe", "coffee_shop", "coffee_roastery", "coffee_stand", "cat_cafe", "dog_cafe",
    "tea_house", "bakery", "cake_shop", "pastry_shop", "bagel_shop", "donut_shop",
    "dessert_shop", "dessert_restaurant", "ice_cream_shop", "acai_shop", "juice_shop",
    "chocolate_shop", "confectionery",
  ],
  wellness_spa: [
    "spa", "massage_spa", "massage", "sauna", "wellness_center", "yoga_studio", "skin_care_clinic",
  ],
  experiences: [
    "tourist_attraction", "amusement_park", "amusement_center", "water_park", "aquarium",
    "zoo", "bowling_alley", "video_arcade", "go_karting_venue", "paintball_center",
    "miniature_golf_course", "ice_skating_rink", "escape_room", "winery", "vineyard",
    "botanical_garden", "planetarium", "observation_deck", "marina", "event_venue",
    "banquet_hall", "wedding_venue",
  ],
  culture_arts: [
    "museum", "art_museum", "history_museum", "art_gallery", "cultural_center",
    "cultural_landmark", "historical_place", "monument", "performing_arts_theater",
    "concert_hall", "opera_house", "philharmonic_hall", "movie_theater",
  ],
};

const ALL_FAMILY_KEYS = Object.keys(FAMILY_GOOGLE_TYPES) as FamilyKey[];

// A Google type can belong to more than one family — gastropub is listed
// under both restaurants and bars_nightlife — so keep every family it maps
// to. This used to be first-match-wins, which silently bound gastropub to
// restaurants alone (MESITA-631).
const GOOGLE_TYPE_TO_FAMILIES: Record<string, FamilyKey[]> = (() => {
  const m: Record<string, FamilyKey[]> = {};
  for (const fam of ALL_FAMILY_KEYS) {
    for (const t of FAMILY_GOOGLE_TYPES[fam]) {
      (m[t] ??= []).push(fam);
    }
  }
  return m;
})();

/**
 * Every family a Google type (or places.category slug) belongs to.
 * Empty = not a Mesita type. Dual-family types return every match
 * (MESITA-631). The `_restaurant` alias covers truncated taxonomy
 * slugs (fine_dining → fine_dining_restaurant) so consumer payloads
 * stay classifiable when category drops Google's suffix.
 */
export function familiesForGoogleType(
  primaryType: string | null | undefined,
): FamilyKey[] {
  if (!primaryType) return [];
  const slug = primaryType.trim().toLowerCase();
  if (!slug) return [];
  const direct = GOOGLE_TYPE_TO_FAMILIES[slug];
  if (direct) return direct;
  if (!slug.endsWith("_restaurant")) {
    return GOOGLE_TYPE_TO_FAMILIES[`${slug}_restaurant`] ?? [];
  }
  return [];
}

/** The primary (catalog-order first) family a Google type belongs to. */
export function familyForGoogleType(primaryType: string | null | undefined): FamilyKey | null {
  return familiesForGoogleType(primaryType)[0] ?? null;
}

type GeoOrigin = { lat: number; lng: number };

/** CLDR / ISO-3166-1 alpha-2. Empty = omit Google's optional country params. */
export function parseCldrRegionCode(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const c = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) ? c : "";
}

/**
 * Places (New): `regionCode` is optional (format + soft bias; Text Search has
 * no country restrict). Autocomplete may also send `includedRegionCodes` (hard
 * list; empty = no restrict). Callers pass this from the name searchbar.
 */
export function applyPlacesCallerRegion(
  body: Record<string, unknown>,
  raw: unknown,
  kind: "autocomplete" | "text",
): void {
  const code = parseCldrRegionCode(raw);
  if (!code) return;
  body.regionCode = code;
  if (kind === "autocomplete") body.includedRegionCodes = [code];
}

function circleAround(center: GeoOrigin, radiusKm: number) {
  return {
    circle: {
      center: { latitude: center.lat, longitude: center.lng },
      radius: Math.min(50_000, Math.max(1, radiusKm * 1000)),
    },
  };
}

function applyGuestLocationBias(
  body: Record<string, unknown>,
  origin?: GeoOrigin | null,
): void {
  if (!origin || !Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) {
    return;
  }
  body.locationBias = circleAround(
    { lat: origin.lat, lng: origin.lng },
    8,
  );
}

/** Autocomplete (New): guest pin bias only. */
export function applyPlacesAutocompleteRegion(
  body: Record<string, unknown>,
  origin?: GeoOrigin | null,
): void {
  applyGuestLocationBias(body, origin);
}

/** Text Search (New): guest pin bias only. */
export function applyPlacesTextSearchRegion(
  body: Record<string, unknown>,
  origin?: GeoOrigin | null,
): void {
  applyGuestLocationBias(body, origin);
}

export type EligibilityResult =
  | { eligible: true }
  | { eligible: false; code: string; reason: string };
