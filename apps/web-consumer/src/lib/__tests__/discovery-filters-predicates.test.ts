import { describe, expect, it } from "vitest";
import type { Place } from "@/lib/api/places";
import {
  DISCOVERY_FILTER_DEFAULTS,
  applyDiscoveryFilters,
  clampReviewFloor,
  countAppliedDiscoveryFilters,
  discoveryFiltersAreActive,
  formatReviewFloor,
  hasDiscoveryPredicates,
  type DiscoveryFilters,
} from "@/lib/discovery-filters-engine";

function place(over: Partial<Place> = {}): Place {
  return {
    id: "p1",
    slug: "p1",
    name: "Place",
    category: null,
    listing_type: "web",
    ...over,
  } as Place;
}

function filters(over: Partial<DiscoveryFilters> = {}): DiscoveryFilters {
  return { ...DISCOVERY_FILTER_DEFAULTS, ...over };
}

const partner = place({ id: "partner", partner: true, google_count: 200 });
const listed = place({ id: "listed", partner: false, google_count: 20 });
const googleStub = place({
  id: "google",
  googleOnly: true,
  google_count: 5000,
});

describe("no predicate set is a pass-through, not a filter", () => {
  it("returns the array untouched when nothing narrows", () => {
    const deck = [place({ id: "a" }), place({ id: "b" })];
    expect(applyDiscoveryFilters(deck, filters())).toBe(deck);
  });

  it("defaults are not an applied filter", () => {
    expect(hasDiscoveryPredicates(filters())).toBe(false);
    expect(discoveryFiltersAreActive(filters())).toBe(false);
    expect(countAppliedDiscoveryFilters(filters())).toBe(0);
  });
});

describe("Super Category", () => {
  it("keeps a place whose family is selected", () => {
    const taco = place({ id: "taco", family_keys: ["restaurants"] });
    const spa = place({ id: "spa", family_keys: ["wellness_beauty"] });
    const kept = applyDiscoveryFilters(
      [taco, spa],
      filters({ familyKeys: ["restaurants"] }),
    );
    expect(kept.map((p) => p.id)).toEqual(["taco"]);
  });
});

describe("Scope", () => {
  it("partners keeps only paying places", () => {
    const kept = applyDiscoveryFilters(
      [partner, listed, googleStub],
      filters({ placesScope: "partners" }),
    );
    expect(kept.map((p) => p.id)).toEqual(["partner"]);
  });

  it("mesita at default is a pass-through — the host, not the engine, drops Google stubs", () => {
    const deck = [partner, listed, googleStub];
    expect(applyDiscoveryFilters(deck, filters({ placesScope: "mesita" }))).toBe(
      deck,
    );
  });

  it("google keeps the stubs too", () => {
    const kept = applyDiscoveryFilters(
      [partner, listed, googleStub],
      filters({ placesScope: "google" }),
    );
    expect(kept.map((p) => p.id)).toEqual(["partner", "listed", "google"]);
  });
});

describe("Google review floor", () => {
  it("clamps to the named stops", () => {
    expect(clampReviewFloor(0)).toBe(0);
    expect(clampReviewFloor(7)).toBe(10);
    expect(clampReviewFloor(50)).toBe(10);
    expect(clampReviewFloor(80)).toBe(100);
    expect(clampReviewFloor(4000)).toBe(1000);
  });

  it("labels the stops without numerals in the thousands", () => {
    expect(formatReviewFloor(0)).toBe("Any");
    expect(formatReviewFloor(10)).toBe("10+");
    expect(formatReviewFloor(1000)).toBe("1k+");
    expect(formatReviewFloor(10000)).toBe("10k+");
  });

  it("drops places below the floor and places with no count", () => {
    const none = place({ id: "none" });
    const kept = applyDiscoveryFilters(
      [partner, listed, none],
      filters({ minReviews: 100 }),
    );
    expect(kept.map((p) => p.id)).toEqual(["partner"]);
  });
});

describe("predicates compose", () => {
  it("a place must satisfy every set predicate", () => {
    const kept = applyDiscoveryFilters(
      [partner, listed],
      filters({
        familyKeys: ["restaurants"],
        placesScope: "partners",
        minReviews: 10,
      }),
    );
    expect(kept).toEqual([]);
    const matching = place({
      id: "hit",
      partner: true,
      family_keys: ["restaurants"],
      google_count: 400,
    });
    expect(
      applyDiscoveryFilters(
        [matching, listed],
        filters({
          familyKeys: ["restaurants"],
          placesScope: "partners",
          minReviews: 100,
        }),
      ).map((p) => p.id),
    ).toEqual(["hit"]);
  });
});
