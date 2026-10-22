import { describe, expect, it } from "vitest";

import type { PlaceDetail } from "../../place-detail";
import { profileChannelStats } from "./channel-stats";

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
    hours_table: [],
    popular_times: [],
    channels: {},
    reviews_maps: {},
    ...overrides,
  } as PlaceDetail;
}

describe("profileChannelStats", () => {
  it("keeps every channel, and fills the number line when it is not connected", () => {
    const stats = profileChannelStats(basePlace());
    expect(stats.map((s) => s.key)).toEqual(["google", "instagram", "facebook"]);
    expect(stats[0]?.value).toBe("3.9 ★");
    expect(stats[0]?.detail).toBe("(411)");
    expect(stats[0]?.label).toBe("Google");
    expect(stats[1]).toMatchObject({
      value: "-",
      spoken: "not connected",
      label: "Instagram",
      mention: true,
    });
    expect(stats[2]).toMatchObject({
      value: "-",
      spoken: "not connected",
      label: "Facebook",
      mention: true,
    });
    expect(stats.every((s) => s.value !== "")).toBe(true);
  });

  it("shows a zero instead of hiding it", () => {
    const stats = profileChannelStats(
      basePlace({
        instagram: { followers: 0 },
        facebook: { followers: 0 },
        channels: { instagram_url: "https://instagram.com/strana" },
      }),
    );
    expect(stats[1]).toMatchObject({ value: "0", label: "Instagram" });
    expect(stats[1]?.mention).toBeUndefined();
    expect(stats[2]).toMatchObject({ value: "0", label: "Facebook" });
  });

  it("shows - (spoken: no count) when the link is saved and the number is not", () => {
    const stats = profileChannelStats(
      basePlace({
        channels: {
          instagram_url: "https://instagram.com/strana",
          facebook_url: "https://facebook.com/strana",
        },
      }),
    );
    expect(stats[1]).toMatchObject({ value: "-", spoken: "no count", label: "Instagram" });
    expect(stats[2]).toMatchObject({ value: "-", spoken: "no count", label: "Facebook" });
  });
});
