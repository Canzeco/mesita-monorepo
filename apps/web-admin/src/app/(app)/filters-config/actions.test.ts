// THE BUG THESE TESTS EXIST TO PREVENT (MESITA-1859, rewritten for the four
// pipeline boxes of MESITA-2327 and the five cards of MESITA-4454).
//
// Every card on Discovery seeds from the same config and saves only its own
// slices. A card that wrote a slice it does not own would mean the last Save
// wins and the rest is gone — silently, with a green "Saved" under it. It
// already happened once: three boxes all wrote the `map` slice. Live config
// data loss, so pinned here: nothing about a lost field fails a type check.
//
// `server` below stands in for admin-web-update-config: it lays the sent
// blob over the stored one the way `mergeDiscoveryWrite` does (top-level keys
// replace, `params` and `map` merge one level down), refuses a stale
// `expectedUpdatedAt` with 409 `config_conflict`, and stamps every write.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase-ef", () => ({ efInvoke: vi.fn() }));

import { efInvoke } from "@/lib/supabase-ef";
import { updateDiscoveryConfig, type DiscoverySlice } from "./actions";
import { coerceConfig, DEFAULT_CONFIG, DEFAULT_RECIPES, type DiscoveryConfig } from "./catalog";
import { BOX_SLICES } from "./PipelineBoxes";

const mockInvoke = vi.mocked(efInvoke);
type Blob = Record<string, unknown>;
const rec = (v: unknown): Blob => (v && typeof v === "object" && !Array.isArray(v) ? (v as Blob) : {});

/** What the singleton holds before the save: the live keys, a retired key
 *  under each of params and map, and keys no build knows yet. */
function storedBlob(): Blob {
  const live = coerceConfig({ ...DEFAULT_CONFIG, chat: { prompt: "live prompt" } });
  return {
    ...live,
    params: { ...live.params, future: { knob: 1 } },
    map: { ...live.map, popularityRoot: 0.2, futureMap: true },
    filters: { requireReady: true, minRating: 3.5, minReviews: 0, maxDistanceKm: 0 },
    swipe: { radiusKm: 5, minReviews: 1 },
    engines: { swipe: { ranked: true } },
    weightsByMode: { map: { proximity: 0.5 } },
  };
}

/** A stand-in for the discovery section of the config EFs. */
function server(initial: Blob, opts: { olderBuild?: boolean } = {}) {
  const state = { stored: initial, updatedAt: "2026-11-19T10:00:00.000Z", n: 0, sent: [] as Blob[] };
  mockInvoke.mockImplementation(async (fn: string, body: unknown) => {
    if (fn === "admin-web-get-config") {
      return { ok: true, status: 200, data: { config: state.stored, updatedAt: state.updatedAt } };
    }
    const b = body as { config: Blob; expectedUpdatedAt?: string };
    state.sent.push(b.config);
    if (b.expectedUpdatedAt !== undefined && b.expectedUpdatedAt !== state.updatedAt) {
      return {
        ok: false,
        status: 409,
        code: "config_conflict",
        fn,
        error: "config changed, reload",
        data: { ok: false, code: "config_conflict", error: "config changed, reload" },
      };
    }
    const s = state.stored;
    const merged: Blob = {
      ...s,
      ...b.config,
      params: { ...rec(s.params), ...rec(b.config.params) },
      map: { ...rec(s.map), ...rec(b.config.map) },
    };
    if (opts.olderBuild) {
      // An older build rebuilt `params` key by key and dropped what it did not know.
      const { recipes: _r, mix: _m, ...rest } = rec(merged.params);
      merged.params = rest;
    }
    state.stored = merged;
    state.updatedAt = `2026-11-19T10:00:0${++state.n}.000Z`;
    return { ok: true, status: 200, data: { config: merged, updatedAt: state.updatedAt } };
  });
  return state;
}

