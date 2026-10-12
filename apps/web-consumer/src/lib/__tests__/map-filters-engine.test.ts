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
  it("names the ring a place is in — enrichment gates the Mesita ring", () => {
    expect(
      placeSearchScope(place({ enriched_at: "2026-08-01T00:00:00Z" })),
    ).toBe("mesita");
    expect(placeSearchScope(place({ enriched: true }))).toBe("mesita");
    expect(placeSearchScope(place({ googleOnly: true }))).toBe("google");
    expect(placeSearchScope(place({ from_google: true }))).toBe("google");
  });

  it("keeps a Created place out of the Mesita ring (MESITA-2154)", () => {
    // Create saves content_state ready and never stamps enriched_at: the
    // profile can be shown, but it is NOT enriched. The server only sends
    // one on the Google ring, painted onto its Google hit.
    expect(
      placeSearchScope(place({ content_state: "ready", enriched_at: null })),
    ).toBe("google");
    expect(
      placeSearchScope(place({ content_state: "ready", enriched: false })),
    ).toBe("google");
    expect(placeSearchScope(place({ content_state: "generating" }))).toBe(
      "google",
    );
    expect(placeSearchScope(place())).toBe("google");
  });
});

describe("places scope", () => {
  it("is two stops, Mesita first, and the sheet reads them in that order", () => {
    expect(MAP_SEARCH_STOPS.map((s) => s.key)).toEqual(["mesita", "google"]);
  });

  it("resolves anything unknown to the INNER ring", () => {
    expect(MAP_PLACES_SCOPE_DEFAULT).toBe("mesita");
    expect(parsePlacesScope(undefined)).toBe("mesita");
    expect(parsePlacesScope(null)).toBe("mesita");
    expect(parsePlacesScope("GOOGLE")).toBe("google");
    // The retired paid ring, still in a persisted v6 blob, lands on the
    // default — never on the wider set.
    expect(parsePlacesScope("partners")).toBe("mesita");
    expect(parsePlacesScope(1)).toBe("mesita");
    expect(parsePlacesScope(2)).toBe("google");
    expect(parsePlacesScope(0)).toBe("mesita");
  });
});

describe("mapFilterCount", () => {
  it("defaults to Mesita Enriched Places with no filter counted", () => {
    expect(MAP_FILTER_DEFAULTS.placesScope).toBe("mesita");
    expect(mapFiltersAreActive(filters())).toBe(false);
    expect(mapFilterCount(filters())).toBe(0);
  });

  it("counts leaving the default ring, each Family, or Popularity as one filter", () => {
    expect(mapFilterCount(filters({ placesScope: "google" }))).toBe(1);
    expect(
      mapFilterCount(
        filters({ placesScope: "mesita", familyKeys: ["restaurants"] }),
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
  it("is eight pills in table order, Other last, text-only labels", () => {
    expect(PLACE_FAMILIES).toHaveLength(8);
    expect(PLACE_FAMILIES.map((f) => f.key)).toEqual([
      "restaurants",
      "cafes_bakeries",
      "bars_nightlife",
      "experiences",
      "culture_arts",
      "sports_fitness",
      "wellness_beauty",
      "undefined",
    ]);
    const last = PLACE_FAMILIES[PLACE_FAMILIES.length - 1]!;
    expect(last.key).toBe("undefined");
    expect(last.label).toBe("Undefined");
  });
});
