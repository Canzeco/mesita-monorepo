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
  it("names the narrowest ring a place is in — enrichment gates the inner ring", () => {
    expect(
      placeSearchScope(place({ enriched_at: "2026-08-01T00:00:00Z" })),
    ).toBe("enriched");
    expect(placeSearchScope(place({ enriched: true }))).toBe("enriched");
    expect(placeSearchScope(place({ googleOnly: true }))).toBe("google");
    expect(placeSearchScope(place({ from_google: true }))).toBe("google");
    // A stub stays Google's even if a payload claims a stamp.
    expect(
      placeSearchScope(place({ googleOnly: true, enriched: true })),
    ).toBe("google");
  });

  it("puts a Created place in Mesita Places, never Enriched (MESITA-2154/2158)", () => {
    // Create saves content_state ready and never stamps enriched_at: the
    // profile can be shown, so it is a Mesita place — but NOT enriched.
    expect(
      placeSearchScope(place({ content_state: "ready", enriched_at: null })),
    ).toBe("mesita");
    expect(
      placeSearchScope(place({ content_state: "ready", enriched: false })),
    ).toBe("mesita");
    expect(placeSearchScope(place())).toBe("mesita");
  });
});

describe("placesScopeCounts", () => {
  const enriched = place({ id: "e", enriched: true });
  const created = place({ id: "c", content_state: "ready", enriched: false });
  const stub = place({ id: "g:x", googleOnly: true });

  it("counts cumulatively: the rings nest, enriched ≤ mesita ≤ google", () => {
    const counts = placesScopeCounts([enriched, created, stub, created]);
    expect(counts).toEqual({ enriched: 1, mesita: 3, google: 4 });
    expect(counts.enriched).toBeLessThanOrEqual(counts.mesita);
    expect(counts.mesita).toBeLessThanOrEqual(counts.google);
  });

  it("is zero everywhere on an empty catalog", () => {
    expect(placesScopeCounts([])).toEqual({ enriched: 0, mesita: 0, google: 0 });
  });
});

describe("places scope", () => {
  it("is three stops, outer to inner, in Pato's words", () => {
    expect(MAP_SEARCH_STOPS.map((s) => s.key)).toEqual([
      "google",
      "mesita",
      "enriched",
    ]);
    expect(MAP_SEARCH_STOPS.map((s) => s.tick)).toEqual([
      "Google Places",
      "Mesita Places",
      "Mesita Enriched Places",
    ]);
    // On the Map each stop paints its own ring.
    for (const stop of MAP_SEARCH_STOPS) expect(stop.ring).toBe(stop.key);
  });

  it("resolves anything unknown to the INNER ring", () => {
    expect(MAP_PLACES_SCOPE_DEFAULT).toBe("enriched");
    expect(parsePlacesScope(undefined)).toBe("enriched");
    expect(parsePlacesScope(null)).toBe("enriched");
    expect(parsePlacesScope("GOOGLE")).toBe("google");
    expect(parsePlacesScope(" Mesita ")).toBe("mesita");
    expect(parsePlacesScope("enriched")).toBe("enriched");
    // The retired paid ring, still in a persisted v6 blob, lands on the
    // default — never on a wider set.
    expect(parsePlacesScope("partners")).toBe("enriched");
  });

  it("keeps the legacy ordinals' OLD meanings: 1 was Mesita Places", () => {
    expect(parsePlacesScope(1)).toBe("mesita");
    expect(parsePlacesScope("1")).toBe("mesita");
    expect(parsePlacesScope(0)).toBe("mesita");
    expect(parsePlacesScope(2)).toBe("google");
    expect(parsePlacesScope(3)).toBe("google");
  });
});

describe("mapFilterCount", () => {
  it("defaults to Mesita Enriched Places with no filter counted", () => {
    expect(MAP_FILTER_DEFAULTS.placesScope).toBe("enriched");
    expect(mapFiltersAreActive(filters())).toBe(false);
    expect(mapFilterCount(filters())).toBe(0);
  });

  it("counts leaving the default ring, each Family, or Popularity as one filter", () => {
    expect(mapFilterCount(filters({ placesScope: "google" }))).toBe(1);
    expect(mapFilterCount(filters({ placesScope: "mesita" }))).toBe(1);
    expect(
      mapFilterCount(
        filters({ placesScope: "enriched", familyKeys: ["dinner"] }),
      ),
    ).toBe(1);
    expect(mapFilterCount(filters({ minReviews: 0 }))).toBe(0);
    expect(mapFilterCount(filters({ minReviews: 10 }))).toBe(1);
    expect(mapFilterCount(filters({ minReviews: 10000 }))).toBe(1);
    expect(MAP_FILTER_DEFAULTS.minReviews).toBe(0);
    expect(MAP_FILTER_DEFAULTS).not.toHaveProperty("resultLimit");
  });
});

describe("Popularity — 0 / 10 / 100 / 1000 / 10000", () => {
  it("only those five stops, nothing in between", () => {
    expect(MAP_MIN_REVIEW_STOPS).toEqual([0, 10, 100, 1000, 10000]);
    expect(clampMinReviews(0)).toBe(0);
    expect(clampMinReviews(10)).toBe(10);
    expect(clampMinReviews(100)).toBe(100);
    expect(clampMinReviews(1000)).toBe(1000);
    expect(clampMinReviews(10000)).toBe(10000);
    expect(clampMinReviews(5)).toBe(10);
    expect(clampMinReviews(50)).toBe(10);
    expect(clampMinReviews(55)).toBe(100);
    expect(clampMinReviews(500)).toBe(100);
    expect(clampMinReviews(550)).toBe(1000);
    expect(clampMinReviews(undefined)).toBe(0);
    expect(clampMinReviews(-4)).toBe(0);
  });
});

describe("PLACE_FAMILIES catalog (final law)", () => {
  it("is twenty guest families plus Undefined last", () => {
    expect(PLACE_FAMILIES).toHaveLength(21);
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
      "wine",
      "night_out",
      "live",
      "go_out",
      "with_kids",
      "outdoors",
      "culture",
      "move",
      "feel_better",
      "undefined",
    ]);
    const last = PLACE_FAMILIES[PLACE_FAMILIES.length - 1]!;
    expect(last.key).toBe("undefined");
    expect(last.label).toBe("Undefined");
  });
});
