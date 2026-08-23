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
  it("sends no predicates when nothing narrows — the deployed-binary payload", () => {
    expect(toDeckRequest(filters(), HERE, 50)).toEqual({ limit: 50 });
    // A zone alone only recenters distances; it excludes nothing, so it must
    // not turn into a server cut either.
    const zoned = filters({
      zone: { label: "Polanco", lat: 19.43, lng: -99.19 },
    });
    expect(toDeckRequest(zoned, HERE, 50)).toEqual({ limit: 50 });
  });

  it("carries the four predicates once any of them narrows", () => {
    const req = toDeckRequest(filters({ when: { mode: "now" } }), HERE, 50);
    expect(req.predicates).toEqual({
      context: "any",
      familyKeys: [],
      categories: [],
      maxKm: null,
      when: { mode: "now" },
    });
  });

  it("only ships the center when a radius needs it", () => {
    // lat/lng also feed Proximity, so sending them unconditionally would
    // re-rank the deck the moment a geolocation fix lands.
    const noRadius = toDeckRequest(filters({ context: "visit" }), HERE, 50);
    expect(noRadius.lat).toBeUndefined();
    expect(noRadius.lng).toBeUndefined();

    const withRadius = toDeckRequest(filters({ maxKm: 2 }), HERE, 50);
    expect(withRadius.lat).toBe(HERE.lat);
    expect(withRadius.lng).toBe(HERE.lng);
  });
});

describe("deckRequestKey", () => {
  it("collapses to the unfiltered key when nothing narrows", () => {
    expect(deckRequestKey(filters(), HERE)).toBe(UNFILTERED_DECK_KEY);
    expect(deckRequestKey(filters(), null)).toBe(UNFILTERED_DECK_KEY);
  });

  it("ignores pick order so re-selecting the same set never refetches", () => {
    const a = filters({ familyKeys: ["restaurants", "bars_nightlife"] });
    const b = filters({ familyKeys: ["bars_nightlife", "restaurants"] });
    expect(deckRequestKey(a, HERE)).toBe(deckRequestKey(b, HERE));
  });

  it("ignores GPS jitter but moves on a real relocation", () => {
    const f = filters({ maxKm: 2 });
    const jitter = { lat: HERE.lat + 0.0001, lng: HERE.lng - 0.0001 };
    expect(deckRequestKey(f, jitter)).toBe(deckRequestKey(f, HERE));
    expect(deckRequestKey(f, { lat: 20.6736, lng: -103.344 })).not.toBe(
      deckRequestKey(f, HERE),
    );
  });

  it("does not move on a center change the server would ignore", () => {
    const f = filters({ context: "visit" });
    expect(deckRequestKey(f, null)).toBe(deckRequestKey(f, HERE));
  });

  it("moves whenever a predicate does", () => {
    const base = deckRequestKey(filters({ maxKm: 2 }), HERE);
    expect(deckRequestKey(filters({ maxKm: 5 }), HERE)).not.toBe(base);
    expect(
      deckRequestKey(filters({ maxKm: 2, when: { mode: "now" } }), HERE),
    ).not.toBe(base);
    expect(
      deckRequestKey(
        filters({ maxKm: 2, when: { mode: "at", day: 6, hour: 21 } }),
        HERE,
      ),
    ).not.toBe(
      deckRequestKey(
        filters({ maxKm: 2, when: { mode: "at", day: 6, hour: 12 } }),
        HERE,
      ),
    );
    expect(
      deckRequestKey(filters({ maxKm: 2, categories: ["spa"] }), HERE),
    ).not.toBe(base);
  });
});
