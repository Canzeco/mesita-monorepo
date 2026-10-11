// SCROLL'S FRONTEND MOCK (MESITA-2105). Twelve invented Monterrey places that
// Home › Scroll shows instead of the real deck while SCROLL_USES_MOCK is on.
//
// THIS REVERSES A LAW ON PURPOSE. On 2026-09-08 Pato killed the last mock
// ("don't put shitty mock data") and Scroll cycled whatever was real instead.
// On 2026-10-10 he asked for the opposite, live: "for the moment use mock data
// written in the frontend". The design review settled HOW so it cannot rot
// into the thing everyone demos by accident:
//
//   · ONE switch, ONE file. Scroll reads only this when the switch is on; it
//     never mixes these rows with real ones (2A).
//   · A mock card answers every tap without touching real data: save fills the
//     heart in memory only, Profile / Share / Reserve raise a "Sample place"
//     toast,
//     and nothing reaches Favs, analytics or a place URL (3A). `isMockPlace`
//     is the one test every handler asks first.
//   · The exit is MESITA-2095: flip the switch off, delete this file, restore
//     the "invents no places" pin.
//
// The rows are their own narrow type and the base is deliberately untyped;
// `scrollMockPlaces()` spreads them into `Place`, and `tsc` checks the result.
//
// THE PHOTOS ARE REAL AND MATCHED. A full-bleed feed is mostly photo, so a
// taquería cannot wear a canyon. Each URL is an Unsplash photo whose subject
// matches the place, checked for HTTP 200 before commit; a dead one falls back
// to the ink placeholder on the card, never a broken image.

import type { Place } from "@/lib/api/places";

/** Home › Scroll reads ONLY these rows while true. MESITA-2095 flips it. */
export const SCROLL_USES_MOCK = true;

const MOCK_ID_PREFIX = "mock-";

/** True for a row from this file. Every Scroll handler that would reach real
 *  data (Favs, analytics, a place URL, a ticket) asks this first. */
export function isMockPlace(place: { id: string } | null | undefined): boolean {
  return typeof place?.id === "string" && place.id.startsWith(MOCK_ID_PREFIX);
}

