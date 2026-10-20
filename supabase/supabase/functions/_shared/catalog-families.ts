// The guest catalog is these fifteen families. Not fourteen, not sixteen.
// Undefined is the leftover and is not a rail.
//
// SCOPE (MESITA-2438, Pato 2026-10-19: "This is not Tudu, is Mesita. More
// OpenTable scope."): a family holds places a guest books a table at or
// orders at — food, coffee, bars, nightlife — plus the two wellness and
// sport rails. Tourist attractions, museums, parks, zoos, bowling, cinemas
// and every similar attraction sit in NO family (`ATTRACTION_TYPES`).
//
// PRIMARY AND SECONDARY. A Google type's row below lists its families
// PRIMARY FIRST: a cafe is Coffee first, Breakfast second; a brewpub is
// Drinks first, Dinner second. A place's primary family is its Google
// `primaryType`'s first family; its secondary families (0–2) are the
// rest of that row plus the primary families of its other Google `types`
// (`placeFamilies` in sourcing.ts). A family row lists primary places
// first and secondary ones as fill.
//
// A Google type sits on a family only when that rail is a different trip.
// A precise rail takes the type off the broader one: a pizzeria is Pizza,
// not also Dinner. A cafe is Coffee and Breakfast, because those are two trips.
//
// Many Google categories sit in NO family, and that is the right answer, not
// a gap: a mechanic, a church, a hotel, a plaza, a cafeteria, a museum. They
// are stored as `undefined`, never shown on a guest surface, and never forced
// onto the nearest rail (MESITA-2382, MESITA-2438).

export const CATALOG_FAMILY_SLUGS = [
  "coffee",
  "breakfast",
  "quick_bite",
  "pizza",
  "tacos",
  "sushi",
  "burgers",
  "noodles",
  "dinner",
  "sweet",
  "drinks",
  "night_out",
  "go_out",
  "move",
  "feel_better",
] as const;

export type CatalogFamilySlug = (typeof CATALOG_FAMILY_SLUGS)[number];
export type FamilyKey = CatalogFamilySlug | "undefined";

export const CATALOG_FAMILIES: readonly {
  slug: FamilyKey;
  label: string;
  emoji: string;
  sort_order: number;
}[] = [
  { slug: "coffee", label: "Coffee", emoji: "☕", sort_order: 1 },
  { slug: "breakfast", label: "Breakfast", emoji: "🥐", sort_order: 2 },
  { slug: "quick_bite", label: "Quick bite", emoji: "🥙", sort_order: 3 },
  { slug: "pizza", label: "Pizza", emoji: "🍕", sort_order: 4 },
  { slug: "tacos", label: "Tacos", emoji: "🌮", sort_order: 5 },
  { slug: "sushi", label: "Sushi", emoji: "🍣", sort_order: 6 },
  { slug: "burgers", label: "Burgers", emoji: "🍔", sort_order: 7 },
  { slug: "noodles", label: "Noodles", emoji: "🍜", sort_order: 8 },
  { slug: "dinner", label: "Dinner", emoji: "🍝", sort_order: 9 },
  { slug: "sweet", label: "Sweet", emoji: "🍰", sort_order: 10 },
  { slug: "drinks", label: "Drinks", emoji: "🍸", sort_order: 11 },
  { slug: "night_out", label: "Night out", emoji: "🌙", sort_order: 12 },
  { slug: "go_out", label: "Go out", emoji: "🎟️", sort_order: 13 },
  { slug: "move", label: "Move", emoji: "🏃", sort_order: 14 },
  { slug: "feel_better", label: "Feel better", emoji: "💆", sort_order: 15 },
  { slug: "undefined", label: "Undefined", emoji: "·", sort_order: 999 },
];

const FAMILY_SET = new Set<string>(CATALOG_FAMILIES.map((f) => f.slug));

export function isCatalogFamily(value: string): value is FamilyKey {
  return FAMILY_SET.has(value);
}

/** Each rail's lead Google type: first in its Nearby battery, so the
 *  every-family battery (round-robin, capped at 50) always carries it. The
 *  full battery is derived from the Table A map (`GOOGLE_SEARCH_TYPES`,
 *  google-type-super.ts). */
export const CATALOG_LEAD_TYPES: Record<CatalogFamilySlug, string> = {
  coffee: "cafe",
  breakfast: "breakfast_restaurant",
  quick_bite: "fast_food_restaurant",
  pizza: "pizza_restaurant",
  tacos: "mexican_restaurant",
  sushi: "sushi_restaurant",
  burgers: "hamburger_restaurant",
  noodles: "ramen_restaurant",
  dinner: "restaurant",
  sweet: "bakery",
  drinks: "bar",
  night_out: "night_club",
  go_out: "karaoke",
  move: "gym",
  feel_better: "spa",
};

/**
 * Attractions: places a guest visits, not a table they book or an order
 * they place (MESITA-2438). Every one sits in no family; the migration
 * `20261020000000_families_opentable_scope.sql` moves the stored mapping
 * with them, and `catalog-families.test.ts` pins the pair.
 */
