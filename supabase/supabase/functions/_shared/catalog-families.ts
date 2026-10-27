// The guest catalog is these forty families. Undefined is the leftover
// and is not a rail. A type may sit in several families: a list, never a
// primary and a secondary (MESITA-2808).
//
// FORTY (MESITA-2888, Pato 2026-10-27: "do the list 40 items long. try as
// cover as much area as possible. i don't care if there are a bit overlaps",
// "we can add more type of businesses, not only restaurants", "for example
// top golf??? … Maybe add the experience family", "rethink all the 40
// families" → "Great. Its okey."). The fifty of MESITA-2834 fold sixteen
// narrow food rails into their parent (Brunch → Breakfast, Gelato → Dessert,
// Vegan → Healthy, Sandwich → Quick, Wings → Chicken, Kebab → Arabic, BBQ →
// Steak, Ramen → Japanese, Noodles and Dumpling → Chinese, Korean and Thai →
// Asian, Greek → Arabic, Spanish and French → European, Latin → Dinner) and
// six rails join past the table: Family, Fun, Cinema, Casino, Spa, Tourist.
// The order is a day arc — coffee to tourist — morning, anytime, dinner,
// drinks, night, out; Monterrey's favorites first inside a phase.
//
// ONE WORD (MESITA-2760, Pato 2026-10-25: "families must be one-word long"),
// AND A SHORT ONE (MESITA-2841, Pato 2026-10-26: "make word shorter"): every
// label is one word of at most nine letters, the widest Home's column draws
// on one line; stored keys never follow a label (`quick_bite` reads Quick,
// `sweet` Dessert, `chicken` Wings, `drinks` Bar, `night_out` Night,
// `nightclub` Club).
//
// A DICTIONARY, NOT A MODEL (MESITA-2834, Pato 2026-10-26: "Mesita Families
// (not editable, directly infered with dictionary based on canonic google
// categories)"): a place's families are every family of its Google
// categories through this map, derived in the profiles view
// (place_family_keys → families_for_categories). No model picks them and no
// editor saves them; the map itself is edited on Atlas (catalog_membership).
//
// SCOPE (MESITA-2888 reverses MESITA-2438's OpenTable scope and MESITA-2468's
// "no spas"): attractions, fun venues, cinemas, casinos, spas and the sights
// a visitor sees are rails now. What still sits in NO family is the not-social
// rest — gyms, courts, studios, salons, barbers, tattoo — and every hotel,
// shop, office, service and transit stop (`NO_FAMILY_TYPES`, MESITA-2382).
// Sports is sports bars and stadiums — watching the game is social; a gym is
// not.
//
// ONE NIGHT RAIL (MESITA-2486, Pato 2026-10-19: "merge"): Go out folded
// into Night out (now labelled Night). Nightclub, Karaoke, Music and Hookah
// are the sharper night rails inside it (MESITA-2834); Fun holds what a
// group does with its hands — bowling, arcades, karts, escape rooms,
// billiards, Topgolf (MESITA-2888).
//
// A LIST, NOT A RANK (MESITA-2808, Pato 2026-10-26: "one category maps to
// families, but not like primary families nor secondary families, just a
// list of families"). Each Google category has its own emoji, so no family
// has to stand for it. A row below names a type's families; their order
// means nothing and every reader gets them in the catalog's family order.
// A place's families are every family of its categories (`placeFamilies`
// in sourcing.ts; the profiles view for a Mesita place).
//
// A Google type sits on a family only when that rail is a different trip.
// A pizzeria is Pizza and Italian; a taqueria is Tacos, Mexican and Quick.
// Dinner is the wide table, worn by every sit-down cuisine. Arabic is what
// Monterrey calls the Levant ("comida árabe"), and since MESITA-2888 the
// whole Mediterranean shore east of Italy sits there too.
//
// Many Google categories sit in NO family, and that is the right answer, not
// a gap: a mechanic, a church, a hotel, a gym, a supermarket. They are stored
// as `undefined`, never shown on a guest surface, and never forced onto the
// nearest rail (MESITA-2382).

