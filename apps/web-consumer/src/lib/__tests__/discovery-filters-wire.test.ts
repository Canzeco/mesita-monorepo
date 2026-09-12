import { describe, expect, it } from "vitest";
import {
  DISCOVERY_FILTER_DEFAULTS,
  type DiscoveryFilters,
} from "@/lib/discovery-filters-engine";
import {
  deckRequestKey,
  toDeckRequest,
  UNFILTERED_DECK_KEY,
} from "@/lib/discovery-filters-wire";

function filters(over: Partial<DiscoveryFilters> = {}): DiscoveryFilters {
  return { ...DISCOVERY_FILTER_DEFAULTS, ...over };
}

const HERE = { lat: 19.4326, lng: -99.1332 };

describe("toDeckRequest", () => {
  it("sends no predicates when nothing narrows", () => {
    expect(toDeckRequest(filters(), null, 50)).toEqual({ limit: 50 });
  });

  it("still ships coordinates when location is connected, even with no cut", () => {
    expect(toDeckRequest(filters(), HERE, 50)).toEqual({
      limit: 50,
      lat: HERE.lat,
      lng: HERE.lng,
    });
  });

  it("carries Super Category, scope, and review floor once any of them narrows", () => {
    const req = toDeckRequest(
      filters({ familyKeys: ["restaurants"], minReviews: 100 }),
      HERE,
      50,
    );
    expect(req.predicates).toEqual({
      familyKeys: ["restaurants"],
      placesScope: "mesita",
      minReviews: 100,
    });
    expect(req.lat).toBe(HERE.lat);
  });
});

describe("deckRequestKey", () => {
  it("collapses to the unfiltered key when nothing narrows and there is no fix", () => {
    expect(deckRequestKey(filters(), null)).toBe(UNFILTERED_DECK_KEY);
  });

  it("ignores pick order so re-selecting the same set never refetches", () => {
    const a = filters({ familyKeys: ["restaurants", "bars_nightlife"] });
    const b = filters({ familyKeys: ["bars_nightlife", "restaurants"] });
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

  it("moves whenever a predicate does", () => {
    const base = deckRequestKey(filters({ familyKeys: ["restaurants"] }), HERE);
    expect(
      deckRequestKey(filters({ familyKeys: ["bars_nightlife"] }), HERE),
    ).not.toBe(base);
    expect(
      deckRequestKey(
        filters({ familyKeys: ["restaurants"], placesScope: "partners" }),
        HERE,
      ),
    ).not.toBe(base);
    expect(
      deckRequestKey(
        filters({ familyKeys: ["restaurants"], minReviews: 100 }),
        HERE,
      ),
    ).not.toBe(base);
  });
});
