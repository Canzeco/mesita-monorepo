// A persisted family key the Filters sheet no longer renders is a filter the
// guest cannot see or clear: the red active-filters dot stays lit, the result
// set stays narrowed, and no pill exists to switch it off — only whole-sheet
// Reset. Both sheets render FILTERABLE_PLACE_FAMILIES (the seven), so both
// stores must hydrate from the seven too.
//
// `undefined` is the live case: it is a real key in PLACE_FAMILIES, so the old
// `PLACE_FAMILIES`-built allow-list let it survive hydrate, and the catalog
// holds zero unclassified places — the deck just went empty. `wellness_spa` is
// the already-dead key the same path drops, and it is here so the test proves
// the filter runs at all rather than passing because nothing is ever dropped.
//
// Each store reads sessionStorage ONCE at module load, so every case seeds
// storage, resets the module registry, imports fresh, then makes one mutation
// so the store writes its hydrated state back where we can read it.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const DISCOVERY_KEY = "mesita_discovery_filters_v6";
const MAP_KEY = "mesita_map_filters_v6";

function installSessionStorage(): Map<string, string> {
  const store = new Map<string, string>();
  const sessionStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
  (globalThis as { window?: unknown }).window = { sessionStorage };
  return store;
}

function persistedFamilyKeys(store: Map<string, string>, key: string) {
  const raw = store.get(key);
  if (!raw) throw new Error(`${key} was never written back`);
  return (JSON.parse(raw) as { familyKeys: string[] }).familyKeys;
}

let store: Map<string, string>;

beforeEach(() => {
  vi.resetModules();
  store = installSessionStorage();
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("persisted familyKeys hydrate from the filterable seven", () => {
  it("drops undefined and wellness_spa from a Discovery session", async () => {
    store.set(
      DISCOVERY_KEY,
      JSON.stringify({
        familyKeys: ["undefined", "wellness_spa", "cafes_bakeries"],
        placesScope: "all",
        minReviews: 0,
      }),
    );

    const mod = await import("@/lib/use-discovery-filters");
    mod.toggleDiscoveryFamily("restaurants");

    expect(persistedFamilyKeys(store, DISCOVERY_KEY)).toEqual([
      "cafes_bakeries",
      "restaurants",
    ]);
  });

  it("keeps every key the Discovery sheet still renders", async () => {
    const { FILTERABLE_PLACE_FAMILIES } = await import("@/lib/place-families");
    const all = FILTERABLE_PLACE_FAMILIES.map((f) => f.key);
    store.set(
      DISCOVERY_KEY,
      JSON.stringify({ familyKeys: all, placesScope: "all", minReviews: 0 }),
    );

    const mod = await import("@/lib/use-discovery-filters");
    mod.toggleDiscoveryFamily("restaurants"); // was selected → drops out

    expect(persistedFamilyKeys(store, DISCOVERY_KEY)).toEqual(
      all.filter((k) => k !== "restaurants"),
    );
  });

  it("drops undefined and wellness_spa from a Map session", async () => {
    store.set(
      MAP_KEY,
      JSON.stringify({
        familyKeys: ["undefined", "wellness_spa", "cafes_bakeries"],
        placesScope: "all",
        minReviews: 0,
      }),
    );

    const mod = await import("@/lib/use-map-filters");
    mod.toggleMapFamily("restaurants");

    expect(persistedFamilyKeys(store, MAP_KEY)).toEqual([
      "cafes_bakeries",
      "restaurants",
    ]);
  });

  it("keeps every key the Map sheet still renders", async () => {
    const { FILTERABLE_PLACE_FAMILIES } = await import("@/lib/place-families");
    const all = FILTERABLE_PLACE_FAMILIES.map((f) => f.key);
    store.set(
      MAP_KEY,
      JSON.stringify({ familyKeys: all, placesScope: "all", minReviews: 0 }),
    );

    const mod = await import("@/lib/use-map-filters");
    mod.toggleMapFamily("restaurants");

    expect(persistedFamilyKeys(store, MAP_KEY)).toEqual(
      all.filter((k) => k !== "restaurants"),
    );
  });
});