/** A console copy with every card's fields edited at once. */
function editedEverywhere(live: DiscoveryConfig): DiscoveryConfig {
  return {
    ...live,
    params: {
      ...live.params,
      proximity: { halfKm: 8, exponent: 2 },
      popularity: { root: 0.5, starsPower: 4 },
      shuffle: { temperature: 1 },
      recipes: {
        ...live.params.recipes,
        catalogNearbyOrganic: { ...live.params.recipes.catalogNearbyOrganic, halfKm: 0.3 },
        mapInorganic: { ...live.params.recipes.mapInorganic, googleExp: 0.5 },
      },
      mix: { temperature: { nearby: 2, family: 2, popular: 2 }, adFloor: 0.5, adEvery: 3, growthWeightCap: 0.5 },
    },
    map: {
      ...live.map,
      popularityRoot: 0.5,
      placesShown: 77,
      dotsShown: 300,
      reloadIdleSec: 3,
      reloadMinViewportPct: 20,
      minRating: 4,
      catalogPageSize: 33,
    },
    name: {
      ...live.name,
      locations: !live.name.locations,
      idleSec: 2.5,
      deep: { ...live.name.deep, autoCount: 9 },
      admin: { ...live.name.admin, textCount: 3 },
      popularityFloor: 6,
    },
    general: { ...live.general, requireActive: !live.general.requireActive },
    deep: { limit: 9, minSimilarity: 0.3 },
    chat: { prompt: "Be brief." },
    premier: { yearlyCents: { boost_2x: 15000, boost_5x: 200000 } },
  };
}

const params = (b: Blob) => rec(b.params);
const map = (b: Blob) => rec(b.map);

beforeEach(() => {
  mockInvoke.mockReset();
});

// The slices each card's Save really sends, read from the cards themselves
// (MESITA-2338): a card that changes its slices changes what this proves.
const ALL_BOX_SLICES: DiscoverySlice[][] = Object.values(BOX_SLICES).map((s) => [...s]);

describe("no Save sends a retired top-level key (MESITA-2328, MESITA-2337, MESITA-2923)", () => {
  it.each(ALL_BOX_SLICES)("saving %s sends none of them", async (...slices) => {
    const srv = server(storedBlob());
    const live = coerceConfig(srv.stored);
    await updateDiscoveryConfig(editedEverywhere(live), slices);
    const sent = srv.sent[0];
    expect(sent).toBeDefined();
    for (const dead of ["swipe", "engines", "weights", "weightsByMode", "filters", "catalog"]) {
      expect(sent).not.toHaveProperty(dead);
    }
  });
});

describe("each card writes its own slice and nothing else (MESITA-4454)", () => {
  it("Ranking writes params.recipes whole", async () => {
    const srv = server(storedBlob());
    const before = coerceConfig(srv.stored);
    const edited = editedEverywhere(before);
    const r = await updateDiscoveryConfig(edited, [...BOX_SLICES.ranking]);
    expect(r.ok).toBe(true);
    const after = coerceConfig(srv.stored);
    expect(after.params.recipes).toEqual(edited.params.recipes);
    expect({ ...after, params: { ...after.params, recipes: before.params.recipes } }).toEqual(before);
  });

  it("Mixing writes params.mix only; the page size is no longer its key (MESITA-4517)", async () => {
    const srv = server(storedBlob());
    const before = coerceConfig(srv.stored);
    const edited = editedEverywhere(before);
    await updateDiscoveryConfig(edited, [...BOX_SLICES.mixing]);
    const after = coerceConfig(srv.stored);
    expect(after.params.mix).toEqual(edited.params.mix);
    expect({ ...after, params: { ...after.params, mix: before.params.mix } }).toEqual(before);
  });

  it("Map display writes the pins and the reload timing, never the page size, the floors or the root", async () => {
    const srv = server(storedBlob());
    const before = coerceConfig(srv.stored);
    await updateDiscoveryConfig(editedEverywhere(before), [...BOX_SLICES.mapDisplay]);
    const after = coerceConfig(srv.stored);
    expect(after.map).toEqual({
      ...before.map,
      placesShown: 77,
      dotsShown: 300,
      reloadIdleSec: 3,
      reloadMinViewportPct: 20,
    });
    expect({ ...after, map: before.map }).toEqual(before);
  });

  it.each([
    ["Mixing then Map display", [BOX_SLICES.mixing, BOX_SLICES.mapDisplay]],
    ["Map display then Mixing", [BOX_SLICES.mapDisplay, BOX_SLICES.mixing]],
  ])("%s keeps both cards' edits", async (_label, order) => {
    const srv = server(storedBlob());
    const seed = coerceConfig(srv.stored);
    // Both cards seeded from the same load; each saves its own edit.
    const edited = editedEverywhere(seed);
    let stamp: string | null = srv.updatedAt;
    for (const slices of order) {
      const r = await updateDiscoveryConfig(edited, [...slices], stamp);
      expect(r.ok).toBe(true);
      if (r.ok) stamp = r.updatedAt;
    }
    const after = coerceConfig(srv.stored);
    expect(after.params.mix).toEqual(edited.params.mix);
    expect(after.map.placesShown).toBe(77);
    expect(after.map.reloadIdleSec).toBe(3);
    expect(after.params.recipes).toEqual(seed.params.recipes);
  });
});

