// The map store hydrates its family list from the fifteen. The Feed has no
// filter store any more (MESITA-2298).
//
// `undefined` is the live case: it is a real key in PLACE_FAMILIES, so the old
// `PLACE_FAMILIES`-built allow-list let it survive hydrate, and the catalog
// holds zero unclassified places — the list just went empty. `wellness_spa` is
// the already-dead key the same path drops, and it is here so the test proves
// the filter runs at all rather than passing because nothing is ever dropped.
//
// The store reads sessionStorage ONCE at module load, so every case seeds
// storage, resets the module registry, imports fresh, then makes one mutation
// so the store writes its hydrated state back where we can read it.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

describe("persisted familyKeys hydrate from the filterable fifteen", () => {
  it("drops undefined and wellness_spa from a Map session", async () => {
    store.set(
      MAP_KEY,
      JSON.stringify({
        familyKeys: ["undefined", "wellness_spa", "coffee"],
        placesScope: "all",
        minReviews: 0,
      }),
    );

    const mod = await import("@/lib/use-map-filters");
    mod.toggleMapFamily("dinner");

    expect(persistedFamilyKeys(store, MAP_KEY)).toEqual([
      "coffee",
      "dinner",
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
    mod.toggleMapFamily("dinner");

    expect(persistedFamilyKeys(store, MAP_KEY)).toEqual(
      all.filter((k) => k !== "dinner"),
    );
  });

  it("drops a stored scope word: the guest never picks a source (MESITA-2384)", async () => {
    store.set(
      MAP_KEY,
      JSON.stringify({ familyKeys: [], placesScope: "enriched", minReviews: 10000 }),
    );

    const mod = await import("@/lib/use-map-filters");
    mod.toggleMapFamily("dinner");

    const raw = JSON.parse(store.get(MAP_KEY)!) as {
      placesScope?: string;
      minReviews: number;
    };
    expect(raw.placesScope).toBeUndefined();
    expect(raw.minReviews).toBe(1000);
  });
});