export const ATTRACTION_TYPES = [
  "amphitheatre",
  "amusement_center",
  "amusement_park",
  "aquarium",
  "arcade",
  "arena",
  "art_gallery",
  "art_museum",
  "art_studio",
  "auditorium",
  "axe_throwing",
  "botanical_garden",
  "bowling_alley",
  "casino",
  "castle",
  "childrens_camp",
  "city_park",
  "concert_hall",
  "concert_venue",
  "cultural_center",
  "cultural_landmark",
  "cycling_park",
  "farmers_market",
  "ferris_wheel",
  "flea_market",
  "garden",
  "go_kart",
  "go_karting_venue",
  "hiking_area",
  "historical_landmark",
  "historical_place",
  "history_museum",
  "indoor_playground",
  "laser_tag",
  "market",
  "mini_golf",
  "miniature_golf_course",
  "monument",
  "movie_theater",
  "museum",
  "national_park",
  "observation_deck",
  "opera_house",
  "paintball_center",
  "park",
  "performing_arts_theater",
  "philharmonic_hall",
  "planetarium",
  "playground",
  "roller_coaster",
  "ski_resort",
  "stadium",
  "state_park",
  "theater",
  "tourist_attraction",
  "trampoline_park",
  "video_arcade",
  "water_park",
  "wildlife_park",
  "zoo",
] as const;

const EXPLICIT: Record<string, readonly FamilyKey[]> = {
  cafe: ["coffee", "breakfast"],
  coffee_shop: ["coffee", "breakfast"],
  cat_cafe: ["coffee", "breakfast"],
  dog_cafe: ["coffee", "breakfast"],
  coffee_roastery: ["coffee"],
  coffee_stand: ["coffee"],
  tea_house: ["coffee"],
  juice_shop: ["coffee"],
  juice_bar: ["coffee"],
  acai_shop: ["sweet"],
  breakfast_restaurant: ["breakfast"],
  brunch_restaurant: ["breakfast"],
  diner: ["breakfast"],
  bagel_shop: ["breakfast"],
  breakfast: ["breakfast"],
  brunch: ["breakfast"],
  bakery: ["sweet", "breakfast"],
  pastry_shop: ["sweet", "breakfast"],
  donut_shop: ["sweet", "breakfast"],
  cake_shop: ["sweet"],
  candy_store: ["sweet"],
  chocolate_factory: ["sweet"],
  chocolate_shop: ["sweet"],
  confectionery: ["sweet"],
  dessert_restaurant: ["sweet"],
  dessert_shop: ["sweet"],
  ice_cream_shop: ["sweet"],
  ice_cream: ["sweet"],
  pizza_restaurant: ["pizza"],
  pizza_delivery: ["pizza"],
  pizza: ["pizza"],
  taco_restaurant: ["tacos"],
  burrito_restaurant: ["tacos"],
  mexican_restaurant: ["tacos"],
  tex_mex_restaurant: ["tacos"],
  mexican: ["tacos"],
  taco: ["tacos"],
  sushi_restaurant: ["sushi"],
  japanese_restaurant: ["sushi"],
  japanese: ["sushi"],
  sushi: ["sushi"],
  hamburger_restaurant: ["burgers"],
  burger: ["burgers"],
  ramen_restaurant: ["noodles"],
  noodle_shop: ["noodles"],
  dumpling_restaurant: ["noodles"],
  chinese_noodle_restaurant: ["noodles"],
  ramen: ["noodles"],
  fast_food_restaurant: ["quick_bite"],
  sandwich_shop: ["quick_bite"],
  kebab_shop: ["quick_bite"],
  shawarma_restaurant: ["quick_bite"],
  hot_dog_restaurant: ["quick_bite"],
  hot_dog_stand: ["quick_bite"],
  falafel_restaurant: ["quick_bite"],
  snack_bar: ["quick_bite"],
  food_court: ["quick_bite"],
  meal_takeaway: ["quick_bite"],
  deli: ["quick_bite"],
  salad_shop: ["quick_bite"],
  gyro_restaurant: ["quick_bite"],
  sandwich: ["quick_bite"],
  salad: ["quick_bite"],
  fast_food: ["quick_bite"],
  food_truck: ["quick_bite"],
  food_hall: ["quick_bite"],
  wine_bar: ["drinks"],
  winery: ["drinks"],
  vineyard: ["drinks"],
  brewpub: ["drinks", "dinner"],
  gastropub: ["drinks", "dinner"],
  bar_and_grill: ["drinks", "dinner"],
  japanese_izakaya_restaurant: ["drinks", "dinner"],
  bar: ["drinks"],
  pub: ["drinks"],
  cocktail_bar: ["drinks"],
  lounge_bar: ["drinks"],
  brewery: ["drinks"],
  beer_garden: ["drinks"],
  irish_pub: ["drinks"],
  sports_bar: ["drinks"],
  hookah_bar: ["drinks"],
  night_club: ["night_out"],
  dance_hall: ["night_out"],
  karaoke: ["night_out", "go_out"],
  comedy_club: ["night_out"],
  live_music_venue: ["night_out"],
  escape_room: ["go_out"],
  billiards: ["go_out"],
  board_game_cafe: ["coffee", "go_out"],
  // No family (MESITA-2382): a place, not a trip a guest picks.
  ...Object.fromEntries(ATTRACTION_TYPES.map((t) => [t, ["undefined"] as const])),
  athletic_field: ["undefined"],
  barbecue_area: ["undefined"],
  beautician: ["undefined"],
  body_art_service: ["undefined"],
  cafeteria: ["undefined"],
  dog_park: ["undefined"],
  fishing_charter: ["undefined"],
  fishing_pier: ["undefined"],
  fishing_pond: ["undefined"],
  foot_care: ["undefined"],
  fountain: ["undefined"],
  makeup_artist: ["undefined"],
  marina: ["undefined"],
  meal_delivery: ["undefined"],
  off_roading_area: ["undefined"],
  picnic_ground: ["undefined"],
  plaza: ["undefined"],
  race_course: ["undefined"],
  sculpture: ["undefined"],
  skin_care_clinic: ["undefined"],
  tanning_studio: ["undefined"],
  visitor_center: ["undefined"],
  wildlife_refuge: ["undefined"],
  banquet_hall: ["undefined"],
  community_center: ["undefined"],
  convention_center: ["undefined"],
  event_venue: ["undefined"],
  wedding_venue: ["undefined"],
  internet_cafe: ["undefined"],
  movie_rental: ["undefined"],
  gym: ["move"],
  fitness_center: ["move"],
  yoga_studio: ["move"],
  sports_club: ["move"],
  sports_coaching: ["move"],
  sports_complex: ["move"],
  sports_school: ["move"],
  sports_activity_location: ["move"],
  golf_course: ["move"],
  indoor_golf_course: ["move"],
  ice_skating_rink: ["move"],
  swimming_pool: ["move"],
  tennis_court: ["move"],
  adventure_sports_center: ["move"],
  skateboard_park: ["move"],
  padel_club: ["move"],
  tennis_club: ["move"],
  soccer_field: ["move"],
  climbing_gym: ["move"],
  crossfit_box: ["move"],
  pilates_studio: ["move"],
  dance_studio: ["move"],
  martial_arts: ["move"],
  spa: ["feel_better"],
  massage: ["feel_better"],
  massage_spa: ["feel_better"],
  sauna: ["feel_better"],
  wellness_center: ["feel_better"],
  beauty_salon: ["feel_better"],
  hair_salon: ["feel_better"],
  hair_care: ["feel_better"],
  nail_salon: ["feel_better"],
  barber_shop: ["feel_better"],
  barbershop: ["feel_better"],
  temazcal: ["feel_better"],
  hot_springs: ["feel_better"],
  medical_spa: ["feel_better"],
  tattoo_studio: ["feel_better"],
  undefined: ["undefined"],
};