describe("unknown and retired keys survive every Save (H-2)", () => {
  // Ranking and Mixing send recipes and mix themselves; every other card
  // must keep them from an old-shape console copy.
  const others = ALL_BOX_SLICES.filter((s) => !s.includes("ranking") && !s.includes("mixing"));
  it.each(others)("saving %s from an old-shape copy keeps params.recipes, params.mix and the unknown keys", async (...slices) => {
    const srv = server(storedBlob());
    // An old-shape console copy: built before recipes and mix existed.
    const { recipes: _r, mix: _m, ...oldParams } = coerceConfig(srv.stored).params;
    const old = { ...editedEverywhere(coerceConfig(srv.stored)), params: oldParams } as unknown as DiscoveryConfig;
    const r = await updateDiscoveryConfig(old, slices);
    expect(r.ok).toBe(true);
    expect(params(srv.stored).recipes).toEqual(DEFAULT_RECIPES);
    expect(params(srv.stored).mix).toEqual(DEFAULT_CONFIG.params.mix);
    expect(params(srv.stored).future).toEqual({ knob: 1 });
    expect(map(srv.stored).futureMap).toBe(true);
    // Retired keys wait for their migration (F8).
    expect(map(srv.stored).popularityRoot).toBe(0.2);
  });

  it("the sent blob carries the unknown keys too, so an older server keeps them", async () => {
    const srv = server(storedBlob());
    await updateDiscoveryConfig(editedEverywhere(coerceConfig(srv.stored)), [...BOX_SLICES.mapDisplay]);
    expect(params(srv.sent[0]).future).toEqual({ knob: 1 });
    expect(map(srv.sent[0]).futureMap).toBe(true);
    expect(params(srv.sent[0]).recipes).toEqual(DEFAULT_RECIPES);
  });
});

describe("a stale page and an older server are refused aloud (H-2, H-3)", () => {
  it("sends the page's stamp and surfaces a 409 as Config changed, reload", async () => {
    const srv = server(storedBlob());
    const seen = srv.updatedAt;
    const edited = editedEverywhere(coerceConfig(srv.stored));
    // Another tab saves first.
    await updateDiscoveryConfig(edited, [...BOX_SLICES.searchbars], seen);
    const r = await updateDiscoveryConfig(edited, [...BOX_SLICES.ranking], seen);
    expect(srv.sent.at(-1)).toBeDefined();
    expect(mockInvoke.mock.calls.at(-1)?.[1]).toMatchObject({ section: "discovery", expectedUpdatedAt: seen });
    expect(r).toEqual({ ok: false, error: "Config changed, reload" });
    expect(coerceConfig(srv.stored).params.recipes).toEqual(DEFAULT_RECIPES);
  });

  it("an answer without the written slice reads Saved by an older server, retry", async () => {
    server(storedBlob(), { olderBuild: true });
    const live = coerceConfig(storedBlob());
    for (const slices of [BOX_SLICES.ranking, BOX_SLICES.mixing]) {
      const r = await updateDiscoveryConfig(editedEverywhere(live), [...slices]);
      expect(r).toEqual({ ok: false, error: "Saved by an older server, retry" });
    }
    const r = await updateDiscoveryConfig(editedEverywhere(live), [...BOX_SLICES.mapDisplay]);
    expect(r.ok).toBe(true);
  });
});

