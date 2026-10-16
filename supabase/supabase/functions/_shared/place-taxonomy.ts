// Place family law. The guest catalog is twenty families (catalog-families.ts).
// Undefined is last and is not a carousel.
// A type may sit on more than one family when the trips are different.
// A precise rail takes the place off the broader one.
// The profiles view derives family_keys from the category dictionary.
// The base column stays null. A row that already carries the mapping wins,
// so a dictionary edit changes membership without a profile write.
// With no mapping on the row: Google type → Atlas slug → alias → ['undefined'].

import {
  CATALOG_FAMILIES,
  familiesForCatalogSlug,
  type FamilyKey,
} from "./catalog-families.ts";
import { GOOGLE_TYPE_SUPER } from "./google-type-super.ts";
import { familiesForGoogleType } from "./sourcing.ts";

export type { FamilyKey };

export const FAMILIES = CATALOG_FAMILIES;

const FAMILY_SLUGS = new Set<string>(FAMILIES.map((s) => s.slug));
const FAMILY_ORDER = new Map<FamilyKey, number>(
  FAMILIES.map((s) => [s.slug, s.sort_order]),
);

const ATLAS_COARSE: Readonly<Record<string, string>> = {
  mexican: "restaurants",
  taco: "restaurants",
  seafood: "restaurants",
  steak_house: "restaurants",
  italian: "restaurants",
  pizza: "restaurants",
  japanese: "restaurants",
  sushi: "restaurants",
  ramen: "restaurants",
  chinese: "restaurants",
  thai: "restaurants",
  korean: "restaurants",
  vietnamese: "restaurants",
  indian: "restaurants",
  middle_eastern: "restaurants",
  mediterranean: "restaurants",
  greek: "restaurants",
  spanish: "restaurants",
  french: "restaurants",
  american: "restaurants",
  argentinian: "restaurants",
  brazilian: "restaurants",
  peruvian: "restaurants",
  asian_fusion: "restaurants",
  burger: "restaurants",
  sandwich: "restaurants",
  bbq: "restaurants",
  breakfast: "restaurants",
  brunch: "restaurants",
  vegan: "restaurants",
  vegetarian: "restaurants",
  salad: "restaurants",
  fast_food: "restaurants",
  fine_dining: "restaurants",
  food_truck: "restaurants",
  food_hall: "restaurants",
  deli: "restaurants",
  cafe: "cafes_bakeries",
  coffee_shop: "cafes_bakeries",
  bakery: "cafes_bakeries",
  dessert_shop: "cafes_bakeries",
  ice_cream: "cafes_bakeries",
  juice_bar: "cafes_bakeries",
  board_game_cafe: "cafes_bakeries",
  bar: "bars_nightlife",
  pub: "bars_nightlife",
  cocktail_bar: "bars_nightlife",
  wine_bar: "bars_nightlife",
  brewery: "bars_nightlife",
  night_club: "bars_nightlife",
  karaoke: "bars_nightlife",
  casino: "bars_nightlife",
  winery: "bars_nightlife",
  bowling_alley: "experiences",
  escape_room: "experiences",
  arcade: "experiences",
  billiards: "experiences",
  park: "experiences",
  mini_golf: "experiences",
  laser_tag: "experiences",
  axe_throwing: "experiences",
  trampoline_park: "experiences",
  go_kart: "experiences",
  amusement_park: "experiences",
  water_park: "experiences",
  aquarium: "experiences",
  zoo: "experiences",
  observation_deck: "experiences",
  botanical_garden: "experiences",
  market: "experiences",
  movie_theater: "experiences",
  museum: "culture_arts",
  art_gallery: "culture_arts",
  theater: "culture_arts",
  concert_venue: "culture_arts",
  cultural_center: "culture_arts",
  padel_club: "sports_fitness",
  tennis_club: "sports_fitness",
  golf_course: "sports_fitness",
  soccer_field: "sports_fitness",
  swimming_pool: "sports_fitness",
  climbing_gym: "sports_fitness",
  gym: "sports_fitness",
  crossfit_box: "sports_fitness",
  yoga_studio: "sports_fitness",
  pilates_studio: "sports_fitness",
  dance_studio: "sports_fitness",
  martial_arts: "sports_fitness",
  spa: "wellness_beauty",
  temazcal: "wellness_beauty",
  hot_springs: "wellness_beauty",
  massage: "wellness_beauty",
  sauna: "wellness_beauty",
  wellness_center: "wellness_beauty",
  medical_spa: "wellness_beauty",
  barbershop: "wellness_beauty",
  hair_salon: "wellness_beauty",
  nail_salon: "wellness_beauty",
  beauty_salon: "wellness_beauty",
  tattoo_studio: "wellness_beauty",
  undefined: "undefined",
};

