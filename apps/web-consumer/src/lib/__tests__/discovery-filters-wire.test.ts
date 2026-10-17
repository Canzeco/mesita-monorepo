import { describe, expect, it } from "vitest";
import {
  DISCOVERY_FILTER_DEFAULTS,
  type DiscoveryFilters,
} from "@/lib/discovery-filters-engine";
import {
  deckRequestKey,
  UNFILTERED_DECK_KEY,
} from "@/lib/discovery-filters-wire";

function filters(over: Partial<DiscoveryFilters> = {}): DiscoveryFilters {
  return { ...DISCOVERY_FILTER_DEFAULTS, ...over };
}

const HERE = { lat: 19.4326, lng: -99.1332 };

describe("deckRequestKey", () => {
  it("collapses to the unfiltered key when nothing narrows and there is no fix", () => {
    expect(deckRequestKey(filters(), null)).toBe(UNFILTERED_DECK_KEY);
  });

  it("ignores pick order so re-selecting the same set never refetches", () => {
    const a = filters({ familyKeys: ["dinner", "drinks"] });
    const b = filters({ familyKeys: ["drinks", "dinner"] });
    expect(deckRequestKey(a, HERE)).toBe(deckRequestKey(b, HERE));
  });

  it("ignores GPS jitter but moves on a real relocation", () => {
    const jitter = { lat: HERE.lat + 0.0001, lng: HERE.lng - 0.0001 };
    expect(deckRequestKey(filters(), jitter)).toBe(
      deckRequestKey(filters(), HERE),
    );
    expect(deckRequestKey(filters(), { lat: 20.6736, lng: -103.344 })).not.toBe(
      deckRequestKey(filters(), HERE),
    );
  });

  it("moves when the ring changes, and ignores family and reviews", () => {
    const base = deckRequestKey(filters(), HERE);
    expect(deckRequestKey(filters({ familyKeys: ["dinner"] }), HERE)).toBe(base);
    expect(deckRequestKey(filters({ minReviews: 100 }), HERE)).toBe(base);
    expect(
      deckRequestKey(filters({ placesScope: "mesita" }), HERE),
    ).not.toBe(base);
  });
});
