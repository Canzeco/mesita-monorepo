import { describe, expect, it } from "vitest";

import type { PlaceDetail } from "../../place-detail";
import { profileChannelStats, reviewsTabChannelStats } from "./channel-stats.ts";

function basePlace(overrides: Partial<PlaceDetail> = {}): PlaceDetail {
  return {
    id: "p1",
    name: "Strana",
    category: "Night Club",
    price_level: 2,
    price_range: "",
    currency: "MXN",
    distance_km: 0,
    open_now: false,
    opens_at: "",
    closes_at: "",
    timezone: "America/Monterrey",
    city: "",
    address: "",
    lat: null,
    lng: null,
    zone: "",
    created_label: "",
    updated_label: "",
    last_updated_label: "",
    is_enriching: false,
    is_profile_ready: true,
    is_enriched: true,
    request_count: 0,
    request_threshold: 5,
    requested: false,
    request_lifecycle: "enriched",
    photos: [],
    tags: [],
    google: { rating: 3.9, count: 411 },
    facebook: { followers: null },
    instagram: { followers: null },
    google_reviews: [],
    products: { menu: [] },
    long_description: "",
    hours: [],
    popular_times: [],
    links: {},
    reviews_maps: {},
    ...overrides,
  } as PlaceDetail;
}

describe("reviewsTabChannelStats", () => {
  it("always returns Google, Instagram, and Facebook", () => {
    const stats = reviewsTabChannelStats(basePlace());
    expect(stats.map((s) => s.label)).toEqual(["Google", "Instagram", "Facebook"]);
    expect(stats[0]?.value).toBe("411");
    expect(stats[1]?.value).toBe("—");
    expect(stats[2]?.value).toBe("—");
  });
});

describe("profileChannelStats", () => {
  it("omits channels with no numbers", () => {
    const stats = profileChannelStats(basePlace());
    expect(stats.map((s) => s.key)).toEqual(["google"]);
  });
});
