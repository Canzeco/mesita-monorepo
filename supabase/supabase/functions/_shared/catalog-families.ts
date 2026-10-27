// The guest catalog is these fifty families. Undefined is the leftover
// and is not a rail. A type may sit in several families: a list, never a
// primary and a secondary (MESITA-2808).
//
// FIFTY (MESITA-2834, Pato 2026-10-26: "i want 50 families, not 20 or 30 …
// families can intersect, for example, mexican and tacos kinda intersect, or
// bar and nightclub … cover as much space with 50 Mesita Families"). The
// twenty of MESITA-2760 all stay, keys untouched; thirty join. Tacos and
// Japanese return as intersections (2760 had folded them). Drinks reads Bar.
//
// ONE WORD (MESITA-2760, Pato 2026-10-25: "families must be one-word long"),
// AND A SHORT ONE (MESITA-2841, Pato 2026-10-26: "make word shorter"): every
// label is one word of at most nine letters, the widest Home's column draws
// on one line; stored keys never follow a label (`quick_bite` reads Quick,
// `sweet` Dessert, `drinks` Bar, `night_out` Night, `nightclub` Club,
// `mediterranean` Greek).
//
// A DICTIONARY, NOT A MODEL (MESITA-2834, Pato 2026-10-26: "Mesita Families
// (not editable, directly infered with dictionary based on canonic google
// categories)"): a place's families are every family of its Google
// categories through this map, derived in the profiles view
// (place_family_keys → families_for_categories). No model picks them and no
// editor saves them; the map itself is edited on Atlas (catalog_membership).
//
// SCOPE (MESITA-2438, Pato 2026-10-19: "This is not Tudu, is Mesita. More
// OpenTable scope."): a family holds places a guest books a table at or
// orders at — food, coffee, bars, nightlife. Tourist attractions, museums,
// parks, zoos, bowling, cinemas and every similar attraction sit in NO
// family (`ATTRACTION_TYPES`).
//
// SOCIAL (MESITA-2468, Pato 2026-10-19: "its more social, so fuck the
// gyms" + "i neither want barber shops nor fucking spas"): the Move and
// Feel better rails are gone. Gyms, studios, courts, pools, spas, salons,
// barbers and tattoo studios sit in NO family (`NOT_SOCIAL_TYPES`). Sports
// is sports bars — watching the game is social; a gym is not.
//
// ONE NIGHT RAIL (MESITA-2486, Pato 2026-10-19: "merge"): Go out folded
// into Night out (now labelled Nightlife). Karaoke, escape rooms, billiards
// and board-game cafés are Nightlife; a board-game café is Coffee and
// Nightlife. Nightclub, Karaoke, Music and Hookah are the sharper night
// rails inside it (MESITA-2834).
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
// Monterrey calls the Levant ("comida árabe"); Mediterranean is the sea's
// shore, so a Lebanese place wears both.
//
// Many Google categories sit in NO family, and that is the right answer, not
// a gap: a mechanic, a church, a hotel, a plaza, a cafeteria, a museum. They
// are stored as `undefined`, never shown on a guest surface, and never forced
// onto the nearest rail (MESITA-2382, MESITA-2438).

