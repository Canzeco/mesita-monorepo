// Atlas Super Category + Category law. Search map Filters cut on Super
// Category only. Super Categories PARTITION Mesita Categories and Google
// Table A types: each Category maps to exactly one Super; each Google type
// maps to exactly one Super (or `other`, which is not a guest pill).
// The six slugs here are the live catalog (`public.place_super_categories`)
// — keep this file lock-step with `seed_place_super_categories` /
// `seed_place_categories`. Google type expansion lives in
// `google-type-super.ts` (search batteries + the 478-type map).
//
// Places start with category='undefined' and family_keys NULL. Contents
// enrichment infers both. When the category is in Atlas, family_keys is
// that one Super. Stored keys only win when the category has no
// membership (undefined / leftover slugs). Else the Google primaryType
// map (pins + leftover slugs).

import {
  familiesForGoogleType,
  type FamilyKey,
} from "./sourcing.ts";

export type { FamilyKey };

export const SUPER_CATEGORIES: readonly {
  slug: FamilyKey;
  label: string;
  emoji: string;
  sort_order: number;
}[] = [
  { slug: "restaurants", label: "Restaurants", emoji: "🍽️", sort_order: 1 },
  { slug: "bars_nightlife", label: "Bars & Nightlife", emoji: "🍸", sort_order: 2 },
  { slug: "cafes_bakeries", label: "Cafés, Bakeries & Dessert", emoji: "☕", sort_order: 3 },
  { slug: "wellness_spa", label: "Wellness & Spa", emoji: "🧖", sort_order: 4 },
  { slug: "experiences", label: "Experiences & Activities", emoji: "🎟️", sort_order: 5 },
  { slug: "culture_arts", label: "Culture & Arts", emoji: "🎭", sort_order: 6 },
];

const SUPER_SLUGS = new Set<string>(SUPER_CATEGORIES.map((s) => s.slug));
const SUPER_ORDER = new Map<FamilyKey, number>(
  SUPER_CATEGORIES.map((s) => [s.slug, s.sort_order]),
);

const R = "restaurants" as const;
const N = "bars_nightlife" as const;
const C = "cafes_bakeries" as const;
const W = "wellness_spa" as const;
const E = "experiences" as const;
const A = "culture_arts" as const;

/** Atlas category slug → exactly one Super Category. `undefined` is omitted (= []). */
export const ATLAS_CATEGORY_SUPERS: Readonly<Record<string, readonly FamilyKey[]>> =
  {
    mexican: [R],
    taco: [R],
    seafood: [R],
    steak_house: [R],
    italian: [R],
    pizza: [R],
    japanese: [R],
    sushi: [R],
    ramen: [R],
    chinese: [R],
    thai: [R],
    korean: [R],
    vietnamese: [R],
    indian: [R],
    middle_eastern: [R],
    mediterranean: [R],
    greek: [R],
    spanish: [R],
    french: [R],
    american: [R],
    argentinian: [R],
    brazilian: [R],
    peruvian: [R],
    asian_fusion: [R],
    burger: [R],
    sandwich: [R],
    bbq: [R],
    breakfast: [R],
    brunch: [R],
    vegan: [R],
    vegetarian: [R],
    salad: [R],
    fast_food: [R],
    fine_dining: [R],
    food_truck: [R],
    food_hall: [R],
    deli: [R],
    cafe: [C],
    coffee_shop: [C],
    bakery: [C],
    dessert_shop: [C],
    ice_cream: [C],
    juice_bar: [C],
    bar: [N],
    pub: [N],
    cocktail_bar: [N],
    wine_bar: [N],
    brewery: [N],
    night_club: [N],
    bowling_alley: [E],
    karaoke: [N],
    escape_room: [E],
    arcade: [E],
    billiards: [E],
    board_game_cafe: [C],
    park: [E],
    mini_golf: [E],
    laser_tag: [E],
    axe_throwing: [E],
    trampoline_park: [E],
    go_kart: [E],
    movie_theater: [A],
    amusement_park: [E],
    water_park: [E],
    casino: [E],
    gym: [W],
    yoga_studio: [W],
    pilates_studio: [W],
    crossfit_box: [W],
    climbing_gym: [W],
    padel_club: [W],
    tennis_club: [W],
    golf_course: [W],
    soccer_field: [W],
    swimming_pool: [W],
    dance_studio: [W],
    martial_arts: [W],
    spa: [W],
    temazcal: [W],
    hot_springs: [W],
    massage: [W],
    sauna: [W],
    barbershop: [W],
    hair_salon: [W],
    nail_salon: [W],
    beauty_salon: [W],
    wellness_center: [W],
    tattoo_studio: [W],
    medical_spa: [W],
    museum: [A],
    art_gallery: [A],
    aquarium: [E],
    zoo: [E],
    observation_deck: [E],
    winery: [N],
    theater: [A],
    concert_venue: [A],
    botanical_garden: [E],
    cultural_center: [A],
    market: [E],
  };

export function isFamilyKey(value: string): value is FamilyKey {
  return SUPER_SLUGS.has(value);
}

/** Unique valid supers, catalog order, at most one (place membership). */
export function sanitizeFamilyKeys(raw: unknown): FamilyKey[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<FamilyKey>();
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const slug = v.trim().toLowerCase();
    if (isFamilyKey(slug)) seen.add(slug);
  }
  return [...seen]
    .sort((a, b) => (SUPER_ORDER.get(a) ?? 99) - (SUPER_ORDER.get(b) ?? 99))
    .slice(0, 1);
}

/**
 * Guest Super pills: unique catalog slugs, any count (OR). Not place
 * membership — a guest may select Restaurants and Wellness together.
 */
export function readGuestFamilyKeys(raw: unknown): FamilyKey[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<FamilyKey>();
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const slug = v.trim().toLowerCase();
    if (isFamilyKey(slug)) seen.add(slug);
  }
  return [...seen].sort(
    (a, b) => (SUPER_ORDER.get(a) ?? 99) - (SUPER_ORDER.get(b) ?? 99),
  );
}

export function familiesForAtlasCategory(
  category: string | null | undefined,
): FamilyKey[] {
  if (!category) return [];
  const slug = category.trim().toLowerCase();
  if (!slug || slug === "undefined") return [];
  return sanitizeFamilyKeys(ATLAS_CATEGORY_SUPERS[slug] ?? []);
}

export type FamilyPlace = {
  category?: string | null;
  family_keys?: unknown;
};

/**
 * Super Category for a place on the wire or in a predicate.
 * Atlas membership wins when the category is in the catalog. Stored keys
 * win only when membership is empty (undefined / leftover). Else the
 * Google primaryType map (Nearby pins).
 */
export function familiesForPlace(place: FamilyPlace): FamilyKey[] {
  const atlas = familiesForAtlasCategory(
    typeof place.category === "string" ? place.category : null,
  );
  if (atlas.length > 0) return atlas;
  const stored = sanitizeFamilyKeys(place.family_keys);
  if (stored.length > 0) return stored;
  return familiesForGoogleType(
    typeof place.category === "string" ? place.category : null,
  );
}

/**
 * After semantics infers both fields: a known Atlas category keeps its
 * one Super. Inference only fills family_keys when the category has no
 * membership yet (undefined / unknown).
 */
export function resolveEnrichedFamilyKeys(
  category: string | null | undefined,
  inferred: unknown,
): FamilyKey[] {
  const membership = familiesForAtlasCategory(category);
  if (membership.length > 0) return membership;
  return sanitizeFamilyKeys(inferred);
}
