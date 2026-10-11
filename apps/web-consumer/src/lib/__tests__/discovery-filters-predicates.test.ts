import { describe, expect, it } from "vitest";
import type { Place } from "@/lib/api/places";
import {
  DISCOVERY_FILTER_DEFAULTS,
  applyDiscoveryFilters,
  clampReviewFloor,
  countAppliedDiscoveryFilters,
  hasDiscoveryPredicates,
  parsePlacesScope,
  type DiscoveryFilters,
} from "@/lib/discovery-filters-engine";

function place(over: Partial<Place> = {}): Place {
  return {
    id: "p1",
    slug: "p1",
    name: "Place",
    category: null,
    ...over,
  } as Place;
}

function filters(over: Partial<DiscoveryFilters> = {}): DiscoveryFilters {
  return { ...DISCOVERY_FILTER_DEFAULTS, ...over };
}

const busy = place({ id: "busy", google_count: 200 });
const quiet = place({ id: "quiet", google_count: 20 });
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
    expect(countAppliedDiscoveryFilters(filters())).toBe(0);
  });
});

describe("Family", () => {
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
  it("defaults to the inner ring, Mesita", () => {
    expect(DISCOVERY_FILTER_DEFAULTS.placesScope).toBe("mesita");
  });

  it("parses the two words and lands everything else on the default", () => {
    expect(parsePlacesScope("google")).toBe("google");
    expect(parsePlacesScope(" MESITA ")).toBe("mesita");
    // The retired paid ring, still in a persisted v6 blob.
    expect(parsePlacesScope("partners")).toBe("mesita");
    expect(parsePlacesScope(undefined)).toBe("mesita");
    expect(parsePlacesScope(3)).toBe("mesita");
  });

  it("mesita at default is a pass-through — the host, not the engine, drops Google stubs", () => {
    const deck = [busy, quiet, googleStub];
    expect(applyDiscoveryFilters(deck, filters({ placesScope: "mesita" }))).toBe(
      deck,
    );
  });

  it("mesita with another predicate set still drops the Google stub", () => {
    const kept = applyDiscoveryFilters(
      [busy, quiet, googleStub],
      filters({ placesScope: "mesita", minReviews: 10 }),
    );
    expect(kept.map((p) => p.id)).toEqual(["busy", "quiet"]);
  });

  it("google keeps the stubs too", () => {
    const kept = applyDiscoveryFilters(
      [busy, quiet, googleStub],
      filters({ placesScope: "google" }),
    );
    expect(kept.map((p) => p.id)).toEqual(["busy", "quiet", "google"]);
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

  it("drops places below the floor and places with no count", () => {
    const none = place({ id: "none" });
    const kept = applyDiscoveryFilters(
      [busy, quiet, none],
      filters({ minReviews: 100 }),
    );
    expect(kept.map((p) => p.id)).toEqual(["busy"]);
  });
});

describe("predicates compose", () => {
  it("a place must satisfy every set predicate", () => {
    const kept = applyDiscoveryFilters(
      [busy, quiet],
      filters({
        familyKeys: ["restaurants"],
        placesScope: "google",
        minReviews: 10,
      }),
    );
    expect(kept).toEqual([]);
    const matching = place({
      id: "hit",
      family_keys: ["restaurants"],
      google_count: 400,
    });
    expect(
      applyDiscoveryFilters(
        [matching, quiet, googleStub],
        filters({
          familyKeys: ["restaurants"],
          placesScope: "mesita",
          minReviews: 100,
        }),
      ).map((p) => p.id),
    ).toEqual(["hit"]);
  });
});
