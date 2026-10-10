import { describe, expect, it } from "vitest";

import {
  isMockPlace,
  scrollMockPlaces,
} from "@/lib/mock/scroll-places";
import {
  DISCOVERY_FILTER_DEFAULTS,
  applyDiscoveryFilters,
} from "@/lib/discovery-filters-engine";
import { FILTERABLE_PLACE_FAMILIES } from "@/lib/place-families";

// Scroll's frontend mock (MESITA-2105) is the whole feed while the switch is
// on, so every row must carry every field a card prints and every filter
// reads — a row missing one renders a hole on a full-screen card.
describe("Scroll's mock places", () => {
  const rows = scrollMockPlaces();
  const families = new Set(FILTERABLE_PLACE_FAMILIES.map((f) => f.key));

  it("is twelve distinct places, every one marked as mock", () => {
    expect(rows).toHaveLength(12);
    expect(new Set(rows.map((r) => r.id)).size).toBe(12);
    expect(new Set(rows.map((r) => r.slug)).size).toBe(12);
    for (const row of rows) {
      expect(row.id.startsWith("mock-")).toBe(true);
      expect(isMockPlace(row)).toBe(true);
    }
  });

  it("never marks a real id as mock", () => {
    expect(isMockPlace({ id: "3f2a9c1e-0000-4000-8000-000000000000" })).toBe(false);
    expect(isMockPlace({ id: "" })).toBe(false);
    expect(isMockPlace(null)).toBe(false);
  });

  it("carries every field the card prints", () => {
    for (const row of rows) {
      expect(row.name.trim()).not.toBe("");
      expect(row.category_label).toBeTruthy();
      expect(row.price_level).toBeGreaterThanOrEqual(1);
      expect(row.zone).toBeTruthy();
      expect(row.google_rating).toBeGreaterThan(0);
      expect(row.google_count).toBeGreaterThan(0);
      expect(row.closes_at).toBeTruthy();
      expect(row.pitch).toBeTruthy();
      if (row.open_now === false) expect(row.opens_at).toBeTruthy();
    }
  });

  it("has at least two matched https photos per place, none repeated", () => {
    const all = rows.flatMap((r) => r.photos);
    expect(new Set(all).size).toBe(all.length);
    for (const row of rows) {
      expect(row.photos.length).toBeGreaterThanOrEqual(2);
      for (const url of row.photos) {
        expect(url).toMatch(/^https:\/\/images\.unsplash\.com\/photo-[0-9]+-[0-9a-f]+\?/);
      }
    }
  });

  it("sits in Monterrey and in families the filter sheet offers", () => {
    for (const row of rows) {
      expect(row.lat).toBeGreaterThan(25.55);
      expect(row.lat).toBeLessThan(25.8);
      expect(row.lng).toBeGreaterThan(-100.5);
      expect(row.lng).toBeLessThan(-100.2);
      expect(row.family_keys?.length).toBeGreaterThan(0);
      for (const key of row.family_keys ?? []) {
        expect(families.has(key as never)).toBe(true);
      }
    }
  });

  // The filter disc stays on the mock feed, so it must still cut something.
  it("answers the guest's filters like real rows", () => {
    const base = DISCOVERY_FILTER_DEFAULTS;
    expect(applyDiscoveryFilters(rows, base)).toHaveLength(12);
    const bars = applyDiscoveryFilters(rows, {
      ...base,
      familyKeys: ["bars_nightlife"],
    });
    expect(bars.map((r) => r.slug).sort()).toEqual([
      "mezcal-santa-lucia",
      "salon-fundidora",
    ]);
    const busy = applyDiscoveryFilters(rows, {
      ...base,
      minReviews: 10000,
    });
    expect(busy).toHaveLength(0);
  });
});
