// The Google-only card (`googleOnly: true`): a Nearby hit Mesita does not
// own, in the catalog card shape. Search's gray pin, the Map's Google
// scope and the Feed's Google Places rail send the same stub, so the
// client routes all of them the same way (MESITA-2298, MESITA-2302). It
// carries everything the Nearby mask returns (MESITA-2313): the readable
// type, price, stars and review count, open now, the short address, phone,
// website and the Maps link, so the card and its opening profile show what
// a Mesita card shows.

import { placeFamilies } from "./sourcing.ts";
import { priceLevelFromGoogle } from "./enrich-google-basics-normalizers.ts";
import type { NearbyHit } from "./nearby-places.ts";

/** `sports_bar` → "Sports bar": the fallback when Google sends no label. */
export function humanizeGoogleType(slug: string | null | undefined): string | null {
  const words = (slug ?? "").trim().replace(/_/g, " ");
  if (!words) return null;
  return words[0].toUpperCase() + words.slice(1);
}

export function googleStub(hit: NearbyHit, distanceKm: number | null): Record<string, unknown> {
  return {
    id: `g:${hit.placeId}`,
    slug: hit.placeId,
    google_place_id: hit.placeId,
    name: hit.name,
    category: hit.primaryType,
    // Primary first, then 0–2 secondary from Google's types[] (MESITA-2438).
    family_keys: placeFamilies(hit.primaryType, hit.types).keys,
    category_label: hit.typeLabel ?? humanizeGoogleType(hit.primaryType),
    price_level: priceLevelFromGoogle(hit.priceLevel ?? undefined),
    currency: "MXN",
    state: "active",
    lat: hit.lat,
    lng: hit.lng,
    address: hit.shortAddress || hit.address || null,
    timezone: null,
    closes_at: null,
    hours: null,
    // Google's `currentOpeningHours.openNow`: the one fact the timing
    // signal may read for a row with no stored hours (a boost, never a cut).
    open_now: hit.openNow,
    phone: hit.phone ?? null,
    pitch: null,
    story: null,
    description: null,
    photos: [],
    website_url: hit.website ?? null,
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
    google_maps_url: hit.mapsUri ?? null,
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
