// The guest catalog is these twenty-five families. Undefined is the leftover
// and is not a rail. A type may sit in several families: a list, never a
// primary and a secondary (MESITA-2808).
//
// TWENTY-FIVE (MESITA-4818, Pato 2026-11-23: "Think deeply. Compress list
// into 25 families"). Live counts on 265 places picked the five thinnest
// rails, each with a parent a guest already browses: Club (3 places) and
// Music (1) fold into Night — one rail for everything after dinner; Chinese
// (3) and Indian (3) fold into Asian — every Asian cuisine but Japanese;
// Bakery (1) folds into Dessert — a bakery is a counter more than a table.
// Sushi, Pizza, Burgers and Wings stay: each is a craving a guest names. Fun
// and Casino stay: the early-deals call of MESITA-4588. Stored lists were
// re-keyed to the parent in the same migration. Every paragraph below that
// names Club, Music, Chinese, Indian or Bakery as a rail is history.
//
// THIRTY (MESITA-4571, Pato 2026-11-21: "I WANT ONLY 30 FAMILIES. COMPRESS
// THE LIST OR REMOVE ITEMS.", then "think what makes sense for mesita"). A
// Mesita place is a table: a guest sits, orders and pays a bill, which is
// what Reservations and Prepayments need, and every live place was a
// restaurant, a café or a bar. So Family, Karaoke, Fun, Cinema, Casino, Spa
// and Tourism are gone — none carried a live place, and all but Karaoke sell
// tickets, lanes or treatments. Sports (sports bars) and Hookah (lounges)
// stayed — until MESITA-4588 (Pato, the same day: "ADD CASINOS … I CAN GET
// LOT OF EARLY DEALS FROM CASINOS. REMOVE HOOHAK", "CHANGE SPORTS FOR FUN"):
// Fun and Casino took their slots, an exception to the table rule because
// those venues sell early deals; a sports bar is Bar, a hookah bar Bar and
// Night. A karaoke bar is Bar and Night, a comedy club Night.
// The Google types that are not tables (and are not Fun or a casino) sit in
// no family now (`RETIRED_RAIL_TYPES`). Every paragraph below that names one of the seven,
// or a stadium, a concert hall or a spa as a rail, is history.
//
// THIRTY-SEVEN before that (MESITA-2930, Pato 2026-10-27: "Fold Beer, Cocktails and
// Wine into Bar. Keep Sports and Hookah."): `drinks` (Bar) absorbs the three.
//
// FORTY before that (MESITA-2888, Pato 2026-10-27: "do the list 40 items long. try as
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
// MESITA-2962 narrowed the sights to ones somebody runs (museums, galleries,
// attractions, zoos): parks, plazas, monuments, beaches and malls sit in no
// family again, with massage, yoga, pools and the sweet and tea shops.
// Sports is sports bars — watching the game at a table (stadiums left with
// MESITA-4571); a gym is
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
  "dinner",
  "coffee",
  "drinks",
  "quick_bite",
  "breakfast",
  "mexican",
  "tacos",
  "seafood",
  "asian",
  "european",
  "fancy",
  "steak",
  "japanese",
  "american",
  "healthy",
  "italian",
  "sushi",
  "pizza",
  "burgers",
  "arabic",
  "chicken",
  "sweet",
  "night_out",
  "fun",
  "casino",
] as const;

export type CatalogFamilySlug = (typeof CATALOG_FAMILY_SLUGS)[number];
export type FamilyKey = CatalogFamilySlug | "undefined";

export const CATALOG_FAMILIES: readonly {
  slug: FamilyKey;
  label: string;
  emoji: string;
  sort_order: number;
}[] = [
  { slug: "dinner", label: "Dinner", emoji: "🍽️", sort_order: 1 },
  { slug: "coffee", label: "Coffee", emoji: "☕", sort_order: 2 },
  { slug: "drinks", label: "Bar", emoji: "🍻", sort_order: 3 },
  { slug: "quick_bite", label: "Quick", emoji: "⚡", sort_order: 4 },
  { slug: "breakfast", label: "Breakfast", emoji: "🍳", sort_order: 5 },
  { slug: "mexican", label: "Mexican", emoji: "🇲🇽", sort_order: 6 },
  { slug: "tacos", label: "Tacos", emoji: "🌮", sort_order: 7 },
  { slug: "seafood", label: "Seafood", emoji: "🦐", sort_order: 8 },
  { slug: "asian", label: "Asian", emoji: "🍥", sort_order: 9 },
  { slug: "european", label: "European", emoji: "🥨", sort_order: 10 },
  { slug: "fancy", label: "Fancy", emoji: "🥂", sort_order: 11 },
  { slug: "steak", label: "Steak", emoji: "🥩", sort_order: 12 },
  { slug: "japanese", label: "Japanese", emoji: "🍱", sort_order: 13 },
  { slug: "american", label: "American", emoji: "🍟", sort_order: 14 },
  { slug: "healthy", label: "Healthy", emoji: "🥗", sort_order: 15 },
  { slug: "italian", label: "Italian", emoji: "🍝", sort_order: 16 },
  { slug: "sushi", label: "Sushi", emoji: "🍣", sort_order: 17 },
  { slug: "pizza", label: "Pizza", emoji: "🍕", sort_order: 18 },
  { slug: "burgers", label: "Burgers", emoji: "🍔", sort_order: 19 },
  { slug: "arabic", label: "Arabic", emoji: "🧆", sort_order: 20 },
  { slug: "chicken", label: "Wings", emoji: "🍗", sort_order: 21 },
  { slug: "sweet", label: "Dessert", emoji: "🍰", sort_order: 22 },
  { slug: "night_out", label: "Night", emoji: "🌙", sort_order: 23 },
  { slug: "fun", label: "Fun", emoji: "🎯", sort_order: 24 },
  { slug: "casino", label: "Casino", emoji: "🎰", sort_order: 25 },
  { slug: "undefined", label: "Undefined", emoji: "·", sort_order: 999 },
];

