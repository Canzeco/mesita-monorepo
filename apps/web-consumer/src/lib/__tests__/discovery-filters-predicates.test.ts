import { describe, expect, it } from "vitest";
import {
  DISCOVERY_FILTER_DEFAULTS,
  countAppliedDiscoveryFilters,
  hasDiscoveryPredicates,
  parsePlacesScope,
  type DiscoveryFilters,
} from "@/lib/discovery-filters-engine";

function filters(over: Partial<DiscoveryFilters> = {}): DiscoveryFilters {
  return { ...DISCOVERY_FILTER_DEFAULTS, ...over };
}

describe("no predicate set", () => {
  it("defaults are not an applied filter", () => {
    expect(hasDiscoveryPredicates(filters())).toBe(false);
    expect(countAppliedDiscoveryFilters(filters())).toBe(0);
  });

  it("a stored family or review floor is not a catalog filter", () => {
    expect(hasDiscoveryPredicates(filters({ familyKeys: ["dinner"] }))).toBe(
      false,
    );
    expect(countAppliedDiscoveryFilters(filters({ minReviews: 100 }))).toBe(0);
  });
});

describe("Scope", () => {
  it("defaults to the inner ring", () => {
    expect(DISCOVERY_FILTER_DEFAULTS.placesScope).toBe("enriched");
  });

  it("parses the two Mesita words and lands Google on the inner ring", () => {
    expect(parsePlacesScope("enriched")).toBe("enriched");
    expect(parsePlacesScope(" MESITA ")).toBe("mesita");
    expect(parsePlacesScope("google")).toBe("enriched");
    expect(parsePlacesScope("partners")).toBe("enriched");
    expect(parsePlacesScope(undefined)).toBe("enriched");
    expect(parsePlacesScope(3)).toBe("enriched");
  });
});
