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
    params: { ...DEFAULT_CONFIG.params, popularity: { halfReviews: 100 } },
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
      proximity: { reachKm: 12.5 },
      popularity: { halfReviews: 250 },
      selected: { otherFactor: 0.5 },
    },
    map: { ...live.map, radiusKm: 3, googlePlaces: 20, mapGooglePlaces: 40, mesitaPlaces: 60 },
    catalog: { ...live.catalog, railCap: 7, seedCount: 99 },
    name: {
      ...live.name,
      locations: !live.name.locations,
      idleSec: 2.5,
      deep: { ...live.name.deep, autoCount: 9 },
      admin: { ...live.name.admin, textCount: 3 },
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

describe("no Save sends a retired key (MESITA-2328, MESITA-2337)", () => {
  it.each(ALL_BOX_SLICES)("saving %s sends none of them", async (...slices) => {
    const live = liveConfig();
    const sent = armed(storedBlob(live));
    await updateDiscoveryConfig(editedEverywhere(live), slices);
    expect(sent.config).toBeDefined();
    for (const dead of ["swipe", "engines", "weights", "weightsByMode", "filters"]) {
      expect(sent.config).not.toHaveProperty(dead);
    }
    expect(sent.config?.params).not.toHaveProperty("balance");
  });
});

describe("the Area box", () => {
  it("moves the reach, the half-credit count and Selected's other value (MESITA-2431, MESITA-2439)", async () => {
    const live = liveConfig();
    const sent = armed(live);
    await updateDiscoveryConfig(editedEverywhere(live), ["areaSignals"]);
    expect(sent.config?.params).toEqual({
      proximity: { reachKm: 12.5 },
      popularity: { halfReviews: 250 },
      selected: { otherFactor: 0.5 },
    });
  });

  it("writes map and the two params; leaves railCap, Name, Deep and the prompt (MESITA-2379)", async () => {
    const live = liveConfig();
    const sent = armed(live);
    await updateDiscoveryConfig(editedEverywhere(live), [...BOX_SLICES.area]);
    expect(sent.config?.map.radiusKm).toBe(3);
    expect(sent.config?.map.googlePlaces).toBe(20);
    expect(sent.config?.map.mapGooglePlaces).toBe(40);
    expect(sent.config?.map.mesitaPlaces).toBe(60);
    // Places per row left the page with the Feed rows; the legacy rails
    // keep the stored value until the legacy path is removed.
    expect(sent.config?.catalog.railCap).toBe(live.catalog.railCap);
    expect(sent.config?.catalog.seedCount).toBe(live.catalog.seedCount);
    expect(sent.config?.name).toEqual(live.name);
    expect(sent.config?.general).toEqual(live.general);
    expect(sent.config?.deep).toEqual(live.deep);
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
    expect(sent.config?.catalog).toEqual(live.catalog);
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
  it("are the four boxes, each with its own slices, none shared", () => {
    // Deep is Soon (MESITA-2345): three boxes save.
    expect(Object.keys(BOX_SLICES)).toEqual(["nameAdmin", "name", "area"]);
    const all = Object.values(BOX_SLICES).flat();
    expect(new Set(all).size).toBe(all.length);
  });
});
