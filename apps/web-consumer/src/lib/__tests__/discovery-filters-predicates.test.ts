import { describe, expect, it } from "vitest";
import type { Place } from "@/lib/api/places";
import {
  DISCOVERY_FILTER_DEFAULTS,
  applyDiscoveryFilters,
  deriveCategoryOptions,
  discoveryFiltersAreActive,
  hasDiscoveryPredicates,
  type DiscoveryFilters,
} from "@/lib/discovery-filters-engine";

// The three predicates the context test does NOT cover — Where/distance, When,
// and What — plus the two invariants that have to survive the discovery
// rebuild (MESITA-1236).
//
// This surface was deleted whole in MESITA-1183 and restored minus its
// randomness level. The restore is the risky part: the code is a month old,
// the catalogue it filters is now a 50-card server sample, and the engine that
// will eventually replace it scores rather than cuts. So the rules that must
// not drift are asserted here rather than left in a comment.

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

/** Mon–Sun 09:00–17:00, so "open" is a real question with a real answer. */
const NINE_TO_FIVE = {
  monday: [{ open: "09:00", close: "17:00" }],
  tuesday: [{ open: "09:00", close: "17:00" }],
  wednesday: [{ open: "09:00", close: "17:00" }],
  thursday: [{ open: "09:00", close: "17:00" }],
  friday: [{ open: "09:00", close: "17:00" }],
  saturday: [{ open: "09:00", close: "17:00" }],
  sunday: [{ open: "09:00", close: "17:00" }],
};

describe("no predicate set is a pass-through, not a filter", () => {
  it("returns the array untouched when nothing narrows", () => {
    const deck = [place({ id: "a" }), place({ id: "b" })];
    expect(applyDiscoveryFilters(deck, filters())).toBe(deck);
  });

  it("a zone alone recenters distances but excludes nobody", () => {
    // Picking "Roma Norte" must not delete the catalogue — it moves the origin
    // every distance is measured from. The narrowing is maxKm, separately.
    const f = filters({ zone: { lat: 19.4, lng: -99.16, label: "Roma Norte" } as never });
    expect(hasDiscoveryPredicates(f)).toBe(false);
    // ...but it IS a deviation from defaults, so the rail dot must light.
    expect(discoveryFiltersAreActive(f)).toBe(true);
  });
});

describe("how far — the distance tolerance", () => {
  const near = place({ id: "near", distance_km: 1.2 });
  const far = place({ id: "far", distance_km: 30 });
  const unknown = place({ id: "unknown" });
  const placeholder = place({ id: "placeholder", distance_km: 0 });

  it("keeps places inside the radius and drops the ones outside", () => {
    const kept = applyDiscoveryFilters([near, far], filters({ maxKm: 5 }));
    expect(kept.map((p) => p.id)).toEqual(["near"]);
  });

  it("an unknown distance fails a radius rather than sneaking through", () => {
    // Honest exclusion: "within 5 km" must not return a place we cannot place.
    expect(applyDiscoveryFilters([unknown], filters({ maxKm: 5 }))).toEqual([]);
  });

  it("treats distance_km 0 as the could-not-calculate placeholder, not as 0 km", () => {
    // Real readings floor at 0.1. A literal 0 means the host had no fix, and
    // reading it as "you are standing in it" would top the deck with it.
    expect(applyDiscoveryFilters([placeholder], filters({ maxKm: 5 }))).toEqual(
      [],
    );
  });

  it("the boundary is inclusive — exactly maxKm is inside", () => {
    const edge = place({ id: "edge", distance_km: 5 });
    expect(applyDiscoveryFilters([edge], filters({ maxKm: 5 }))).toHaveLength(1);
  });
});

describe("when — open at the asked-for moment", () => {
  const withHours = place({ id: "hours", hours: NINE_TO_FIVE as never });
  const noHours = place({ id: "no-hours" });
  const emptyHours = place({ id: "empty-hours", hours: {} as never });

  it("no hours table means we cannot confirm open, so it is excluded", () => {
    const f = filters({ when: { mode: "at", day: 3, hour: 12 } });
    expect(applyDiscoveryFilters([noHours], f)).toEqual([]);
  });

  it("an EMPTY hours object is treated the same as none", () => {
    const f = filters({ when: { mode: "at", day: 3, hour: 12 } });
    expect(applyDiscoveryFilters([emptyHours], f)).toEqual([]);
  });

  it("keeps a place open at the asked-for weekday and hour", () => {
    const f = filters({ when: { mode: "at", day: 3, hour: 12 } });
    expect(applyDiscoveryFilters([withHours], f)).toHaveLength(1);
  });

  it("drops it at an hour it is shut", () => {
    const f = filters({ when: { mode: "at", day: 3, hour: 3 } });
    expect(applyDiscoveryFilters([withHours], f)).toEqual([]);
  });

  it("anytime is neutral — a place with no hours at all still shows", () => {
    expect(
      applyDiscoveryFilters([noHours], filters({ when: { mode: "anytime" } })),
    ).toHaveLength(1);
  });
});

