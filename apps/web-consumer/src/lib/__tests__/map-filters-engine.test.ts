import { describe, expect, it } from "vitest";
import type { Place } from "@/lib/api/places";
import { PLACE_FAMILIES } from "@/lib/place-families";
import {
  clampMinReviews,
  MAP_PLACES_SCOPE_DEFAULT,
  MAP_FILTER_DEFAULTS,
  MAP_MIN_REVIEW_STOPS,
  MAP_SEARCH_STOPS,
  mapFilterCount,
  mapFiltersAreActive,
  parsePlacesScope,
  placeSearchScope,
  placesScopeCounts,
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

describe("placesScopeCounts", () => {
  const enriched = place({ id: "e", enriched: true });
  const stub = place({ id: "g:x", googleOnly: true });

  it("counts cumulatively: the sets nest, selected ≤ google", () => {
    const counts = placesScopeCounts([enriched, stub, enriched]);
    expect(counts).toEqual({ selected: 2, google: 3 });
    expect(counts.selected).toBeLessThanOrEqual(counts.google);
  });

  it("is zero everywhere on an empty catalog", () => {
    expect(placesScopeCounts([])).toEqual({ selected: 0, google: 0 });
  });
});

describe("places scope", () => {
  it("is two stops, Google Places then Mesita Selected, and never says Enriched", () => {
    expect(MAP_SEARCH_STOPS.map((s) => s.key)).toEqual(["google", "selected"]);
    expect(MAP_SEARCH_STOPS.map((s) => s.tick)).toEqual([
      "Google Places",
      "Mesita Selected",
    ]);
    for (const stop of MAP_SEARCH_STOPS) {
      expect(stop.ring).toBe(stop.key);
      expect(`${stop.tick} ${stop.label} ${stop.hint}`).not.toMatch(/enriched/i);
    }
  });

  it("resolves anything unknown to Mesita Selected", () => {
    expect(MAP_PLACES_SCOPE_DEFAULT).toBe("selected");
    expect(parsePlacesScope(undefined)).toBe("selected");
    expect(parsePlacesScope(null)).toBe("selected");
    expect(parsePlacesScope("GOOGLE")).toBe("google");
    expect(parsePlacesScope(" Selected ")).toBe("selected");
    // The retired paid ring, still in a persisted v6 blob, lands on the
    // default — never on a wider set.
    expect(parsePlacesScope("partners")).toBe("selected");
  });

  it("maps the retired words and ordinals a persisted blob may carry", () => {
    expect(parsePlacesScope("enriched")).toBe("selected");
    expect(parsePlacesScope(" Mesita ")).toBe("selected");
    expect(parsePlacesScope(1)).toBe("selected");
    expect(parsePlacesScope("1")).toBe("selected");
    expect(parsePlacesScope(0)).toBe("selected");
    expect(parsePlacesScope(2)).toBe("google");
    expect(parsePlacesScope(3)).toBe("google");
  });
});

describe("mapFilterCount", () => {
  it("defaults to Mesita Selected with no filter counted", () => {
    expect(MAP_FILTER_DEFAULTS.placesScope).toBe("selected");
    expect(mapFiltersAreActive(filters())).toBe(false);
    expect(mapFilterCount(filters())).toBe(0);
  });

  it("counts leaving the default scope, each Family, or a Google Reviews stop as one filter", () => {
    expect(mapFilterCount(filters({ placesScope: "google" }))).toBe(1);
    expect(
      mapFilterCount(
        filters({ placesScope: "selected", familyKeys: ["dinner"] }),
      ),
    ).toBe(1);
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