export const CATALOG_FAMILY_SLUGS = [
  "coffee",
  "breakfast",
  "bakery",
  "sweet",
  "healthy",
  "quick_bite",
  "tacos",
  "burgers",
  "pizza",
  "chicken",
  "sushi",
  "mexican",
  "steak",
  "seafood",
  "italian",
  "japanese",
  "chinese",
  "asian",
  "indian",
  "arabic",
  "european",
  "american",
  "dinner",
  "fancy",
  "family",
  "drinks",
  "beer",
  "cocktails",
  "wine",
  "sports",
  "hookah",
  "night_out",
  "nightclub",
  "music",
  "karaoke",
  "fun",
  "cinema",
  "casino",
  "spa",
  "tourist",
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
  { slug: "breakfast", label: "Breakfast", emoji: "🍳", sort_order: 2 },
  { slug: "bakery", label: "Bakery", emoji: "🥐", sort_order: 3 },
  { slug: "sweet", label: "Dessert", emoji: "🍰", sort_order: 4 },
  { slug: "healthy", label: "Healthy", emoji: "🥗", sort_order: 5 },
  { slug: "quick_bite", label: "Quick", emoji: "⚡", sort_order: 6 },
  { slug: "tacos", label: "Tacos", emoji: "🌮", sort_order: 7 },
  { slug: "burgers", label: "Burgers", emoji: "🍔", sort_order: 8 },
  { slug: "pizza", label: "Pizza", emoji: "🍕", sort_order: 9 },
  { slug: "chicken", label: "Wings", emoji: "🍗", sort_order: 10 },
  { slug: "sushi", label: "Sushi", emoji: "🍣", sort_order: 11 },
  { slug: "mexican", label: "Mexican", emoji: "🌶️", sort_order: 12 },
  { slug: "steak", label: "Steak", emoji: "🥩", sort_order: 13 },
  { slug: "seafood", label: "Seafood", emoji: "🦐", sort_order: 14 },
  { slug: "italian", label: "Italian", emoji: "🍝", sort_order: 15 },
  { slug: "japanese", label: "Japanese", emoji: "🍱", sort_order: 16 },
  { slug: "chinese", label: "Chinese", emoji: "🥡", sort_order: 17 },
  { slug: "asian", label: "Asian", emoji: "🍥", sort_order: 18 },
  { slug: "indian", label: "Indian", emoji: "🍛", sort_order: 19 },
  { slug: "arabic", label: "Arabic", emoji: "🧆", sort_order: 20 },
  { slug: "european", label: "European", emoji: "🥨", sort_order: 21 },
  { slug: "american", label: "American", emoji: "🍟", sort_order: 22 },
  { slug: "dinner", label: "Dinner", emoji: "🍽️", sort_order: 23 },
  { slug: "fancy", label: "Fancy", emoji: "🥂", sort_order: 24 },
  { slug: "family", label: "Family", emoji: "👨‍👩‍👧", sort_order: 25 },
  { slug: "drinks", label: "Bar", emoji: "🍻", sort_order: 26 },
  { slug: "beer", label: "Beer", emoji: "🍺", sort_order: 27 },
  { slug: "cocktails", label: "Cocktails", emoji: "🍸", sort_order: 28 },
  { slug: "wine", label: "Wine", emoji: "🍷", sort_order: 29 },
  { slug: "sports", label: "Sports", emoji: "📺", sort_order: 30 },
  { slug: "hookah", label: "Hookah", emoji: "💨", sort_order: 31 },
  { slug: "night_out", label: "Night", emoji: "🌙", sort_order: 32 },
  { slug: "nightclub", label: "Club", emoji: "🪩", sort_order: 33 },
  { slug: "music", label: "Music", emoji: "🎶", sort_order: 34 },
  { slug: "karaoke", label: "Karaoke", emoji: "🎤", sort_order: 35 },
  { slug: "fun", label: "Fun", emoji: "🎯", sort_order: 36 },
  { slug: "cinema", label: "Cinema", emoji: "🎬", sort_order: 37 },
  { slug: "casino", label: "Casino", emoji: "🎰", sort_order: 38 },
  { slug: "spa", label: "Spa", emoji: "🧖", sort_order: 39 },
  { slug: "tourist", label: "Tourist", emoji: "🏛️", sort_order: 40 },
  { slug: "undefined", label: "Undefined", emoji: "·", sort_order: 999 },
];

