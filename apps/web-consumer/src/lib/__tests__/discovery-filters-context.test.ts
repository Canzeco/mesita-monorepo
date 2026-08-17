import { describe, expect, it } from "vitest";
import type { Place } from "@/lib/api/places";
import {
  DISCOVERY_CONTEXTS,
  DISCOVERY_CONTEXT_META,
  DISCOVERY_FILTER_DEFAULTS,
  applyDiscoveryFilters,
  discoveryContextIsSoon,
  hasDiscoveryPredicates,
  type DiscoveryFilters,
} from "@/lib/discovery-filters-engine";

// The CONTEXT axis (MESITA-1081) — the cut that runs before Where/When/What,
// mirroring promos v11. `visit` must be a REAL predicate (a place that pays
// for a body in the room), and `order` must stay unselectable while the remote
// context is parked.

function place(over: Partial<Place> = {}): Place {
  return {
    id: "p1",
    slug: "p1",
    name: "Place",
    category: null,
    listing_type: "partner",
    ...over,
  } as Place;
}

/** A partner running the conservative visits ladder. */
const rewarding = place({
  id: "rewarding",
  listing_type: "partner",
  welcome_free_rate: 20,
  welcome_premium_rate: 30,
  free_rate: 10,
  premium_rate: 20,
});

/** A partner with no rates set — listed, but pays nothing for a visit. */
const noReward = place({ id: "no-reward", listing_type: "partner" });

/** A web listing that never ran the program. */
const webListing = place({ id: "web", listing_type: "web" });

function filters(over: Partial<DiscoveryFilters> = {}): DiscoveryFilters {
  return { ...DISCOVERY_FILTER_DEFAULTS, ...over };
}

describe("discovery context axis", () => {
  it("defaults to `any` and narrows nothing", () => {
    expect(DISCOVERY_FILTER_DEFAULTS.context).toBe("any");
    const f = filters();
    expect(hasDiscoveryPredicates(f)).toBe(false);
    const all = [rewarding, noReward, webListing];
    // Same array back — the memo-stability contract for a predicate-free set.
    expect(applyDiscoveryFilters(all, f)).toBe(all);
  });

  it("`visit` keeps only places that reward a visit", () => {
    const f = filters({ context: "visit" });
    expect(hasDiscoveryPredicates(f)).toBe(true);
    expect(
      applyDiscoveryFilters([rewarding, noReward, webListing], f).map(
        (p) => p.id,
      ),
    ).toEqual(["rewarding"]);
  });

  it("`visit` is a real cut — it is not the same set as `any`", () => {
    const all = [rewarding, noReward, webListing];
    expect(applyDiscoveryFilters(all, filters({ context: "visit" })).length).not.toBe(
      applyDiscoveryFilters(all, filters({ context: "any" })).length,
    );
  });

  it("`visit` composes with the other predicates rather than replacing them", () => {
    const far = place({
      ...rewarding,
      id: "far",
      distance_km: 40,
    });
    const near = place({ ...rewarding, id: "near", distance_km: 2 });
    const kept = applyDiscoveryFilters(
      [far, near, noReward],
      filters({ context: "visit", maxKm: 5 }),
    );
    expect(kept.map((p) => p.id)).toEqual(["near"]);
  });

  it("`order` is parked — unselectable, and narrows nothing if forced", () => {
    expect(discoveryContextIsSoon("order")).toBe(true);
    expect(discoveryContextIsSoon("any")).toBe(false);
    expect(discoveryContextIsSoon("visit")).toBe(false);

    // A stale session carrying `order` must not hide the catalog behind a
    // filter the guest cannot see or clear.
    const f = filters({ context: "order" });
    expect(hasDiscoveryPredicates(f)).toBe(false);
    const all = [rewarding, noReward, webListing];
    expect(applyDiscoveryFilters(all, f)).toBe(all);
  });

  it("every context ships pill copy and an honest caption", () => {
    for (const key of DISCOVERY_CONTEXTS) {
      expect(DISCOVERY_CONTEXT_META[key].label).toBeTruthy();
      expect(DISCOVERY_CONTEXT_META[key].caption).toBeTruthy();
    }
  });
});