describe("what — families OR categories, never AND", () => {
  const taco = place({
    id: "taco",
    category: "taqueria",
    family_keys: ["restaurants"],
  });
  const bar = place({ id: "bar", category: "cocktail_bar", family_keys: ["bars"] });

  it("a family match is enough on its own", () => {
    const kept = applyDiscoveryFilters(
      [taco, bar],
      filters({ familyKeys: ["bars"] as never }),
    );
    expect(kept.map((p) => p.id)).toEqual(["bar"]);
  });

  it("a category match is enough on its own", () => {
    const kept = applyDiscoveryFilters(
      [taco, bar],
      filters({ categories: ["taqueria"] }),
    );
    expect(kept.map((p) => p.id)).toEqual(["taco"]);
  });

  it("the two tiers OR — a place hit by EITHER survives", () => {
    // AND would be a trap: picking family "bars" plus category "taqueria"
    // would return nothing, and the guest would read an empty deck as a bug.
    const kept = applyDiscoveryFilters(
      [taco, bar],
      filters({ familyKeys: ["bars"] as never, categories: ["taqueria"] }),
    );
    expect(kept.map((p) => p.id).sort()).toEqual(["bar", "taco"]);
  });

  it("a category in two Super Categories matches either family pill", () => {
    const brunch = place({
      id: "brunch",
      category: "brunch",
      family_keys: ["restaurants", "cafes_bakeries"],
    });
    expect(
      applyDiscoveryFilters(
        [brunch, taco],
        filters({ familyKeys: ["cafes_bakeries"] }),
      ).map((p) => p.id),
    ).toEqual(["brunch"]);
    expect(
      applyDiscoveryFilters(
        [brunch, taco],
        filters({ familyKeys: ["restaurants"] }),
      ).map((p) => p.id),
    ).toEqual(["brunch", "taco"]);
  });

  it("a place with no family_keys on the wire matches nothing by family", () => {
    // The teardown deliberately kept `family_keys` on the wire for exactly
    // this reason — _shared/place-pool-shape.ts: "drop it and the filter
    // silently matches nothing." This is that failure, pinned.
    const stripped = place({ id: "stripped", category: "taqueria" });
    expect(
      applyDiscoveryFilters([stripped], filters({ familyKeys: ["restaurants"] as never })),
    ).toEqual([]);
  });
});

describe("predicates compose — every one of them cuts", () => {
  it("a place must satisfy ALL set predicates, not any", () => {
    const rightKindWrongDistance = place({
      id: "close-call",
      category: "taqueria",
      distance_km: 40,
    });
    const kept = applyDiscoveryFilters(
      [rightKindWrongDistance],
      filters({ categories: ["taqueria"], maxKm: 5 }),
    );
    expect(kept).toEqual([]);
  });
});

describe("the category list never strands the guest", () => {
  it("derives options from the RAW deck, so narrowing never deletes the way back", () => {
    // Derived from the filtered deck instead, picking "taqueria" would leave
    // "taqueria" as the only option and the guest could not switch to bars.
    const deck = [
      place({ id: "a", category: "taqueria" }),
      place({ id: "b", category: "cocktail_bar" }),
    ];
    const options = deriveCategoryOptions(deck);
    expect(options.length).toBeGreaterThanOrEqual(2);
    expect(options.map((o) => o.slug).sort()).toEqual([
      "cocktail_bar",
      "taqueria",
    ]);
  });
});

describe("the rule that must survive the discovery rebuild", () => {
  it("has no randomness knob — that is a signal, not a filter", () => {
    // Restoring it would mean tearing it out again when the seven signals
    // land, and it would be a SECOND client-side random source beside the
    // server's Fisher-Yates shuffle.
    expect("randomness" in DISCOVERY_FILTER_DEFAULTS).toBe(false);
  });

  it("a predicate EXCLUDES — there is no score a ranker could revive it with", () => {
    // Predicates cut, signals rank, and the cut runs first. applyDiscoveryFilters
    // returns a shorter ARRAY, not a re-weighted one: an excluded place is
    // absent, not present-at-0.0. If the rebuild ever expresses "open now" as a
    // soft signal instead, a hard filter and a soft signal will disagree on the
    // same deck and the guest will believe the filter.
    const open = place({ id: "open", hours: NINE_TO_FIVE as never });
    const shut = place({ id: "shut" });
    const kept = applyDiscoveryFilters(
      [open, shut],
      filters({ when: { mode: "at", day: 3, hour: 12 } }),
    );
    expect(kept).toHaveLength(1);
    expect(kept.some((p) => p.id === "shut")).toBe(false);
  });
});