export const ATLAS_CATEGORY_FAMILIES: Readonly<Record<string, readonly FamilyKey[]>> =
  Object.fromEntries(
    Object.entries(ATLAS_COARSE).map(([slug, coarse]) => [
      slug,
      familiesForCatalogSlug(slug, coarse),
    ]),
  );

export function isFamilyKey(value: string): value is FamilyKey {
  return FAMILY_SLUGS.has(value);
}

/**
 * Unique valid families, catalog order, any count. A category may sit in
 * many families. `undefined` never rides along with a real family.
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
  return [...seen].sort(
    (a, b) => (FAMILY_ORDER.get(a) ?? 99) - (FAMILY_ORDER.get(b) ?? 99),
  );
}

/**
 * Guest family pills: unique catalog slugs, any count (OR). Not place
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
    (a, b) => (FAMILY_ORDER.get(a) ?? 99) - (FAMILY_ORDER.get(b) ?? 99),
  );
}

/**
 * The family of a category that is exactly a Google Table A type.
 * Null when the slug is not one of those types. The `_restaurant` alias
 * is not applied: a leftover Mesita slug such as `breakfast` is not
 * `breakfast_restaurant`.
 */
/** Catalog families when the category is exactly a Google Table A type. */
export function familiesForExactGoogle(
  category: string | null | undefined,
): FamilyKey[] | null {
  if (typeof category !== "string") return null;
  const slug = category.trim().toLowerCase();
  if (!slug) return null;
  const coarse = GOOGLE_TYPE_SUPER[slug];
  if (!coarse) return null;
  const families = familiesForCatalogSlug(slug, coarse);
  return families.length > 0 ? families : ["undefined"];
}

export function familiesForAtlasCategory(
  category: string | null | undefined,
): FamilyKey[] {
  if (!category) return [];
  const slug = category.trim().toLowerCase();
  if (!slug) return [];
  return sanitizeFamilyKeys(ATLAS_CATEGORY_FAMILIES[slug] ?? []);
}

export type FamilyPlace = {
  category?: string | null;
  family_keys?: unknown;
};

/**
 * Families for a place on the wire or in a predicate. TOTAL.
 * The mapping carried on the row wins. Otherwise an exact Google type,
 * then an Atlas slug, then the Google alias, then ['undefined'].
 */
export function familiesForPlace(place: FamilyPlace): FamilyKey[] {
  const category = typeof place.category === "string" ? place.category : null;
  const mapped = sanitizeFamilyKeys(place.family_keys);
  if (mapped.length > 0) return mapped;
  const exact = familiesForExactGoogle(category);
  if (exact) return exact;
  const atlas = familiesForAtlasCategory(category);
  if (atlas.length > 0) return atlas;
  const google = familiesForGoogleType(
    typeof place.category === "string" ? place.category : null,
  );
  if (google.length > 0) return google;
  return ["undefined"];
}

/**
 * After semantics infers both fields: a known Atlas category keeps its
 * FULL membership (1–2 families, including `undefined` → family undefined).
 * Inference fills family_keys only when the category has no membership
 * yet; when inference comes back empty too, ['undefined'] stands — the
 * write stays total, never null.
 */
export function resolveEnrichedFamilyKeys(
  category: string | null | undefined,
  inferred: unknown,
): FamilyKey[] {
  const exact = familiesForExactGoogle(category);
  if (exact) return exact;
  const membership = familiesForAtlasCategory(category);
  if (membership.length > 0) return membership;
  const sanitized = sanitizeFamilyKeys(inferred);
  if (sanitized.length > 0) return sanitized;
  return ["undefined"];
}