const FAMILY_SET = new Set<string>(CATALOG_FAMILIES.map((f) => f.slug));

export function isCatalogFamily(value: string): value is FamilyKey {
  return FAMILY_SET.has(value);
}

/** Each rail's lead Google type: first in its Nearby battery, so the
 *  every-family battery (round-robin, capped at 50) always carries it. Forty
 *  families, forty distinct leads, ten slots to spare inside Google's cap.
 *  The full battery is derived from the Table A map (`GOOGLE_SEARCH_TYPES`,
 *  google-type-super.ts). */
export const CATALOG_LEAD_TYPES: Record<CatalogFamilySlug, string> = {
  coffee: "cafe",
  breakfast: "breakfast_restaurant",
  bakery: "bakery",
  sweet: "dessert_shop",
  healthy: "salad_shop",
  quick_bite: "fast_food_restaurant",
  tacos: "taco_restaurant",
  burgers: "hamburger_restaurant",
  pizza: "pizza_restaurant",
  chicken: "chicken_wings_restaurant",
  sushi: "sushi_restaurant",
  mexican: "mexican_restaurant",
  steak: "steak_house",
  seafood: "seafood_restaurant",
  italian: "italian_restaurant",
  japanese: "japanese_restaurant",
  chinese: "chinese_restaurant",
  asian: "asian_restaurant",
  indian: "indian_restaurant",
  arabic: "middle_eastern_restaurant",
  european: "european_restaurant",
  american: "american_restaurant",
  dinner: "restaurant",
  fancy: "fine_dining_restaurant",
  family: "family_restaurant",
  drinks: "bar",
  beer: "brewery",
  cocktails: "cocktail_bar",
  wine: "wine_bar",
  sports: "sports_bar",
  hookah: "hookah_bar",
  night_out: "dance_hall",
  nightclub: "night_club",
  music: "live_music_venue",
  karaoke: "karaoke",
  fun: "bowling_alley",
  cinema: "movie_theater",
  casino: "casino",
  spa: "spa",
  tourist: "tourist_attraction",
};

/**
 * Not social, still (MESITA-2468, kept by MESITA-2888): the sport, fitness
 * and beauty places a guest goes to alone. Every one sits in no family;
 * `catalog-families.test.ts` pins it. Spas, saunas and baths left this list
 * for the Spa rail; golf, rinks, pools and sports complexes for Fun.
 */
export const NO_FAMILY_TYPES = [
  "gym",
  "fitness_center",
  "sports_club",
  "sports_coaching",
  "sports_school",
  "tennis_court",
  "athletic_field",
  "padel_club",
  "tennis_club",
  "soccer_field",
  "climbing_gym",
  "crossfit_box",
  "pilates_studio",
  "dance_studio",
  "martial_arts",
  "beauty_salon",
  "hair_salon",
  "hair_care",
  "nail_salon",
  "barber_shop",
  "barbershop",
  "beautician",
  "makeup_artist",
  "skin_care_clinic",
  "tanning_studio",
  "foot_care",
  "body_art_service",
  "medical_spa",
  "tattoo_studio",
  "ski_resort",
  "childrens_camp",
  "cycling_park",
  "off_roading_area",
  "dog_park",
  "art_studio",
] as const;

