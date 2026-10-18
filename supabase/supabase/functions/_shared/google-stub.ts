// The Google-only card (`googleOnly: true`): a Nearby hit Mesita does not
// own, in the catalog card shape. Search's gray pin, the Map's Google
// scope and the Feed's Google Places rail send the same stub, so the
// client routes all of them the same way (MESITA-2298, MESITA-2302).

import { familiesForGoogleType } from "./sourcing.ts";
import type { NearbyHit } from "./nearby-places.ts";

export function googleStub(hit: NearbyHit, distanceKm: number | null): Record<string, unknown> {
  return {
    id: `g:${hit.placeId}`,
    slug: hit.placeId,
    google_place_id: hit.placeId,
    name: hit.name,
    category: hit.primaryType,
    family_keys: familiesForGoogleType(hit.primaryType),
    category_label: null,
    price_level: null,
    currency: "MXN",
    state: "active",
    lat: hit.lat,
    lng: hit.lng,
    address: hit.address || null,
    timezone: null,
    closes_at: null,
    hours: null,
    // Google's `currentOpeningHours.openNow`: the one fact the timing
    // signal may read for a row with no stored hours (a boost, never a cut).
    open_now: hit.openNow,
    phone: null,
    pitch: null,
    story: null,
    description: null,
    photos: [],
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
    created_at: new Date(0).toISOString(),
    google_stars_overall: hit.rating,
    google_rating: hit.rating,
    google_review_count: hit.reviewCount,
    google_count: hit.reviewCount,
    zone: null,
    city: null,
    // Not a Mesita place, so never enriched: no `enriched_at`, and
    // `googleOnly` excludes it from the Enriched signal by name.
    content_state: "ready",
    enriched_at: null,
    googleOnly: true,
    from_google: true,
    distance_km: distanceKm,
  };
}
