import { describe, expect, it } from "vitest";
import type { Place } from "@/lib/api/places";
import { PLACE_FAMILIES } from "@/lib/place-families";
import { MAP_FILTER_DEFAULTS, placeSearchScope } from "@/lib/map-filters-engine";

function place(over: Partial<Place> = {}): Place {
  return {
    id: "p1",
    slug: "p1",
    name: "Place",
    category: null,
    ...over,
  } as Place;
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

describe("the family chips are the only guest filter (MESITA-2384, MESITA-2417)", () => {
  it("holds family keys alone: no source, no How many, no Google reviews stop", () => {
    expect(Object.keys(MAP_FILTER_DEFAULTS)).toEqual(["familyKeys"]);
    expect(MAP_FILTER_DEFAULTS.familyKeys).toEqual([]);
  });
});

describe("PLACE_FAMILIES catalog (final law)", () => {
  it("is twelve guest families plus Undefined last", () => {
    expect(PLACE_FAMILIES).toHaveLength(13);
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
      "undefined",
    ]);
    const last = PLACE_FAMILIES[PLACE_FAMILIES.length - 1]!;
    expect(last.key).toBe("undefined");
    expect(last.label).toBe("Undefined");
  });
});