// The dictionary (MESITA-2834, rewritten by MESITA-2888): one row per
// in-scope Google category and per leftover Mesita slug, its families as a
// list. Order inside a row means nothing; `inOrder` hands every reader the
// catalog's family order.
const EXPLICIT: Record<string, readonly FamilyKey[]> = {
  // Coffee · Breakfast
  cafe: ["coffee", "breakfast"],
  coffee_shop: ["coffee", "breakfast"],
  cat_cafe: ["coffee"],
  dog_cafe: ["coffee"],
  coffee_roastery: ["coffee"],
  coffee_stand: ["coffee"],
  tea_house: ["coffee"],
  tea_store: ["coffee"],
  internet_cafe: ["coffee"],
  board_game_cafe: ["coffee", "fun"],
  juice_shop: ["healthy", "coffee"],
  juice_bar: ["healthy", "coffee"],
  breakfast_restaurant: ["breakfast"],
  brunch_restaurant: ["breakfast"],
  diner: ["breakfast", "american"],
  breakfast: ["breakfast"],
  brunch: ["breakfast"],
  // Bakery · Dessert
  bagel_shop: ["breakfast", "bakery", "quick_bite"],
  bakery: ["bakery", "breakfast", "sweet"],
  pastry_shop: ["bakery", "sweet", "breakfast"],
  donut_shop: ["bakery", "sweet", "breakfast"],
  cake_shop: ["bakery", "sweet"],
  candy_store: ["sweet"],
  chocolate_factory: ["sweet"],
  chocolate_shop: ["sweet"],
  confectionery: ["sweet"],
  dessert_restaurant: ["sweet"],
  dessert_shop: ["sweet"],
  ice_cream_shop: ["sweet"],
  ice_cream: ["sweet"],
  acai_shop: ["sweet", "healthy"],
  // Healthy
  salad_shop: ["healthy", "quick_bite"],
  salad: ["healthy", "quick_bite"],
  vegan_restaurant: ["healthy"],
  vegetarian_restaurant: ["healthy"],
  vegan: ["healthy"],
  vegetarian: ["healthy"],
  health_food_store: ["healthy"],
  // Tacos · Mexican
  taco_restaurant: ["tacos", "mexican", "quick_bite"],
  burrito_restaurant: ["tacos", "mexican", "quick_bite"],
  taco: ["tacos", "mexican", "quick_bite"],
  mexican_restaurant: ["mexican", "tacos", "dinner"],
  tex_mex_restaurant: ["mexican", "tacos", "dinner"],
  mexican: ["mexican", "tacos", "dinner"],
  // Pizza · Italian
  pizza_restaurant: ["pizza", "italian"],
  pizza_delivery: ["pizza", "quick_bite"],
  pizza: ["pizza", "italian"],
  italian_restaurant: ["italian", "dinner"],
  italian: ["italian", "dinner"],
  // Burgers · Wings · Quick
  hamburger_restaurant: ["burgers", "quick_bite", "american", "dinner"],
  burger: ["burgers", "quick_bite", "american", "dinner"],
  chicken_restaurant: ["chicken", "quick_bite"],
  chicken_wings_restaurant: ["chicken", "sports"],
  sandwich_shop: ["quick_bite"],
  sandwich: ["quick_bite"],
  deli: ["quick_bite"],
  fast_food_restaurant: ["quick_bite"],
  fast_food: ["quick_bite"],
  hot_dog_restaurant: ["quick_bite"],
  hot_dog_stand: ["quick_bite"],
  snack_bar: ["quick_bite"],
  food_court: ["quick_bite"],
  cafeteria: ["quick_bite"],
  meal_takeaway: ["quick_bite"],
  food_truck: ["quick_bite"],
  food_hall: ["quick_bite"],
  fish_and_chips_restaurant: ["seafood", "quick_bite"],
  // Arabic: the Levant and the whole eastern shore
  kebab_shop: ["arabic", "quick_bite"],
  shawarma_restaurant: ["arabic", "quick_bite"],
  falafel_restaurant: ["arabic", "quick_bite"],
  gyro_restaurant: ["arabic", "quick_bite"],
  lebanese_restaurant: ["arabic", "dinner"],
  middle_eastern_restaurant: ["arabic", "dinner"],
  middle_eastern: ["arabic", "dinner"],
  moroccan_restaurant: ["arabic", "dinner"],
  persian_restaurant: ["arabic", "dinner"],
  halal_restaurant: ["arabic", "dinner"],
  turkish_restaurant: ["arabic", "dinner"],
  mediterranean_restaurant: ["arabic", "dinner"],
  mediterranean: ["arabic", "dinner"],
  greek_restaurant: ["arabic", "dinner"],
  greek: ["arabic", "dinner"],
  israeli_restaurant: ["arabic", "dinner"],
  // Sushi · Japanese
  sushi_restaurant: ["sushi", "japanese"],
  sushi: ["sushi", "japanese"],
  japanese_restaurant: ["japanese", "sushi", "dinner"],
  japanese: ["japanese", "sushi", "dinner"],
  japanese_curry_restaurant: ["japanese", "dinner"],
  japanese_izakaya_restaurant: ["japanese", "drinks", "dinner"],
  tonkatsu_restaurant: ["japanese", "dinner"],
  yakiniku_restaurant: ["japanese", "steak", "dinner"],
  yakitori_restaurant: ["japanese", "dinner"],
  ramen_restaurant: ["japanese"],
  ramen: ["japanese"],
  // Chinese · Asian · Indian
  chinese_restaurant: ["chinese", "dinner"],
  cantonese_restaurant: ["chinese", "dinner"],
  dim_sum_restaurant: ["chinese", "dinner"],
  dumpling_restaurant: ["chinese"],
  chinese_noodle_restaurant: ["chinese"],
  hot_pot_restaurant: ["chinese", "dinner"],
  taiwanese_restaurant: ["chinese", "asian", "dinner"],
  chinese: ["chinese", "dinner"],
  noodle_shop: ["asian"],
  korean_restaurant: ["asian", "dinner"],
  korean_barbecue_restaurant: ["asian", "steak", "dinner"],
  korean: ["asian", "dinner"],
  thai_restaurant: ["asian", "dinner"],
  thai: ["asian", "dinner"],
  vietnamese_restaurant: ["asian", "dinner"],
  vietnamese: ["asian", "dinner"],
  asian_restaurant: ["asian", "dinner"],
  asian_fusion_restaurant: ["asian", "dinner"],
  asian_fusion: ["asian", "dinner"],
  indonesian_restaurant: ["asian", "dinner"],
  malaysian_restaurant: ["asian", "dinner"],
  filipino_restaurant: ["asian", "dinner"],
  cambodian_restaurant: ["asian", "dinner"],
  burmese_restaurant: ["asian", "dinner"],
  tibetan_restaurant: ["asian", "dinner"],
  mongolian_barbecue_restaurant: ["asian", "steak", "dinner"],
  indian_restaurant: ["indian", "dinner"],
  north_indian_restaurant: ["indian", "dinner"],
  south_indian_restaurant: ["indian", "dinner"],
  pakistani_restaurant: ["indian", "dinner"],
  bangladeshi_restaurant: ["indian", "dinner"],
  sri_lankan_restaurant: ["indian", "dinner"],
  indian: ["indian", "dinner"],
  // Steak · Seafood
  steak_house: ["steak", "dinner"],
  barbecue_restaurant: ["steak", "dinner"],
  bbq: ["steak", "dinner"],
  argentinian_restaurant: ["steak", "dinner"],
  argentinian: ["steak", "dinner"],
  brazilian_restaurant: ["steak", "dinner"],
  brazilian: ["steak", "dinner"],
  seafood_restaurant: ["seafood", "dinner"],
  oyster_bar_restaurant: ["seafood", "dinner"],
  seafood: ["seafood", "dinner"],
  peruvian_restaurant: ["seafood", "dinner"],
  peruvian: ["seafood", "dinner"],
  // European
  french_restaurant: ["european", "dinner"],
  french: ["european", "dinner"],
  bistro: ["european", "dinner"],
  spanish_restaurant: ["european", "dinner"],
  spanish: ["european", "dinner"],
  tapas_restaurant: ["european", "dinner"],
  basque_restaurant: ["european", "dinner"],
  european_restaurant: ["european", "dinner"],
  german_restaurant: ["european", "beer", "dinner"],
  bavarian_restaurant: ["european", "beer", "dinner"],
  czech_restaurant: ["european", "beer", "dinner"],
  austrian_restaurant: ["european", "dinner"],
  swiss_restaurant: ["european", "dinner"],
  belgian_restaurant: ["european", "dinner"],
  dutch_restaurant: ["european", "dinner"],
  danish_restaurant: ["european", "dinner"],
  scandinavian_restaurant: ["european", "dinner"],
  british_restaurant: ["european", "dinner"],
  irish_restaurant: ["european", "dinner"],
  polish_restaurant: ["european", "dinner"],
  hungarian_restaurant: ["european", "dinner"],
  romanian_restaurant: ["european", "dinner"],
  russian_restaurant: ["european", "dinner"],
  ukrainian_restaurant: ["european", "dinner"],
  eastern_european_restaurant: ["european", "dinner"],
  croatian_restaurant: ["european", "dinner"],
  portuguese_restaurant: ["european", "dinner"],
  fondue_restaurant: ["european", "dinner"],
  // American
  american_restaurant: ["american", "dinner"],
  american: ["american", "dinner"],
  bar_and_grill: ["drinks", "american", "dinner"],
  southwestern_us_restaurant: ["american", "dinner"],
  soul_food_restaurant: ["american", "dinner"],
  cajun_restaurant: ["american", "dinner"],
  californian_restaurant: ["american", "dinner"],
  hawaiian_restaurant: ["american", "dinner"],
  // Dinner, the wide table · Fancy · Family
  restaurant: ["dinner"],
  fine_dining_restaurant: ["fancy", "dinner"],
  fine_dining: ["fancy", "dinner"],
  family_restaurant: ["family", "dinner"],
  buffet_restaurant: ["dinner"],
  fusion_restaurant: ["dinner"],
  soup_restaurant: ["dinner"],
  western_restaurant: ["dinner"],
  afghani_restaurant: ["dinner"],
  african_restaurant: ["dinner"],
  australian_restaurant: ["dinner"],
  ethiopian_restaurant: ["dinner"],
  latin_american_restaurant: ["dinner"],
  south_american_restaurant: ["dinner"],
  colombian_restaurant: ["dinner"],
  chilean_restaurant: ["dinner"],
  cuban_restaurant: ["dinner"],
  caribbean_restaurant: ["dinner"],
  // Bar · Beer · Cocktails · Wine · Sports · Hookah
  bar: ["drinks"],
  pub: ["drinks", "beer"],
  irish_pub: ["drinks", "beer"],
  gastropub: ["drinks", "beer", "dinner"],
  brewpub: ["beer", "drinks", "dinner"],
  brewery: ["beer", "drinks"],
  beer_garden: ["beer", "drinks"],
  sports_bar: ["sports", "drinks", "beer"],
  stadium: ["sports"],
  arena: ["sports"],
  cocktail_bar: ["cocktails", "drinks", "night_out"],
  lounge_bar: ["cocktails", "drinks", "night_out"],
  hookah_bar: ["hookah", "drinks", "night_out"],
  wine_bar: ["wine", "drinks"],
  winery: ["wine"],
  vineyard: ["wine"],
  billiards: ["drinks", "fun"],
  // Night · Club · Music · Karaoke
  night_club: ["nightclub", "night_out"],
  dance_hall: ["nightclub", "night_out", "music"],
  karaoke: ["karaoke", "night_out"],
  live_music_venue: ["music", "night_out"],
  concert_hall: ["music"],
  concert_venue: ["music"],
  amphitheatre: ["music"],
  philharmonic_hall: ["music"],
  opera_house: ["music"],
  auditorium: ["music"],
  comedy_club: ["cinema", "night_out"],
  // Fun: what a group does with its hands
  bowling_alley: ["fun"],
  video_arcade: ["fun"],
  arcade: ["fun"],
  amusement_center: ["fun"],
  escape_room: ["fun"],
  laser_tag: ["fun"],
  axe_throwing: ["fun"],
  trampoline_park: ["fun"],
  go_karting_venue: ["fun"],
  go_kart: ["fun"],
  golf_course: ["fun"],
  indoor_golf_course: ["fun"],
  miniature_golf_course: ["fun"],
  mini_golf: ["fun"],
  adventure_sports_center: ["fun"],
  paintball_center: ["fun"],
  race_course: ["fun"],
  skateboard_park: ["fun"],
  sports_activity_location: ["fun"],
  sports_complex: ["fun"],
  swimming_pool: ["fun"],
  ice_skating_rink: ["fun", "family"],
  water_park: ["fun", "family"],
  // Cinema · Casino
  movie_theater: ["cinema"],
  performing_arts_theater: ["cinema"],
  theater: ["cinema"],
  casino: ["casino"],
  // Spa
  spa: ["spa"],
  massage_spa: ["spa"],
  massage: ["spa"],
  sauna: ["spa"],
  wellness_center: ["spa"],
  public_bath: ["spa"],
  yoga_studio: ["spa"],
  temazcal: ["spa"],
  hot_springs: ["spa"],
  // Family: a day out with the kids
  zoo: ["family", "tourist"],
  aquarium: ["family", "tourist"],
  wildlife_park: ["family", "tourist"],
  amusement_park: ["family", "fun"],
  playground: ["family"],
  indoor_playground: ["family"],
  ferris_wheel: ["family", "tourist"],
  roller_coaster: ["family", "fun"],
  planetarium: ["family", "tourist"],
  picnic_ground: ["family"],
  // Tourist: what a visitor sees
  tourist_attraction: ["tourist"],
  historical_landmark: ["tourist"],
  historical_place: ["tourist"],
  cultural_landmark: ["tourist"],
  cultural_center: ["tourist"],
  monument: ["tourist"],
  sculpture: ["tourist"],
  museum: ["tourist"],
  art_museum: ["tourist"],
  history_museum: ["tourist"],
  art_gallery: ["tourist"],
  plaza: ["tourist"],
  park: ["tourist"],
  city_park: ["tourist"],
  national_park: ["tourist"],
  state_park: ["tourist"],
  botanical_garden: ["tourist"],
  garden: ["tourist"],
  observation_deck: ["tourist"],
  scenic_spot: ["tourist"],
  fountain: ["tourist"],
  hiking_area: ["tourist"],
  mountain_peak: ["tourist"],
  lake: ["tourist"],
  beach: ["tourist"],
  marina: ["tourist"],
  shopping_mall: ["tourist"],
  market: ["tourist"],
  flea_market: ["tourist"],
  farmers_market: ["tourist"],
  // No family (MESITA-2382): a place, not a trip a guest picks.
  ...Object.fromEntries(NO_FAMILY_TYPES.map((t) => [t, ["undefined"] as const])),
  barbecue_area: ["undefined"],
  fishing_charter: ["undefined"],
  fishing_pier: ["undefined"],
  fishing_pond: ["undefined"],
  meal_delivery: ["undefined"],
  visitor_center: ["undefined"],
  wildlife_refuge: ["undefined"],
  banquet_hall: ["undefined"],
  community_center: ["undefined"],
  convention_center: ["undefined"],
  event_venue: ["undefined"],
  wedding_venue: ["undefined"],
  movie_rental: ["undefined"],
  undefined: ["undefined"],
};

const COARSE_FALLBACK: Record<string, FamilyKey> = {
  restaurants: "dinner",
  bars_nightlife: "drinks",
  cafes_bakeries: "coffee",
  // Not social (MESITA-2468): an unlisted sport, fitness, wellness or
  // beauty type is not a trip Mesita lists either.
  sports_fitness: "undefined",
  wellness_beauty: "undefined",
  // An unlisted culture or experiences type is not a trip Mesita lists:
  // the rows above name every one that is (MESITA-2888).
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
