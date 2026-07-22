// Place families — the six "super categories" every Mesita place rolls up to.
//
// NOT mock data: the family KEYS are a live product contract, mirrored in
//   · apps/web-admin/src/app/(app)/sourcing-config/catalog.ts  (FAMILIES — authoring UI)
//   · supabase/functions/_shared/sourcing.ts                   (the enforcement gate)
//   · supabase/migrations/20260708120000_sourcing_config.sql   (the default policy)
//   · FAMILY_GOOGLE_TYPES below                                (discovery-filter roll-up)
// Keep all five in lock-step. Anything outside these families is ineligible for
// Mesita altogether — that's how hotels, schools, shops and transit stay out.
//
// The googleTypes mirror below exists ONLY so the discovery filters
// (MESITA-646) can roll a place's category up to its family client-side; it
// dies the day the consumer list EFs attach a computed `family` to place
// payloads (follow-up on MESITA-646).

export type FamilyKey =
  | "restaurants"
  | "bars_nightlife"
  | "cafes_bakeries"
  | "wellness_spa"
  | "experiences"
  | "culture_arts";

export type PlaceFamily = {
  key: FamilyKey;
  label: string;
  emoji: string;
};

export const PLACE_FAMILIES: PlaceFamily[] = [
  { key: "restaurants", label: "Restaurants", emoji: "🍽️" },
  { key: "bars_nightlife", label: "Bars & Nightlife", emoji: "🍸" },
  { key: "cafes_bakeries", label: "Cafés, Bakeries & Dessert", emoji: "☕" },
  { key: "wellness_spa", label: "Wellness & Spa", emoji: "🧖" },
  { key: "experiences", label: "Experiences & Activities", emoji: "🎟️" },
  { key: "culture_arts", label: "Culture & Arts", emoji: "🎭" },
];

// Mirror of _shared/sourcing.ts FAMILY_GOOGLE_TYPES (see header). places.category
// holds Google-primaryType-style slugs (e.g. "night_club", "cocktail_bar"), so
// family membership is containment in the family's type expansion. A type can
// belong to TWO families (e.g. "gastropub" is restaurants AND bars_nightlife —
// MESITA-631), hence the list return.
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

/**
 * Families a category slug belongs to; [] when unknown. The `_restaurant`
 * alias covers taxonomy slugs that drop Google's suffix (fine_dining →
 * fine_dining_restaurant). Unknown categories match NO family, so a family
 * filter honestly excludes places we can't classify.
 */
export function familyKeysOfCategory(
  category: string | null | undefined,
): FamilyKey[] {
  if (!category) return [];
  const slug = category.trim().toLowerCase();
  if (!slug) return [];
  const out: FamilyKey[] = [];
  for (const family of PLACE_FAMILIES) {
    const types = FAMILY_GOOGLE_TYPES[family.key];
    if (types.includes(slug) || types.includes(`${slug}_restaurant`)) {
      out.push(family.key);
    }
  }
  return out;
}