export const CATALOG_FAMILY_SLUGS = [
  "coffee",
  "breakfast",
  "brunch",
  "bakery",
  "sweet",
  "gelato",
  "healthy",
  "vegan",
  "quick_bite",
  "tacos",
  "burgers",
  "pizza",
  "sandwiches",
  "chicken",
  "wings",
  "kebab",
  "dinner",
  "mexican",
  "steak",
  "bbq",
  "seafood",
  "italian",
  "sushi",
  "japanese",
  "ramen",
  "noodles",
  "chinese",
  "dumplings",
  "korean",
  "thai",
  "indian",
  "asian",
  "arabic",
  "mediterranean",
  "spanish",
  "french",
  "european",
  "american",
  "latin",
  "fancy",
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
  { slug: "brunch", label: "Brunch", emoji: "🥞", sort_order: 3 },
  { slug: "bakery", label: "Bakery", emoji: "🥐", sort_order: 4 },
  { slug: "sweet", label: "Dessert", emoji: "🍰", sort_order: 5 },
  { slug: "gelato", label: "Gelato", emoji: "🍦", sort_order: 6 },
  { slug: "healthy", label: "Healthy", emoji: "🥗", sort_order: 7 },
  { slug: "vegan", label: "Vegan", emoji: "🌱", sort_order: 8 },
  { slug: "quick_bite", label: "Quick", emoji: "⚡", sort_order: 9 },
  { slug: "tacos", label: "Tacos", emoji: "🌮", sort_order: 10 },
  { slug: "burgers", label: "Burgers", emoji: "🍔", sort_order: 11 },
  { slug: "pizza", label: "Pizza", emoji: "🍕", sort_order: 12 },
  { slug: "sandwiches", label: "Sandwich", emoji: "🥪", sort_order: 13 },
  { slug: "chicken", label: "Chicken", emoji: "🍗", sort_order: 14 },
  { slug: "wings", label: "Wings", emoji: "🔥", sort_order: 15 },
  { slug: "kebab", label: "Kebab", emoji: "🥙", sort_order: 16 },
  { slug: "dinner", label: "Dinner", emoji: "🍽️", sort_order: 17 },
  { slug: "mexican", label: "Mexican", emoji: "🌶️", sort_order: 18 },
  { slug: "steak", label: "Steak", emoji: "🥩", sort_order: 19 },
  { slug: "bbq", label: "BBQ", emoji: "🍖", sort_order: 20 },
  { slug: "seafood", label: "Seafood", emoji: "🦐", sort_order: 21 },
  { slug: "italian", label: "Italian", emoji: "🍝", sort_order: 22 },
  { slug: "sushi", label: "Sushi", emoji: "🍣", sort_order: 23 },
  { slug: "japanese", label: "Japanese", emoji: "🍱", sort_order: 24 },
  { slug: "ramen", label: "Ramen", emoji: "🍜", sort_order: 25 },
  { slug: "noodles", label: "Noodles", emoji: "🥢", sort_order: 26 },
  { slug: "chinese", label: "Chinese", emoji: "🥡", sort_order: 27 },
  { slug: "dumplings", label: "Dumpling", emoji: "🥟", sort_order: 28 },
  { slug: "korean", label: "Korean", emoji: "🍚", sort_order: 29 },
  { slug: "thai", label: "Thai", emoji: "🍲", sort_order: 30 },
  { slug: "indian", label: "Indian", emoji: "🍛", sort_order: 31 },
  { slug: "asian", label: "Asian", emoji: "🍥", sort_order: 32 },
  { slug: "arabic", label: "Arabic", emoji: "🧆", sort_order: 33 },
  { slug: "mediterranean", label: "Greek", emoji: "🫒", sort_order: 34 },
  { slug: "spanish", label: "Spanish", emoji: "🥘", sort_order: 35 },
  { slug: "french", label: "French", emoji: "🥖", sort_order: 36 },
  { slug: "european", label: "European", emoji: "🥨", sort_order: 37 },
  { slug: "american", label: "American", emoji: "🍟", sort_order: 38 },
  { slug: "latin", label: "Latin", emoji: "🌎", sort_order: 39 },
  { slug: "fancy", label: "Fancy", emoji: "🥂", sort_order: 40 },
  { slug: "drinks", label: "Bar", emoji: "🍻", sort_order: 41 },
  { slug: "beer", label: "Beer", emoji: "🍺", sort_order: 42 },
  { slug: "cocktails", label: "Cocktail", emoji: "🍸", sort_order: 43 },
  { slug: "wine", label: "Wine", emoji: "🍷", sort_order: 44 },
  { slug: "sports", label: "Sports", emoji: "📺", sort_order: 45 },
  { slug: "hookah", label: "Hookah", emoji: "💨", sort_order: 46 },
  { slug: "night_out", label: "Night", emoji: "🌙", sort_order: 47 },
  { slug: "nightclub", label: "Club", emoji: "🪩", sort_order: 48 },
  { slug: "music", label: "Music", emoji: "🎶", sort_order: 49 },
  { slug: "karaoke", label: "Karaoke", emoji: "🎤", sort_order: 50 },
  { slug: "undefined", label: "Undefined", emoji: "·", sort_order: 999 },
];

const FAMILY_SET = new Set<string>(CATALOG_FAMILIES.map((f) => f.slug));

export function isCatalogFamily(value: string): value is FamilyKey {
  return FAMILY_SET.has(value);
}

