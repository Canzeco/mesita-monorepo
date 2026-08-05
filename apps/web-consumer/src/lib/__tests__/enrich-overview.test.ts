import { describe, expect, it } from "vitest";
import { enrichPlaceOverview } from "@/lib/mock/enrich-overview";
import type { Place } from "@/lib/api/places";

// Pins the Enriching signal for swipe / catalog cards. recommend-swipe already
// returns content_status via PLACE_PUBLIC_COLUMNS; enrichPlaceOverview must
// map it to is_enriching so SwipeCardInfo can lead the tag row (parity with
// place detail). Regressions here hide the chip on newly created places.

function basePlace(
  overrides: Partial<Place> & Record<string, unknown> = {},
): Place {
  return {
    id: "p1",
    slug: "test-place",
    name: "Test Place",
    category: null,
    vibe: null,
    price_level: null,
    currency: "MXN",
    listing_type: "web",
    status: "active",
    fiscal_type: "informal",
    plan: "free",
    lat: null,
    lng: null,
    address: null,
    closes_at: null,
    phone: null,
    pitch: null,
    story: null,
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
    email: null,
    created_at: "2026-08-05T00:00:00Z",
    ...overrides,
  } as Place;
}

describe("enrichPlaceOverview is_enriching", () => {
  it("is true when content_status is queued", () => {
    const place = enrichPlaceOverview(
      basePlace({ content_status: "queued" }),
    );
    expect(place.is_enriching).toBe(true);
  });

  it("is true when content_status is generating", () => {
    const place = enrichPlaceOverview(
      basePlace({ content_status: "generating" }),
    );
    expect(place.is_enriching).toBe(true);
  });

  it("is false when content_status is ready", () => {
    const place = enrichPlaceOverview(basePlace({ content_status: "ready" }));
    expect(place.is_enriching).toBe(false);
  });

  it("is false when content_status is failed", () => {
    const place = enrichPlaceOverview(basePlace({ content_status: "failed" }));
    expect(place.is_enriching).toBe(false);
  });

  it("prefers an explicit is_enriching over content_status", () => {
    const place = enrichPlaceOverview(
      basePlace({ is_enriching: false, content_status: "generating" }),
    );
    expect(place.is_enriching).toBe(false);
  });
});