/**
 * Not social, still (MESITA-2468, kept by MESITA-2888): the sport, fitness
 * and beauty places a guest goes to alone. Every one sits in no family;
 * `catalog-families.test.ts` pins it. Spas, saunas and baths left this list
 * for the Spa rail; golf and rinks for Fun. MESITA-2962 sent back massage,
 * yoga, pools, sports complexes, shops and the public places Tourist held.
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
  // Off Mesita since MESITA-2962 (Pato 2026-10-28: "a beaty salon must not be
  // allowed in mesita", then the audit's reds): a service used alone, a
  // fitness place, a shop, or a public place nobody runs.
  "massage",
  "yoga_studio",
  "swimming_pool",
  "sports_complex",
  "sports_activity_location",
  "skateboard_park",
  "candy_store",
  "tea_store",
  "health_food_store",
  "shopping_mall",
  "internet_cafe",
  "park",
  "city_park",
  "state_park",
  "national_park",
  "garden",
  "plaza",
  "fountain",
  "sculpture",
  "monument",
  "historical_landmark",
  "historical_place",
  "cultural_landmark",
  "scenic_spot",
  "hiking_area",
  "mountain_peak",
  "lake",
  "beach",
  "marina",
  "picnic_ground",
  "playground",
] as const;

/**
 * Off Mesita since MESITA-4571 (Fun's types and casinos came back with
 * MESITA-4588) (Pato 2026-11-21: "think what makes sense for
 * mesita … reduce the size or list of allowed google categories"). A Mesita
 * place is one where a guest sits at a table, orders and pays a bill — what
 * Reservations and Prepayments need. These Google types are not: the rails
 * that left (Family, Fun, Cinema, Casino, Spa, Tourism) and, below them, the
 * halls, stadiums, shops and stands. Each sits in no family, so Search hides
 * it and Create refuses it (`catalog_membership.enabled` is off for every
 * one, flipped in the same migration). `catalog-families.test.ts` pins it.
 */
