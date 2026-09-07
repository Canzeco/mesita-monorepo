// TODO(EF): Feed — this whole dataset is a parked mock (Pato, MESITA-1621:
// "use mock data for the moment for the feed view"). The catalog is empty in
// every environment right now, so a Feed wired only to the live deck is a
// permanent "No places yet" card and the mode cannot be looked at, reviewed
// or QA'd at all.
//
// IT IS A FALLBACK, NOT A REPLACEMENT. PlaceFeed prefers the real deck and
// drops to this only when the deck comes back empty — so the day the catalog
// fills, Feed shows real places with no code change. Deleting this file is
// then a one-line edit in PlaceFeed, which is the point of keeping the seam
// there rather than here.
//
// NEVER MIXED. The feed renders all-real or all-mock; a grid with three live
// places and five invented ones is the failure mode this shape rules out.
//
// Rows are `Place` (the EF row), not `PlaceDetail` (mock/place.ts, the
// place-DETAIL fixture) — the tiles read `Place`, and a tap navigates to
// /place/<slug>, where the detail screen serves its own fixture.

import type { Place } from "@/lib/api/places";

// picsum, not Unsplash: seeded URLs are stable per slug, so a tile keeps the
// same photo across reloads instead of reshuffling every render. Any https
// host loads (next.config's remotePatterns is a wildcard).
const photo = (seed: string) => `https://picsum.photos/seed/${seed}/400/600`;

// Monterrey, matching the fallback city the rest of the consumer app uses
// when device location is unavailable.
type Seed = {
  slug: string;
  name: string;
  category: string;
  vibe: string;
  zone: string;
  price_level: number;
  distance_km: number;
  open_now: boolean;
  closes_at: string;
  promoting: boolean;
};

const SEEDS: Seed[] = [
  {
    slug: "casa-morena",
    name: "Casa Morena",
    category: "Restaurant",
    vibe: "Courtyard tables, mezcal, long dinners",
    zone: "Barrio Antiguo",
    price_level: 3,
    distance_km: 1.2,
    open_now: true,
    closes_at: "23:00",
    promoting: true,
  },
  {
    slug: "cafe-regio",
    name: "Café Regio",
    category: "Coffee",
    vibe: "Small-batch roast, morning light",
    zone: "Del Valle",
    price_level: 1,
    distance_km: 0.6,
    open_now: true,
    closes_at: "20:00",
    promoting: false,
  },
  {
    slug: "terraza-nogal",
    name: "Terraza Nogal",
    category: "Bar",
    vibe: "Rooftop, cerro views, late",
    zone: "San Pedro",
    price_level: 3,
    distance_km: 3.4,
    open_now: true,
    closes_at: "02:00",
    promoting: true,
  },
  {
    slug: "mercado-lupita",
    name: "Mercado Lupita",
    category: "Street food",
    vibe: "Ten stalls, one long counter",
    zone: "Centro",
    price_level: 1,
    distance_km: 2.1,
    open_now: false,
    closes_at: "18:00",
    promoting: false,
  },
  {
    slug: "el-jardin-bistro",
    name: "El Jardín Bistro",
    category: "Bistro",
    vibe: "Set menu, six tables, no rush",
    zone: "Contry",
    price_level: 4,
    distance_km: 5.8,
    open_now: true,
    closes_at: "22:30",
    promoting: false,
  },
  {
    slug: "sala-norte",
    name: "Sala Norte",
    category: "Live music",
    vibe: "Standing room, local bands, loud",
    zone: "Obispado",
    price_level: 2,
    distance_km: 2.9,
    open_now: true,
    closes_at: "01:00",
    promoting: true,
  },
  {
    slug: "panaderia-sierra",
    name: "Panadería Sierra",
    category: "Bakery",
    vibe: "Out of conchas by nine",
    zone: "Cumbres",
    price_level: 1,
    distance_km: 4.3,
    open_now: false,
    closes_at: "14:00",
    promoting: false,
  },
  {
    slug: "taqueria-la-huasteca",
    name: "Taquería La Huasteca",
    category: "Tacos",
    vibe: "Trompo out front, plastic chairs",
    zone: "Santa Catarina",
    price_level: 1,
    distance_km: 7.2,
    open_now: true,
    closes_at: "03:00",
    promoting: true,
  },
];

// Every non-display column takes the same inert default — the tiles read
// name, photo, zone, distance, opening state and the promo chip, and nothing
// else on this row is reachable from the feed. Fields are spelled out rather
// than cast so a change to `Place` fails HERE, at compile time, instead of
// rendering a blank cell.
function toPlace(seed: Seed, i: number): Place {
  return {
    id: `mock-feed-${i + 1}`,
    slug: seed.slug,
    name: seed.name,
    category: seed.category,
    category_label: seed.category,
    vibe: seed.vibe,
    price_level: seed.price_level,
    currency: "MXN",
    listing_type: seed.promoting ? "partner" : "web",
    state: "active",
    fiscal_type: "informal",
    plan: "free",
    lat: null,
    lng: null,
    address: null,
    closes_at: seed.closes_at,
    phone: null,
    pitch: null,
    story: null,
    photos: [photo(seed.slug)],
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
    created_at: "2026-01-01T00:00:00.000Z",
    // Overview parity — what the tile actually paints.
    open_now: seed.open_now,
    distance_km: seed.distance_km,
    zone: seed.zone,
    promoting: seed.promoting,
    partner: seed.promoting,
    enriched: true,
    city: "Monterrey",
  };
}

export const FEED_MOCK_PLACES: Place[] = SEEDS.map(toPlace);