const unsplash = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=1080&q=80&auto=format&fit=crop`;

/** The display fields a Scroll card reads. Everything else comes from the
 *  shared base. Enum-ish fields are written as their literal unions so each
 *  app's `Place` accepts them. */
type ScrollMockRow = {
  slug: string;
  name: string;
  category: string;
  category_label: string;
  family_keys: string[];
  price_level: 1 | 2 | 3 | 4;
  zone: string;
  address: string;
  lat: number;
  lng: number;
  google_rating: number;
  google_count: number;
  instagram_followers_count: number | null;
  open_now: boolean;
  opens_at: string | null;
  closes_at: string;
  pitch: string;
  photos: string[];
};

const ROWS: ScrollMockRow[] = [
  {
    slug: "taqueria-la-lupita",
    name: "Taquería La Lupita",
    category: "taqueria",
    category_label: "Tacos",
    family_keys: ["restaurants"],
    price_level: 1,
    zone: "Centro",
    address: "Calle Morelos 812, Centro, Monterrey, N.L.",
    lat: 25.6694,
    lng: -100.3098,
    google_rating: 4.7,
    google_count: 2310,
    instagram_followers_count: 18400,
    open_now: true,
    opens_at: null,
    closes_at: "02:00",
    pitch:
      "Al pastor carved off the trompo until two in the morning, with a salsa bar that has no business being this good.",
    photos: [
      unsplash("1613514785940-daed07799d9b"),
      unsplash("1599974579688-8dbdd335c77f"),
      unsplash("1551504734-5ee1c4a1479b"),
    ],
  },
  {
    slug: "tacos-el-guero-de-mitras",
    name: "Tacos El Güero de Mitras",
    category: "taqueria",
    category_label: "Tacos",
    family_keys: ["restaurants"],
    price_level: 1,
    zone: "Mitras Centro",
    address: "Av. Simón Bolívar 1450, Mitras Centro, Monterrey, N.L.",
    lat: 25.688,
    lng: -100.348,
    google_rating: 4.5,
    google_count: 870,
    instagram_followers_count: 3200,
    open_now: true,
    opens_at: null,
    closes_at: "23:30",
    pitch:
      "Bistec and trompo on handmade tortillas, a squeeze of lime, and the line out the door that tells you where to stop.",
    photos: [
      unsplash("1565299585323-38d6b0865b47"),
      unsplash("1624300629298-e9de39c13be5"),
    ],
  },
  {
    slug: "cafe-silla",
    name: "Café Silla",
    category: "cafe",
    category_label: "Coffee",
    family_keys: ["cafes_bakeries"],
    price_level: 2,
    zone: "San Pedro",
    address: "Calzada del Valle 400, Del Valle, San Pedro Garza García, N.L.",
    lat: 25.6573,
    lng: -100.365,
    google_rating: 4.8,
    google_count: 1540,
    instagram_followers_count: 26100,
    open_now: true,
    opens_at: null,
    closes_at: "21:00",
    pitch:
      "Single-origin pour-overs from Chiapas and Veracruz, a long table by the window, and the best flat white on the Calzada.",
    photos: [
      unsplash("1509042239860-f550ce710b93"),
      unsplash("1495474472287-4d71bcdd2085"),
      unsplash("1445116572660-236099ec97a0"),
    ],
  },
  {
    slug: "moka-antiguo",
    name: "Moka Antiguo",
    category: "cafe",
    category_label: "Coffee",
    family_keys: ["cafes_bakeries"],
    price_level: 2,
    zone: "Barrio Antiguo",
    address: "Calle Mina 905, Barrio Antiguo, Monterrey, N.L.",
    lat: 25.6668,
    lng: -100.3045,
    google_rating: 4.6,
    google_count: 640,
    instagram_followers_count: 9800,
    open_now: false,
    opens_at: "08:00",
    closes_at: "20:00",
    pitch:
      "A converted casona with a garden patio, slow espresso and conchas still warm from the oven at eight.",
    photos: [
      unsplash("1554118811-1e0d58224f24"),
      unsplash("1501339847302-ac426a4a7cbb"),
    ],
  },
  {
    slug: "mezcal-santa-lucia",
    name: "Mezcal Santa Lucía",
    category: "mezcal_bar",
    category_label: "Mezcal bar",
    family_keys: ["bars_nightlife"],
    price_level: 2,
    zone: "Barrio Antiguo",
    address: "Paseo Santa Lucía 1200, Barrio Antiguo, Monterrey, N.L.",
    lat: 25.6697,
    lng: -100.3005,
    google_rating: 4.7,
    google_count: 1180,
    instagram_followers_count: 14700,
    open_now: true,
    opens_at: null,
    closes_at: "01:00",
    pitch:
      "Forty mezcales from Oaxaca and Durango, poured by people who will happily talk you through every one.",
    photos: [
      unsplash("1514362545857-3bc16c4c7d1b"),
      unsplash("1514933651103-005eec06c04b"),
      unsplash("1556679343-c7306c1976bc"),
    ],
  },
  {
    slug: "salon-fundidora",
    name: "Salón Fundidora",
    category: "cocktail_bar",
    category_label: "Cocktails",
    family_keys: ["bars_nightlife"],
    price_level: 3,
    zone: "Obrera",
    address: "Av. Fundidora 501, Obrera, Monterrey, N.L.",
    lat: 25.678,
    lng: -100.284,
    google_rating: 4.4,
    google_count: 520,
    instagram_followers_count: 21300,
    open_now: false,
    opens_at: "18:00",
    closes_at: "02:00",
    pitch:
      "Steel beams from the old foundry, a back bar lit like a stage, and a highball list built around local citrus.",
    photos: [
      unsplash("1551024709-8f23befc6f87"),
      unsplash("1470337458703-46ad1756a187"),
    ],
  },
  {
    slug: "cocina-obispado",
    name: "Cocina Obispado",
    category: "restaurant",
    category_label: "Modern Mexican",
    family_keys: ["restaurants"],
    price_level: 3,
    zone: "Obispado",
    address: "Av. Hidalgo 2300, Obispado, Monterrey, N.L.",
    lat: 25.6775,
    lng: -100.342,
    google_rating: 4.8,
    google_count: 960,
    instagram_followers_count: 32500,
    open_now: true,
    opens_at: null,
    closes_at: "23:00",
    pitch:
      "A seven-course norteño tasting menu under the hill, with arrachera aged in-house and a wine list that leans Valle de Guadalupe.",
    photos: [
      unsplash("1414235077428-338989a2e8c0"),
      unsplash("1504674900247-0877df9cc836"),
      unsplash("1517248135467-4c7edcad34c4"),
    ],
  },
  {
    slug: "asador-regio",
    name: "Asador Regio",
    category: "steakhouse",
    category_label: "Carne asada",
    family_keys: ["restaurants"],
    price_level: 3,
    zone: "San Pedro",
    address: "Av. Vasconcelos 150, San Pedro Garza García, N.L.",
    lat: 25.6531,
    lng: -100.3587,
    google_rating: 4.6,
    google_count: 3420,
    instagram_followers_count: 12900,
    open_now: true,
    opens_at: null,
    closes_at: "00:00",
    pitch:
      "Sunday carne asada every day of the week: sirloin and short rib over mesquite, cebollitas, and frijoles charros.",
    photos: [
      unsplash("1558030006-450675393462"),
      unsplash("1544025162-d76694265947"),
      unsplash("1600891964092-4316c288032e"),
    ],
  },
  {
    slug: "forno-valle",
    name: "Forno Valle",
    category: "pizzeria",
    category_label: "Pizza",
    family_keys: ["restaurants"],
    price_level: 2,
    zone: "Valle Oriente",
    address: "Av. Lázaro Cárdenas 2400, Valle Oriente, San Pedro Garza García, N.L.",
    lat: 25.6417,
    lng: -100.329,
    google_rating: 4.5,
    google_count: 1270,
    instagram_followers_count: 8600,
    open_now: true,
    opens_at: null,
    closes_at: "23:30",
    pitch:
      "Neapolitan dough proofed for 48 hours and fired at 480 degrees, ninety seconds from oven to table.",
    photos: [
      unsplash("1574071318508-1cdbab80d002"),
      unsplash("1513104890138-7c749659a591"),
      unsplash("1565299624946-b28f40a0ae38"),
    ],
  },
  {
    slug: "bun-cumbres",
    name: "Bun Cumbres",
    category: "burger",
    category_label: "Burgers",
    family_keys: ["restaurants"],
    price_level: 2,
    zone: "Cumbres",
    address: "Av. Paseo de los Leones 3100, Cumbres, Monterrey, N.L.",
    lat: 25.733,
    lng: -100.4,
    google_rating: 4.3,
    google_count: 2050,
    instagram_followers_count: 5400,
    open_now: true,
    opens_at: null,
    closes_at: "23:00",
    pitch:
      "Smashed double patties, potato buns from the bakery next door, and fries that stay crisp all the way home.",
    photos: [
      unsplash("1568901346375-23c9450c58cd"),
      unsplash("1550547660-d9450f859349"),
      unsplash("1571091718767-18b5b1457add"),
    ],
  },
  {
    slug: "kai-sushi",
    name: "Kai Sushi",
    category: "sushi",
    category_label: "Sushi",
    family_keys: ["restaurants"],
    price_level: 3,
    zone: "Del Valle",
    address: "Río Missouri 300, Del Valle, San Pedro Garza García, N.L.",
    lat: 25.656,
    lng: -100.36,
    google_rating: 4.6,
    google_count: 780,
    instagram_followers_count: 11200,
    open_now: false,
    opens_at: "13:00",
    closes_at: "23:00",
    pitch:
      "An eight-seat counter, fish flown in twice a week, and an omakase that changes with whatever came off the plane.",
    photos: [
      unsplash("1579871494447-9811cf80d66c"),
      unsplash("1553621042-f6e147245754"),
    ],
  },
  {
    slug: "ramen-kaze",
    name: "Ramen Kaze",
    category: "ramen",
    category_label: "Ramen",
    family_keys: ["restaurants"],
    price_level: 2,
    zone: "Contry",
    address: "Av. Eugenio Garza Lagüera 820, Contry, Monterrey, N.L.",
    lat: 25.628,
    lng: -100.283,
    google_rating: 4.5,
    google_count: 610,
    instagram_followers_count: null,
    open_now: true,
    opens_at: null,
    closes_at: "22:30",
    pitch:
      "Tonkotsu simmered for eighteen hours, a jammy ajitama on top, and noodles pulled fresh every afternoon.",
    photos: [
      unsplash("1569718212165-3a8278d5f624"),
      unsplash("1557872943-16a5ac26437e"),
    ],
  },
];

// Deliberately NOT typed as `Place`: the spread in scrollMockPlaces() is
// checked against this app's `Place` for what it supplies, not for what the
// base alone would have to satisfy.
const MOCK_BASE = {
  vibe: null,
  currency: "MXN",
  phone: null,
  story: null,
  website_url: null,
  instagram_url: null,
  facebook_url: null,
  whatsapp_url: null,
  opentable_url: null,
  resy_url: null,
  uber_eats_url: null,
  x_url: null,
  threads_url: null,
  reddit_url: null,
  didi_food_url: null,
  google_maps_url: null,
  email: null,
  created_at: "2026-10-10T00:00:00.000Z",
  is_enriching: false,
};

/** The twelve mock places as this app's own `Place`. */
export function scrollMockPlaces(): Place[] {
  return ROWS.map((row) => ({
    ...MOCK_BASE,
    ...row,
    id: `${MOCK_ID_PREFIX}${row.slug}`,
  }));
}
