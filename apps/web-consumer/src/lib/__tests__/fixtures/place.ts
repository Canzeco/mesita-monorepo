import type { Place } from "@/lib/api/places";

// ONE LISTED PLACE FOR RENDER TESTS. It lives here, beside the tests, because
// the app ships no invented places (MESITA-2095): `no-invented-places.test.ts`
// fails any file under src/ outside the tests that imports a fixture or mock
// module. A real uuid, not a sentinel prefix — the card cannot tell it apart
// from a row the deck EF returned, which is the point.

const photo = (id: string) =>
  `https://images.unsplash.com/photo-${id}?w=1080&q=80&auto=format&fit=crop`;

export function testPlace(overrides: Partial<Place> = {}): Place {
  return {
    id: "3f2a9c1e-0000-4000-8000-000000000000",
    slug: "taqueria-test",
    name: "Taquería Test",
    category: "taqueria",
    category_label: "Tacos",
    family_keys: ["restaurants"],
    price_level: 1,
    currency: "MXN",
    lat: 25.6694,
    lng: -100.3098,
    address: "Calle Morelos 812, Centro, Monterrey, N.L.",
    zone: "Centro",
    closes_at: "02:00",
    opens_at: null,
    open_now: true,
    google_rating: 4.7,
    google_count: 2310,
    instagram_followers_count: 18400,
    phone: null,
    pitch: "Al pastor off the trompo until two in the morning.",
    story: null,
    photos: [
      photo("1613514785940-daed07799d9b"),
      photo("1599974579688-8dbdd335c77f"),
      photo("1551504734-5ee1c4a1479b"),
    ],
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
    created_at: "2026-10-10T00:00:00.000Z",
    is_enriching: false,
    ...overrides,
  };
}
