// THE BUG THESE TESTS EXIST TO PREVENT (MESITA-1859, rewritten for the four
// pipeline boxes of MESITA-2327).
//
// Every box on Discovery seeds from the same config and saves only its own
// slices. A box that wrote a whole slice it does not own would mean the last
// Save wins and the rest is gone — silently, with a green "Saved" under it.
// It already happened once: three boxes all wrote the `map` slice, and the
// fix was to split it into mapSupers / mapFloors. `updateDiscoveryConfig`
// merges per slice for that reason, and these tests are the merge's only
// guard — nothing about a lost field fails a type check.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase-ef", () => ({ efInvoke: vi.fn() }));

import { efInvoke } from "@/lib/supabase-ef";
import { updateDiscoveryConfig, type DiscoverySlice } from "./actions";
import { coerceConfig, DEFAULT_CONFIG, type DiscoveryConfig } from "./catalog";
import { BOX_SLICES } from "./PipelineBoxes";

const mockInvoke = vi.mocked(efInvoke);

/** What the singleton holds before the save. */
function liveConfig(): DiscoveryConfig {
  return coerceConfig({
    ...DEFAULT_CONFIG,
    params: { ...DEFAULT_CONFIG.params, popularity: { root: 0.33 } },
    chat: { prompt: "live prompt" },
  });
}

/** The stored row as the EF hands it back, retired keys and all. */
function storedBlob(live: DiscoveryConfig): DiscoveryConfig {
  return {
    ...live,
    filters: { requireReady: true, minRating: 3.5, minReviews: 0, maxDistanceKm: 0 },
    swipe: { radiusKm: 5, minReviews: 1 },
    engines: { swipe: { ranked: true } },
    balance: { proximity: 1 },
    weightsByMode: { map: { proximity: 0.5 } },
  } as unknown as DiscoveryConfig;
}

/** Captures the blob the console tried to write. */
function armed(live: DiscoveryConfig) {
  const sent: { config?: DiscoveryConfig } = {};
  mockInvoke.mockImplementation(async (fn: string, body: unknown) => {
    if (fn === "admin-web-get-config") {
      return { ok: true, status: 200, data: { config: live, updatedAt: null } };
    }
    sent.config = (body as { config: DiscoveryConfig }).config;
    return { ok: true, status: 200, data: { config: sent.config, updatedAt: null } };
  });
  return sent;
}

