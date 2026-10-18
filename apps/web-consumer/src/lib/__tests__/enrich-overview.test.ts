import { describe, expect, it } from "vitest";
import { enrichPlaceOverview } from "@/lib/adapters/enrich-overview";
import type { Place } from "@/lib/api/places";

// Pins the Enriching signal for catalog cards.
// consumer-web-list-catalog already returns content_state via
// PLACE_CARD_COLUMNS; enrichPlaceOverview must
// map it to is_enriching so a card can say the profile is still being built
// (parity with place detail). Regressions here hide the chip on newly created
// places.

function basePlace(
  overrides: Partial<Place> & Record<string, unknown> = {},
): Place {
  return {
    id: "p1",
    slug: "test-place",
    name: "Test Place",
    category: null,
    price_level: null,
    currency: "MXN",
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
    created_at: "2026-08-05T00:00:00Z",
    ...overrides,
  } as Place;
}

describe("enrichPlaceOverview is_enriching", () => {
  it("is true when content_state is generating", () => {
    const place = enrichPlaceOverview(
      basePlace({ content_state: "generating" }),
    );
    expect(place.is_enriching).toBe(true);
  });

  it("is false when content_state is ready", () => {
    const place = enrichPlaceOverview(basePlace({ content_state: "ready" }));
    expect(place.is_enriching).toBe(false);
  });

  it("is false when content_state is failed", () => {
    const place = enrichPlaceOverview(basePlace({ content_state: "failed" }));
    expect(place.is_enriching).toBe(false);
  });

  it("prefers an explicit is_enriching over content_state", () => {
    const place = enrichPlaceOverview(
      basePlace({ is_enriching: false, content_state: "generating" }),
    );
    expect(place.is_enriching).toBe(false);
  });
});