/** Each rail's lead Google type: first in its Nearby battery, so the
 *  every-family battery (round-robin, capped at 50) always carries it. Fifty
 *  families, fifty distinct leads: exactly Google's cap, so that battery is
 *  the leads and nothing else. The full battery is derived from the Table A
 *  map (`GOOGLE_SEARCH_TYPES`, google-type-super.ts). */
export const CATALOG_LEAD_TYPES: Record<CatalogFamilySlug, string> = {
  coffee: "cafe",
  breakfast: "breakfast_restaurant",
  brunch: "brunch_restaurant",
  bakery: "bakery",
  sweet: "dessert_shop",
  gelato: "ice_cream_shop",
  healthy: "salad_shop",
  vegan: "vegan_restaurant",
  quick_bite: "fast_food_restaurant",
  tacos: "taco_restaurant",
  burgers: "hamburger_restaurant",
  pizza: "pizza_restaurant",
  sandwiches: "sandwich_shop",
  chicken: "chicken_restaurant",
  wings: "chicken_wings_restaurant",
  kebab: "kebab_shop",
  dinner: "restaurant",
  mexican: "mexican_restaurant",
  steak: "steak_house",
  bbq: "barbecue_restaurant",
  seafood: "seafood_restaurant",
  italian: "italian_restaurant",
  sushi: "sushi_restaurant",
  japanese: "japanese_restaurant",
  ramen: "ramen_restaurant",
  noodles: "noodle_shop",
  chinese: "chinese_restaurant",
  dumplings: "dumpling_restaurant",
  korean: "korean_restaurant",
  thai: "thai_restaurant",
  indian: "indian_restaurant",
  asian: "asian_restaurant",
  arabic: "lebanese_restaurant",
  mediterranean: "mediterranean_restaurant",
  spanish: "spanish_restaurant",
  french: "french_restaurant",
  european: "european_restaurant",
  american: "american_restaurant",
  latin: "latin_american_restaurant",
  fancy: "fine_dining_restaurant",
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

/**
 * Not social: sport, fitness, wellness and beauty places, the old Move and
 * Feel better rails (MESITA-2468). Every one sits in no family; the
 * migration `20261020030000_families_drop_move_feel_better.sql` moves the
 * stored mapping with them, and `catalog-families.test.ts` pins the pair.
 */
export const NOT_SOCIAL_TYPES = [
  "gym",
  "fitness_center",
  "yoga_studio",
  "sports_club",
  "sports_coaching",
  "sports_complex",
  "sports_school",
  "sports_activity_location",
  "golf_course",
  "indoor_golf_course",
  "ice_skating_rink",
  "swimming_pool",
  "tennis_court",
  "adventure_sports_center",
  "skateboard_park",
  "padel_club",
  "tennis_club",
  "soccer_field",
  "climbing_gym",
  "crossfit_box",
  "pilates_studio",
  "dance_studio",
  "martial_arts",
  "spa",
  "massage",
  "massage_spa",
  "sauna",
  "wellness_center",
  "beauty_salon",
  "hair_salon",
  "hair_care",
  "nail_salon",
  "barber_shop",
  "barbershop",
  "temazcal",
  "hot_springs",
  "medical_spa",
  "tattoo_studio",
] as const;

// The dictionary (MESITA-2834): one row per in-scope Google category and
// per leftover Mesita slug, its families as a list. Order inside a row means
// nothing; `inOrder` hands every reader the catalog's family order.
const EXPLICIT: Record<string, readonly FamilyKey[]> = {
  // Coffee · Breakfast · Brunch
  cafe: ["coffee", "breakfast", "brunch"],
  coffee_shop: ["coffee", "breakfast"],
  cat_cafe: ["coffee"],
  dog_cafe: ["coffee"],
  coffee_roastery: ["coffee"],
  coffee_stand: ["coffee"],
  tea_house: ["coffee"],
  juice_shop: ["healthy", "coffee"],
  juice_bar: ["healthy", "coffee"],
  breakfast_restaurant: ["breakfast", "brunch"],
  brunch_restaurant: ["brunch", "breakfast"],
  diner: ["breakfast", "american"],
  breakfast: ["breakfast", "brunch"],
  brunch: ["brunch", "breakfast"],
  // Bakery · Dessert · Gelato
  bagel_shop: ["breakfast", "bakery", "sandwiches"],
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
  ice_cream_shop: ["gelato", "sweet"],
  ice_cream: ["gelato", "sweet"],
  acai_shop: ["sweet", "gelato", "healthy"],
  // Healthy · Vegan
  salad_shop: ["healthy", "quick_bite"],
  salad: ["healthy", "quick_bite"],
  vegan_restaurant: ["vegan", "healthy"],
  vegetarian_restaurant: ["vegan", "healthy"],
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
  // Burgers · Chicken · Wings · Sandwiches · Quick
  hamburger_restaurant: ["burgers", "quick_bite", "american", "dinner"],
  burger: ["burgers", "quick_bite", "american", "dinner"],
  chicken_restaurant: ["chicken", "quick_bite"],
  chicken_wings_restaurant: ["wings", "chicken"],
  sandwich_shop: ["sandwiches", "quick_bite"],
  sandwich: ["sandwiches", "quick_bite"],
  deli: ["sandwiches", "quick_bite"],
  fast_food_restaurant: ["quick_bite"],
  fast_food: ["quick_bite"],
  hot_dog_restaurant: ["quick_bite"],
  hot_dog_stand: ["quick_bite"],
  snack_bar: ["quick_bite"],
  food_court: ["quick_bite"],
  meal_takeaway: ["quick_bite"],
  food_truck: ["quick_bite"],
  food_hall: ["quick_bite"],
  fish_and_chips_restaurant: ["seafood", "quick_bite"],
  // Kebab · Arabic · Mediterranean
  kebab_shop: ["kebab", "arabic", "quick_bite"],
  shawarma_restaurant: ["kebab", "arabic", "quick_bite"],
  falafel_restaurant: ["kebab", "arabic", "quick_bite"],
  gyro_restaurant: ["kebab", "quick_bite"],
  lebanese_restaurant: ["arabic", "mediterranean", "dinner"],
  middle_eastern_restaurant: ["arabic", "mediterranean", "dinner"],
  moroccan_restaurant: ["arabic", "mediterranean", "dinner"],
  persian_restaurant: ["arabic", "dinner"],
  halal_restaurant: ["arabic", "dinner"],
  turkish_restaurant: ["mediterranean", "kebab", "dinner"],
  mediterranean_restaurant: ["mediterranean", "dinner"],
  greek_restaurant: ["mediterranean", "dinner"],
  israeli_restaurant: ["mediterranean", "dinner"],
  // Sushi · Japanese · Ramen · Noodles
  sushi_restaurant: ["sushi", "japanese"],
  sushi: ["sushi", "japanese"],
  japanese_restaurant: ["japanese", "sushi", "dinner"],
  japanese: ["japanese", "sushi", "dinner"],
  japanese_curry_restaurant: ["japanese", "dinner"],
  japanese_izakaya_restaurant: ["japanese", "drinks", "dinner"],
  tonkatsu_restaurant: ["japanese", "dinner"],
  yakiniku_restaurant: ["japanese", "bbq", "dinner"],
  yakitori_restaurant: ["japanese", "dinner"],
  ramen_restaurant: ["ramen", "noodles", "japanese"],
  ramen: ["ramen", "noodles", "japanese"],
  noodle_shop: ["noodles", "asian"],
  chinese_noodle_restaurant: ["noodles", "chinese"],
  vietnamese_restaurant: ["asian", "noodles", "dinner"],
  // Korean · Chinese · Dumplings · Thai · Indian · Asian
  korean_restaurant: ["korean", "dinner"],
  korean_barbecue_restaurant: ["korean", "bbq", "dinner"],
  korean: ["korean", "dinner"],
  chinese_restaurant: ["chinese", "dinner"],
  cantonese_restaurant: ["chinese", "dumplings", "dinner"],
  dim_sum_restaurant: ["dumplings", "chinese", "dinner"],
  dumpling_restaurant: ["dumplings", "chinese"],
  hot_pot_restaurant: ["chinese", "dinner"],
  taiwanese_restaurant: ["chinese", "asian", "dinner"],
  chinese: ["chinese", "dinner"],
  thai_restaurant: ["thai", "dinner"],
  thai: ["thai", "dinner"],
  indian_restaurant: ["indian", "dinner"],
  north_indian_restaurant: ["indian", "dinner"],
  south_indian_restaurant: ["indian", "dinner"],
  pakistani_restaurant: ["indian", "dinner"],
  bangladeshi_restaurant: ["indian", "dinner"],
  sri_lankan_restaurant: ["indian", "dinner"],
  indian: ["indian", "dinner"],
  asian_restaurant: ["asian", "dinner"],
  asian_fusion_restaurant: ["asian", "dinner"],
  indonesian_restaurant: ["asian", "dinner"],
  malaysian_restaurant: ["asian", "dinner"],
  filipino_restaurant: ["asian", "dinner"],
  cambodian_restaurant: ["asian", "dinner"],
  burmese_restaurant: ["asian", "dinner"],
  tibetan_restaurant: ["asian", "dinner"],
  mongolian_barbecue_restaurant: ["bbq", "asian", "dinner"],
  // BBQ · Steak · Seafood
  barbecue_restaurant: ["bbq", "steak", "dinner"],
  bbq: ["bbq", "steak", "dinner"],
  steak_house: ["steak", "dinner"],
  seafood_restaurant: ["seafood", "dinner"],
  oyster_bar_restaurant: ["seafood", "dinner"],
  seafood: ["seafood", "dinner"],
  // French · Spanish · European
  french_restaurant: ["french", "dinner"],
  bistro: ["french", "dinner"],
  spanish_restaurant: ["spanish", "dinner"],
  tapas_restaurant: ["spanish", "dinner"],
  basque_restaurant: ["spanish", "dinner"],
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
  // American · Latin
  american_restaurant: ["american", "dinner"],
  bar_and_grill: ["drinks", "american", "dinner"],
  southwestern_us_restaurant: ["american", "dinner"],
  soul_food_restaurant: ["american", "dinner"],
  cajun_restaurant: ["american", "dinner"],
  californian_restaurant: ["american", "dinner"],
  hawaiian_restaurant: ["american", "dinner"],
  latin_american_restaurant: ["latin", "dinner"],
  south_american_restaurant: ["latin", "dinner"],
  argentinian_restaurant: ["steak", "latin", "dinner"],
  brazilian_restaurant: ["latin", "steak", "dinner"],
  peruvian_restaurant: ["latin", "seafood", "dinner"],
  colombian_restaurant: ["latin", "dinner"],
  chilean_restaurant: ["latin", "dinner"],
  cuban_restaurant: ["latin", "dinner"],
  caribbean_restaurant: ["latin", "dinner"],
  // Dinner, the wide table · Fancy
  restaurant: ["dinner"],
  fine_dining_restaurant: ["fancy", "dinner"],
  family_restaurant: ["dinner"],
  buffet_restaurant: ["dinner"],
  fusion_restaurant: ["dinner"],
  soup_restaurant: ["dinner"],
  western_restaurant: ["dinner"],
  afghani_restaurant: ["dinner"],
  african_restaurant: ["dinner"],
  australian_restaurant: ["dinner"],
  ethiopian_restaurant: ["dinner"],
  // Bar · Beer · Cocktails · Wine · Sports · Hookah
  bar: ["drinks"],
  pub: ["drinks", "beer"],
  irish_pub: ["drinks", "beer"],
  gastropub: ["drinks", "beer", "dinner"],
  brewpub: ["beer", "drinks", "dinner"],
  brewery: ["beer", "drinks"],
  beer_garden: ["beer", "drinks"],
  sports_bar: ["sports", "drinks", "beer"],
  cocktail_bar: ["cocktails", "drinks", "night_out"],
  lounge_bar: ["cocktails", "drinks", "night_out"],
  hookah_bar: ["hookah", "drinks", "night_out"],
  wine_bar: ["wine", "drinks"],
  winery: ["wine"],
  vineyard: ["wine"],
  // Nightclub · Nightlife · Karaoke · Music
  night_club: ["nightclub", "night_out"],
  dance_hall: ["nightclub", "night_out", "music"],
  karaoke: ["karaoke", "night_out"],
  live_music_venue: ["music", "night_out"],
  comedy_club: ["night_out"],
  escape_room: ["night_out"],
  billiards: ["night_out", "drinks"],
  board_game_cafe: ["coffee", "night_out"],
  // No family (MESITA-2382): a place, not a trip a guest picks.
  ...Object.fromEntries(ATTRACTION_TYPES.map((t) => [t, ["undefined"] as const])),
  ...Object.fromEntries(NOT_SOCIAL_TYPES.map((t) => [t, ["undefined"] as const])),
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
