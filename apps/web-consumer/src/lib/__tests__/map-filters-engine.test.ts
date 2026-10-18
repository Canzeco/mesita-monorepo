import { describe, expect, it } from "vitest";
import type { Place } from "@/lib/api/places";
import { PLACE_FAMILIES } from "@/lib/place-families";
import {
  clampMinReviews,
  MAP_FILTER_DEFAULTS,
  MAP_MIN_REVIEW_STOPS,
  mapFilterCount,
  mapFiltersAreActive,
  placeSearchScope,
  type MapFilters,
} from "@/lib/map-filters-engine";

function place(over: Partial<Place> = {}): Place {
  return {
    id: "p1",
    slug: "p1",
    name: "Place",
    category: null,
    ...over,
  } as Place;
}

function filters(over: Partial<MapFilters> = {}): MapFilters {
  return { ...MAP_FILTER_DEFAULTS, ...over };
}

describe("placeSearchScope", () => {
  it("is Google's alone for a stub and Mesita Selected for every Mesita row", () => {
    expect(placeSearchScope(place({ googleOnly: true }))).toBe("google");
    expect(placeSearchScope(place({ from_google: true }))).toBe("google");
    // A stub stays Google's even if a payload claims a stamp.
    expect(
      placeSearchScope(place({ googleOnly: true, enriched: true })),
    ).toBe("google");
    expect(
      placeSearchScope(place({ enriched_at: "2026-08-01T00:00:00Z" })),
    ).toBe("selected");
    expect(placeSearchScope(place({ enriched: true }))).toBe("selected");
    // The server sends no Created row on this surface; one that slips
    // through is still a Mesita row, never Google's.
    expect(
      placeSearchScope(place({ content_state: "ready", enriched_at: null })),
    ).toBe("selected");
  });
});

describe("no source switch (MESITA-2384)", () => {
  it("the filters hold Families and Google Reviews only", () => {
    expect(Object.keys(MAP_FILTER_DEFAULTS).sort()).toEqual(["familyKeys", "minReviews"]);
  });
});

describe("mapFilterCount", () => {
  it("defaults to no filter counted", () => {
    expect(mapFiltersAreActive(filters())).toBe(false);
    expect(mapFilterCount(filters())).toBe(0);
  });

  it("counts each Family or a Google Reviews stop as one filter", () => {
    expect(mapFilterCount(filters({ familyKeys: ["dinner"] }))).toBe(1);
    expect(mapFilterCount(filters({ minReviews: 100 }))).toBe(0);
    expect(mapFilterCount(filters({ minReviews: 10 }))).toBe(1);
    expect(mapFilterCount(filters({ minReviews: 1000 }))).toBe(1);
    expect(MAP_FILTER_DEFAULTS.minReviews).toBe(100);
    expect(MAP_FILTER_DEFAULTS).not.toHaveProperty("resultLimit");
  });
});

describe("Google Reviews — 10+ / 100+ / 1,000+, default 100+ (MESITA-2298, MESITA-2336)", () => {
  it("only those three stops, nothing in between; 0+ and 10K+ are gone", () => {
    expect(MAP_MIN_REVIEW_STOPS).toEqual([10, 100, 1000]);
    expect(clampMinReviews(0)).toBe(10);
    expect(clampMinReviews(10)).toBe(10);
    expect(clampMinReviews(100)).toBe(100);
    expect(clampMinReviews(1000)).toBe(1000);
    expect(clampMinReviews(10000)).toBe(1000);
    expect(clampMinReviews(5)).toBe(10);
    expect(clampMinReviews(50)).toBe(10);
    expect(clampMinReviews(55)).toBe(100);
    expect(clampMinReviews(500)).toBe(100);
    expect(clampMinReviews(550)).toBe(1000);
    expect(clampMinReviews(-4)).toBe(10);
  });

  it("an absent or unreadable value is the default, 100+; a stored 0 (the retired 0+) lands on 10+", () => {
    expect(clampMinReviews(undefined)).toBe(100);
    expect(clampMinReviews("x")).toBe(100);
    expect(clampMinReviews("0")).toBe(10);
    expect(clampMinReviews(0)).toBe(10);
  });
});

describe("PLACE_FAMILIES catalog (final law)", () => {
  it("is fifteen guest families plus Undefined last", () => {
    expect(PLACE_FAMILIES).toHaveLength(16);
    expect(PLACE_FAMILIES.map((f) => f.key)).toEqual([
      "coffee",
      "breakfast",
      "quick_bite",
      "pizza",
      "tacos",
      "sushi",
      "burgers",
      "noodles",
      "dinner",
      "sweet",
      "drinks",
      "night_out",
      "go_out",
      "move",
      "feel_better",
      "undefined",
    ]);
    const last = PLACE_FAMILIES[PLACE_FAMILIES.length - 1]!;
    expect(last.key).toBe("undefined");
    expect(last.label).toBe("Undefined");
  });
});