/** A console copy with every box's fields edited at once. */
function editedEverywhere(live: DiscoveryConfig): DiscoveryConfig {
  return {
    ...live,
    params: {
      proximity: { halfKm: 8, exponent: 2 },
      popularity: { root: 0.5 },
    },
    map: {
      ...live.map,
      popularityRoot: 0.5,
      placesShown: 77,
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
  };
}

beforeEach(() => {
  mockInvoke.mockReset();
});

// The slices each box's Save really sends, read from the boxes themselves
// (MESITA-2338): a box that changes its slices changes what this proves.
const ALL_BOX_SLICES: DiscoverySlice[][] = Object.values(BOX_SLICES).map((s) => [...s]);

describe("no Save sends a retired key (MESITA-2328, MESITA-2337, MESITA-2923)", () => {
  it.each(ALL_BOX_SLICES)("saving %s sends none of them", async (...slices) => {
    const live = liveConfig();
    const sent = armed(storedBlob(live));
    await updateDiscoveryConfig(editedEverywhere(live), slices);
    expect(sent.config).toBeDefined();
    for (const dead of ["swipe", "engines", "weights", "weightsByMode", "filters", "catalog"]) {
      expect(sent.config).not.toHaveProperty(dead);
    }
    expect(sent.config?.params).not.toHaveProperty("balance");
  });
});

describe("the Map box (MESITA-2909)", () => {
  it("writes map but the Catalog page size; leaves params, Name, Deep and the prompt", async () => {
    const live = liveConfig();
    const sent = armed(live);
    await updateDiscoveryConfig(editedEverywhere(live), [...BOX_SLICES.map]);
    expect(sent.config?.map.popularityRoot).toBe(0.5);
    expect(sent.config?.map.placesShown).toBe(77);
    expect(sent.config?.map).not.toHaveProperty("radiusKm");
    expect(sent.config?.map).not.toHaveProperty("popularityFloor");
    expect(sent.config?.map.catalogPageSize).toBe(live.map.catalogPageSize);
    expect(sent.config?.params).toEqual(live.params);
    expect(sent.config?.name).toEqual(live.name);
    expect(sent.config?.general).toEqual(live.general);
    expect(sent.config?.deep).toEqual(live.deep);
    expect(sent.config?.chat).toEqual(live.chat);
  });
});

describe("the Catalog box (MESITA-2909)", () => {
  it("writes the half distance and the page size, and nothing else of map", async () => {
    const live = liveConfig();
    const sent = armed(live);
    await updateDiscoveryConfig(editedEverywhere(live), [...BOX_SLICES.catalog]);
    expect(sent.config?.params).toEqual({ proximity: { halfKm: 8, exponent: 2 }, popularity: { root: 0.5 } });
    expect(sent.config?.map).toEqual({ ...live.map, catalogPageSize: 33 });
    expect(sent.config?.name).toEqual(live.name);
    expect(sent.config?.chat).toEqual(live.chat);
  });
});

describe("the Deep box", () => {
  it("writes Deep and the Chat prompt; leaves the Area and Name fields", async () => {
    const live = liveConfig();
    const sent = armed(live);
    // No box saves Deep since MESITA-2345 (Soon); the slices stay safe.
    await updateDiscoveryConfig(editedEverywhere(live), ["deep", "chat"]);
    expect(sent.config?.deep).toEqual({ limit: 9, minSimilarity: 0.3 });
    expect(sent.config?.chat.prompt).toBe("Be brief.");
    expect(sent.config?.map).toEqual(live.map);
    expect(sent.config?.params).toEqual(live.params);
    expect(sent.config?.name).toEqual(live.name);
  });

  it("a Deep-only save leaves the prompt", async () => {
    const live = liveConfig();
    const sent = armed(live);
    await updateDiscoveryConfig(editedEverywhere(live), ["deep"]);
    expect(sent.config?.deep.limit).toBe(9);
    expect(sent.config?.chat).toEqual(live.chat);
  });
});

describe("the Name boxes", () => {
  it("nameLocations writes the switch and leaves the caps", async () => {
    const live = liveConfig();
    const sent = armed(live);
    await updateDiscoveryConfig(editedEverywhere(live), ["nameLocations"]);
    expect(sent.config?.name.locations).toBe(!live.name.locations);
    expect(sent.config?.name.deep).toEqual(live.name.deep);
    expect(sent.config?.name.idleSec).toBe(live.name.idleSec);
  });

  it("the Name box writes its three slices and not admin Find's caps or general", async () => {
    const live = liveConfig();
    const sent = armed(live);
    await updateDiscoveryConfig(editedEverywhere(live), [...BOX_SLICES.name]);
    expect(sent.config?.name.idleSec).toBe(2.5);
    expect(sent.config?.name.deep.autoCount).toBe(9);
    expect(sent.config?.general).toEqual(live.general);
    expect(sent.config?.name.admin).toEqual(live.name.admin);
    expect(sent.config?.map).toEqual(live.map);
  });

  it("Name by Admin writes its caps and nothing the guest's bar reads", async () => {
    const live = liveConfig();
    const sent = armed(live);
    await updateDiscoveryConfig(editedEverywhere(live), ["nameAdmin"]);
    expect(sent.config?.name.admin.textCount).toBe(3);
    expect(sent.config?.name.deep).toEqual(live.name.deep);
    expect(sent.config?.name.idleSec).toBe(live.name.idleSec);
    expect(sent.config?.general).toEqual(live.general);
  });
});

describe("the boxes' slices", () => {
  it("are the saving boxes, each with its own slices, none shared", () => {
    // Deep is Soon (MESITA-2345): three boxes save.
    expect(Object.keys(BOX_SLICES)).toEqual(["nameAdmin", "name", "map", "catalog"]);
    const all = Object.values(BOX_SLICES).flat();
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("Minimum Popularity lives on Name and only the Name box writes it (MESITA-3086)", () => {
  it.each(Object.entries(BOX_SLICES))("the %s box", async (box, slices) => {
    const live = liveConfig();
    const sent = armed(live);
    await updateDiscoveryConfig(editedEverywhere(live), [...slices]);
    const want = box === "name" ? 6 : live.name.popularityFloor;
    expect(sent.config?.name.popularityFloor).toBe(want);
    const root = (slices as readonly string[]).includes("mapPipeline") ? 0.5 : live.map.popularityRoot;
    expect(sent.config?.map.popularityRoot).toBe(root);
  });
});