describe("the Name boxes", () => {
  it("nameLocations writes the switch and leaves the caps", async () => {
    const srv = server(storedBlob());
    const live = coerceConfig(srv.stored);
    await updateDiscoveryConfig(editedEverywhere(live), ["nameLocations"]);
    const after = coerceConfig(srv.stored);
    expect(after.name.locations).toBe(!live.name.locations);
    expect(after.name.deep).toEqual(live.name.deep);
    expect(after.name.idleSec).toBe(live.name.idleSec);
  });

  it("the Searchbars card writes both bars and not general, map or params (MESITA-4463)", async () => {
    const srv = server(storedBlob());
    const live = coerceConfig(srv.stored);
    await updateDiscoveryConfig(editedEverywhere(live), [...BOX_SLICES.searchbars]);
    const after = coerceConfig(srv.stored);
    expect(after.name.idleSec).toBe(2.5);
    expect(after.name.deep.autoCount).toBe(9);
    expect(after.name.admin.textCount).toBe(3);
    expect(after.general).toEqual(live.general);
    expect(after.map).toEqual(live.map);
    expect(after.params).toEqual(live.params);
  });

  it("Name by Admin writes its caps and nothing the guest's bar reads", async () => {
    const srv = server(storedBlob());
    const live = coerceConfig(srv.stored);
    await updateDiscoveryConfig(editedEverywhere(live), ["nameAdmin"]);
    const after = coerceConfig(srv.stored);
    expect(after.name.admin.textCount).toBe(3);
    expect(after.name.deep).toEqual(live.name.deep);
    expect(after.name.idleSec).toBe(live.name.idleSec);
    expect(after.general).toEqual(live.general);
  });

  it("Deep and the Chat prompt write only themselves", async () => {
    const srv = server(storedBlob());
    const live = coerceConfig(srv.stored);
    await updateDiscoveryConfig(editedEverywhere(live), ["deep"]);
    expect(coerceConfig(srv.stored).deep.limit).toBe(9);
    expect(coerceConfig(srv.stored).chat).toEqual(live.chat);
  });
});

describe("the cards' slices", () => {
  it("are the saving cards, each with its own slices, none shared; catalogPipeline is gone", () => {
    expect(Object.keys(BOX_SLICES)).toEqual(["searchbars", "ranking", "mixing", "mapDisplay", "social", "premier"]);
    const all: string[] = Object.values(BOX_SLICES).flat();
    expect(new Set(all).size).toBe(all.length);
    expect(all).not.toContain("catalogPipeline");
    expect(all).not.toContain("mapPipeline");
  });
});

describe("Minimum Popularity lives on Name and only the Searchbars card writes it (MESITA-3086)", () => {
  it.each(Object.entries(BOX_SLICES))("the %s card", async (box, slices) => {
    const srv = server(storedBlob());
    const live = coerceConfig(srv.stored);
    await updateDiscoveryConfig(editedEverywhere(live), [...slices]);
    const want = box === "searchbars" ? 6 : live.name.popularityFloor;
    expect(coerceConfig(srv.stored).name.popularityFloor).toBe(want);
    // No card writes the Map's retired root any more.
    expect(map(srv.stored).popularityRoot).toBe(0.2);
  });
});

// Money (MESITA-3043): a stale copy of the prices on any other card must never
// overwrite what the operator set on Premier Prices.
describe("Premier's prices: only the Premier Prices slice writes them", () => {
  it.each(Object.entries(BOX_SLICES))("the %s card", async (box, slices) => {
    const srv = server(storedBlob());
    const live = coerceConfig(srv.stored);
    await updateDiscoveryConfig(editedEverywhere(live), [...slices]);
    const want = box === "premier" ? { boost_2x: 15000, boost_5x: 200000 } : live.premier.yearlyCents;
    expect(coerceConfig(srv.stored).premier.yearlyCents).toEqual(want);
  });

  it("the Premier Prices slice writes nothing else", async () => {
    const srv = server(storedBlob());
    const live = coerceConfig(srv.stored);
    await updateDiscoveryConfig(editedEverywhere(live), [...BOX_SLICES.premier]);
    const after = coerceConfig(srv.stored);
    expect({ ...after, premier: live.premier }).toEqual(live);
  });
});