export const RETIRED_RAIL_TYPES = [
  "movie_theater",
  "performing_arts_theater",
  "theater",
  "spa",
  "massage_spa",
  "sauna",
  "wellness_center",
  "public_bath",
  "temazcal",
  "hot_springs",
  "zoo",
  "aquarium",
  "wildlife_park",
  "indoor_playground",
  "ferris_wheel",
  "planetarium",
  "tourist_attraction",
  "cultural_center",
  "museum",
  "art_museum",
  "history_museum",
  "art_gallery",
  "botanical_garden",
  "observation_deck",
  "market",
  "flea_market",
  "farmers_market",
  // Not a table (MESITA-4571): halls and stadiums sell seats, shops and
  // stands sell goods to go, a food court is a building.
  "concert_hall",
  "concert_venue",
  "amphitheatre",
  "philharmonic_hall",
  "opera_house",
  "auditorium",
  "stadium",
  "arena",
  "vineyard",
  "chocolate_factory",
  "chocolate_shop",
  "confectionery",
  "coffee_roastery",
  "coffee_stand",
  "hot_dog_stand",
  "pizza_delivery",
  "meal_takeaway",
  "food_court",
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
  tea_house: ["coffee"],
  board_game_cafe: ["coffee", "fun"],
  juice_shop: ["healthy", "coffee"],
  juice_bar: ["healthy", "coffee"],
  breakfast_restaurant: ["breakfast"],
  brunch_restaurant: ["breakfast"],
  diner: ["breakfast", "american"],
  breakfast: ["breakfast"],
  brunch: ["breakfast"],
  // Bakery · Dessert
  bagel_shop: ["breakfast", "quick_bite"],
  bakery: ["sweet", "breakfast"],
  pastry_shop: ["sweet", "breakfast"],
  donut_shop: ["sweet", "breakfast"],
  cake_shop: ["sweet"],
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
  // Tacos · Mexican
  taco_restaurant: ["tacos", "mexican", "quick_bite"],
  burrito_restaurant: ["tacos", "mexican", "quick_bite"],
  taco: ["tacos", "mexican", "quick_bite"],
  mexican_restaurant: ["mexican", "tacos", "dinner"],
  tex_mex_restaurant: ["mexican", "tacos", "dinner"],
  mexican: ["mexican", "tacos", "dinner"],
  // Pizza · Italian
  pizza_restaurant: ["pizza", "italian"],
  pizza: ["pizza", "italian"],
  italian_restaurant: ["italian", "dinner"],
  italian: ["italian", "dinner"],
  // Burgers · Wings · Quick
  hamburger_restaurant: ["burgers", "quick_bite", "american", "dinner"],
  burger: ["burgers", "quick_bite", "american", "dinner"],
  chicken_restaurant: ["chicken", "quick_bite"],
  chicken_wings_restaurant: ["chicken"],
  sandwich_shop: ["quick_bite"],
  sandwich: ["quick_bite"],
  deli: ["quick_bite"],
  fast_food_restaurant: ["quick_bite"],
  fast_food: ["quick_bite"],
  hot_dog_restaurant: ["quick_bite"],
  snack_bar: ["quick_bite"],
  cafeteria: ["quick_bite"],
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
  chinese_restaurant: ["asian", "dinner"],
  cantonese_restaurant: ["asian", "dinner"],
  dim_sum_restaurant: ["asian", "dinner"],
  dumpling_restaurant: ["asian"],
  chinese_noodle_restaurant: ["asian"],
  hot_pot_restaurant: ["asian", "dinner"],
  taiwanese_restaurant: ["asian", "dinner"],
  chinese: ["asian", "dinner"],
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
  indian_restaurant: ["asian", "dinner"],
  north_indian_restaurant: ["asian", "dinner"],
  south_indian_restaurant: ["asian", "dinner"],
  pakistani_restaurant: ["asian", "dinner"],
  bangladeshi_restaurant: ["asian", "dinner"],
  sri_lankan_restaurant: ["asian", "dinner"],
  indian: ["asian", "dinner"],
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
  german_restaurant: ["european", "drinks", "dinner"],
  bavarian_restaurant: ["european", "drinks", "dinner"],
  czech_restaurant: ["european", "drinks", "dinner"],
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
  // Dinner, the wide table · Fancy
  restaurant: ["dinner"],
  fine_dining_restaurant: ["fancy", "dinner"],
  fine_dining: ["fancy", "dinner"],
  family_restaurant: ["dinner"],
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
  // Bar · Sports · Hookah (Beer, Cocktails and Wine folded into Bar, MESITA-2930)
  bar: ["drinks"],
  pub: ["drinks"],
  irish_pub: ["drinks"],
  gastropub: ["drinks", "dinner"],
  brewpub: ["drinks", "dinner"],
  brewery: ["drinks"],
  beer_garden: ["drinks"],
  sports_bar: ["drinks"],
  cocktail_bar: ["drinks", "night_out"],
  lounge_bar: ["drinks", "night_out"],
  hookah_bar: ["drinks", "night_out"],
  wine_bar: ["drinks"],
  winery: ["drinks"],
  billiards: ["drinks", "fun"],
  // Night · Club · Music
  night_club: ["night_out"],
  dance_hall: ["night_out"],
  karaoke: ["drinks", "night_out"],
  live_music_venue: ["night_out"],
  comedy_club: ["night_out"],
  // Fun: what a group does with its hands (back with MESITA-4588)
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
  ice_skating_rink: ["fun"],
  water_park: ["fun"],
  amusement_park: ["fun"],
  roller_coaster: ["fun"],
  // Casino (MESITA-4588: "I CAN GET LOT OF EARLY DEALS FROM CASINOS")
  casino: ["casino"],
  // No family (MESITA-2382): a place, not a trip a guest picks.
  ...Object.fromEntries(NO_FAMILY_TYPES.map((t) => [t, ["undefined"] as const])),
  ...Object.fromEntries(RETIRED_RAIL_TYPES.map((t) => [t, ["undefined"] as const])),
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

/**
 * The place screen's Mesita Families box (Pato, MESITA-2924: "add a new
 * section in overview above mesita tags where you call it Mesita Families"):
 * a place's family keys as the chips the box draws, label and emoji from
 * CATALOG_FAMILIES, in family (day-arc) order. Unknown keys and Undefined
 * drop; no families is an empty list (no box). The `profiles` view reads an
 * empty list as `['undefined']`, so Undefined must drop here (MESITA-2954:
 * "IF NO FAMILIES, THEN DON'T SHOW THE BOX").
 */
export function familyChips(
  keys: unknown,
): Array<{ key: CatalogFamilySlug; label: string; emoji: string }> {
  if (!Array.isArray(keys)) return [];
  const wanted = new Set(keys.filter((k): k is string => typeof k === "string"));
  return CATALOG_FAMILIES.filter((f) => f.slug !== "undefined" && wanted.has(f.slug))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((f) => ({ key: f.slug as CatalogFamilySlug, label: f.label, emoji: f.emoji }));
}