const COARSE_FALLBACK: Record<string, FamilyKey> = {
  restaurants: "dinner",
  bars_nightlife: "drinks",
  cafes_bakeries: "coffee",
  sports_fitness: "move",
  wellness_beauty: "feel_better",
  // Attractions (MESITA-2438): an unlisted culture or experiences type is
  // not a trip Mesita lists.
  culture_arts: "undefined",
  experiences: "undefined",
  undefined: "undefined",
};

const ORDER = new Map(CATALOG_FAMILIES.map((f) => [f.slug, f.sort_order]));

function inOrder(keys: readonly FamilyKey[]): FamilyKey[] {
  return [...keys].sort((a, b) => (ORDER.get(a) ?? 99) - (ORDER.get(b) ?? 99));
}

/**
 * Families for one Google type, or one leftover Mesita slug that shares
 * the name. `coarse` is the old exclusive family, used only when this
 * slug has no explicit trip. Null coarse and no explicit row → empty,
 * so an unknown slug does not invent a rail.
 */
export function familiesForCatalogSlug(
  slug: string,
  coarse: string | null,
): FamilyKey[] {
  const explicit = EXPLICIT[slug];
  if (explicit) return inOrder(explicit);
  if (!coarse) return [];
  const fallback = COARSE_FALLBACK[coarse];
  return fallback ? [fallback] : [];
}

/**
 * The families for one slug, PRIMARY FIRST (the row's own order, not the
 * catalog's). Same lookup as `familiesForCatalogSlug`.
 */
export function familiesPrimaryFirst(
  slug: string,
  coarse: string | null,
): FamilyKey[] {
  const explicit = EXPLICIT[slug];
  if (explicit) return [...explicit];
  if (!coarse) return [];
  const fallback = COARSE_FALLBACK[coarse];
  return fallback ? [fallback] : [];
}
