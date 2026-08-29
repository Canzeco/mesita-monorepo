// Atlas Super Category + Category law. Search map Filters cut on Super
// Category only. THE LAW (2026-08-29, final):
//   · Eight Super Categories: seven real guest pills + `undefined`
//     (label "Undefined", ❓), the leftover/create-path bucket — always last.
//   · CATEGORY side is MULTI-PARENT: each Mesita category belongs to one
//     or TWO supers (breakfast is restaurants AND cafés; karaoke is bars
//     AND experiences). Never more than two; `undefined` only ever alone.
//   · GOOGLE side is EXCLUSIVE: every Table A type maps to exactly one
//     super or `other` (google-type-super.ts owns that map + batteries).
//   · family_keys is TOTAL: every place resolves to at least one super —
//     Atlas membership → stored keys → Google type map → ['undefined'].
//     No place is ever pill-less.
// The eight slugs here are the live catalog (`public.place_super_categories`)
// — keep this file lock-step with `seed_place_super_categories` /
// `seed_place_categories`.
//
// Places start with category='undefined' and family_keys=['undefined'].
// Contents enrichment infers a classified Category; family_keys becomes
// that category's FULL membership (1–2 keys). While category stays
// `undefined`, the classifier may infer 1–2 supers directly; failing
// that, ['undefined'] stands. Super `undefined` is not Google `other`
// (hotels/shops stay ineligible).

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
  { slug: "cafes_bakeries", label: "Cafés & Desserts", emoji: "☕", sort_order: 2 },
  { slug: "bars_nightlife", label: "Bars & Nightlife", emoji: "🍸", sort_order: 3 },
  { slug: "experiences", label: "Experiences", emoji: "🎟️", sort_order: 4 },
  { slug: "culture_arts", label: "Culture & Arts", emoji: "🎭", sort_order: 5 },
  { slug: "sports_fitness", label: "Sports & Fitness", emoji: "⚽", sort_order: 6 },
  { slug: "wellness_beauty", label: "Wellness & Beauty", emoji: "💆", sort_order: 7 },
  { slug: "undefined", label: "Undefined", emoji: "❓", sort_order: 999 },
];

const SUPER_SLUGS = new Set<string>(SUPER_CATEGORIES.map((s) => s.slug));
const SUPER_ORDER = new Map<FamilyKey, number>(
  SUPER_CATEGORIES.map((s) => [s.slug, s.sort_order]),
);

const R = "restaurants" as const;
const N = "bars_nightlife" as const;
const C = "cafes_bakeries" as const;
const E = "experiences" as const;
const A = "culture_arts" as const;
const S = "sports_fitness" as const;
const W = "wellness_beauty" as const;
const U = "undefined" as const;

/**
 * Atlas category slug → 1–2 Super Categories (multi-parent). The seven
 * doubles: breakfast, brunch (R+C) · karaoke, casino, winery (N+E) ·
 * board_game_cafe (C+E) · movie_theater (A+E).
 */
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
    breakfast: [R, C],
    brunch: [R, C],
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
    board_game_cafe: [C, E],
    bar: [N],
    pub: [N],
    cocktail_bar: [N],
    wine_bar: [N],
    brewery: [N],
    night_club: [N],
    karaoke: [N, E],
    casino: [N, E],
    winery: [N, E],
    bowling_alley: [E],
    escape_room: [E],
    arcade: [E],
    billiards: [E],
    park: [E],
    mini_golf: [E],
    laser_tag: [E],
    axe_throwing: [E],
    trampoline_park: [E],
    go_kart: [E],
    amusement_park: [E],
    water_park: [E],
    aquarium: [E],
    zoo: [E],
    observation_deck: [E],
    botanical_garden: [E],
    market: [E],
    movie_theater: [A, E],
    museum: [A],
    art_gallery: [A],
    theater: [A],
    concert_venue: [A],
    cultural_center: [A],
    padel_club: [S],
    tennis_club: [S],
    golf_course: [S],
    soccer_field: [S],
    swimming_pool: [S],
    climbing_gym: [S],
    gym: [S],
    crossfit_box: [S],
    yoga_studio: [S],
    pilates_studio: [S],
    dance_studio: [S],
    martial_arts: [S],
    spa: [W],
    temazcal: [W],
    hot_springs: [W],
    massage: [W],
    sauna: [W],
    wellness_center: [W],
    medical_spa: [W],
    barbershop: [W],
    hair_salon: [W],
    nail_salon: [W],
    beauty_salon: [W],
    tattoo_studio: [W],
    undefined: [U],
  };

export function isFamilyKey(value: string): value is FamilyKey {
  return SUPER_SLUGS.has(value);
}

/**
 * Unique valid supers, catalog order, at most TWO (place membership).
 * `undefined` never rides along with a real super — real supers win.
 */
export function sanitizeFamilyKeys(raw: unknown): FamilyKey[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<FamilyKey>();
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const slug = v.trim().toLowerCase();
    if (isFamilyKey(slug)) seen.add(slug);
  }
  if (seen.size > 1) seen.delete("undefined");
  return [...seen]
    .sort((a, b) => (SUPER_ORDER.get(a) ?? 99) - (SUPER_ORDER.get(b) ?? 99))
    .slice(0, 2);
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
  if (!slug) return [];
  return sanitizeFamilyKeys(ATLAS_CATEGORY_SUPERS[slug] ?? []);
}

export type FamilyPlace = {
  category?: string | null;
  family_keys?: unknown;
};

/**
 * Super Categories for a place on the wire or in a predicate. TOTAL:
 * Atlas membership (1–2) wins when the category is in the catalog; stored
 * keys win when membership is empty (leftover slugs); else the Google
 * primaryType map (Nearby pins); else ['undefined'] — every place lands
 * under at least one pill, always.
 */
export function familiesForPlace(place: FamilyPlace): FamilyKey[] {
  const atlas = familiesForAtlasCategory(
    typeof place.category === "string" ? place.category : null,
  );
  if (atlas.length > 0) return atlas;
  const stored = sanitizeFamilyKeys(place.family_keys);
  if (stored.length > 0) return stored;
  const google = familiesForGoogleType(
    typeof place.category === "string" ? place.category : null,
  );
  if (google.length > 0) return google;
  return ["undefined"];
}

/**
 * After semantics infers both fields: a known Atlas category keeps its
 * FULL membership (1–2 supers, including `undefined` → Super undefined).
 * Inference fills family_keys only when the category has no membership
 * yet; when inference comes back empty too, ['undefined'] stands — the
 * write stays total, never null.
 */
export function resolveEnrichedFamilyKeys(
  category: string | null | undefined,
  inferred: unknown,
): FamilyKey[] {
  const membership = familiesForAtlasCategory(category);
  if (membership.length > 0) return membership;
  const sanitized = sanitizeFamilyKeys(inferred);
  if (sanitized.length > 0) return sanitized;
  return ["undefined"];
}
