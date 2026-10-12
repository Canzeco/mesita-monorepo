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
});
