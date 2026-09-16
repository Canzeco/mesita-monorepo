// THE BUG THIS PR EXISTS TO PREVENT (MESITA-1859).
//
// The weights table has ONE SAVE PER COLUMN, and `weights`, `params` and
// `slotting` all ride the single `signals` slice. A per-column save that wrote
// a whole slice would therefore mean the last Save wins and the rest is gone —
// silently, with a green "Saved" under it.
//
// This is not hypothetical. It already happened one floor down: three boxes on
// Search Sources all wrote the `map` slice, and the fix was to split it into
// mapSupers / mapFloors / mapPull. `updateDiscoveryConfig` merges per-mode for
// the same reason, and these tests are the merge's only guard — nothing about
// a lost column fails a type check.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase-ef", () => ({ efInvoke: vi.fn() }));

import { efInvoke } from "@/lib/supabase-ef";
import { updateDiscoveryConfig } from "./actions";
import { coerceConfig, DEFAULT_CONFIG, type DiscoveryConfig } from "./catalog";

const mockInvoke = vi.mocked(efInvoke);

/** What the singleton holds before the save. */
function liveConfig(): DiscoveryConfig {
  return coerceConfig({
    ...DEFAULT_CONFIG,
    weights: { ...DEFAULT_CONFIG.weights, proximity: 1.4 },
    weightsByMode: {
      map: { ...DEFAULT_CONFIG.weightsByMode.map, proximity: 0.4 },
      swipe: { ...DEFAULT_CONFIG.weightsByMode.swipe, proximity: 3 },
    },
    params: { ...DEFAULT_CONFIG.params, proximity: { maxKm: 11, kneeKm: 2, missingGeo: 0.5 } },
    slotting: { enabled: false, everyNth: 9 },
  });
}

/** Captures the blob the console tried to write. */
function armed(live: DiscoveryConfig) {
  const sent: { config?: DiscoveryConfig } = {};
  mockInvoke.mockImplementation((async (fn: string, body: unknown) => {
    if (fn === "admin-web-get-config") {
      return { ok: true, data: { config: live, updatedAt: null } };
    }
    sent.config = (body as { config: DiscoveryConfig }).config;
    return { ok: true, data: { config: sent.config, updatedAt: null } };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- narrow mock
  }) as any);
  return sent;
}

beforeEach(() => {
  mockInvoke.mockReset();
});

describe("per-column weight saves cannot reach each other", () => {
  it("saving Map leaves Scroll, the global vector, the params and slotting untouched", async () => {
    const live = liveConfig();
    const sent = armed(live);
    // The console's in-memory config has BOTH columns edited — only the one
    // whose Save was pressed may land.
    const edited: DiscoveryConfig = {
      ...live,
      weights: { ...live.weights, proximity: 0 },
      weightsByMode: {
        map: { ...live.weightsByMode.map, proximity: 2 },
        swipe: { ...live.weightsByMode.swipe, proximity: 0.1 },
      },
      params: { ...live.params, proximity: { maxKm: 1, kneeKm: 1, missingGeo: 0 } },
      slotting: { enabled: true, everyNth: 2 },
    };

    await updateDiscoveryConfig(edited, ["weightsMap"]);

    expect(sent.config?.weightsByMode.map.proximity).toBe(2);
    expect(sent.config?.weightsByMode.swipe).toEqual(live.weightsByMode.swipe);
    expect(sent.config?.weights).toEqual(live.weights);
    expect(sent.config?.params).toEqual(live.params);
    expect(sent.config?.slotting).toEqual(live.slotting);
  });

  it("and the reverse — saving Scroll leaves Map exactly as it was", async () => {
    const live = liveConfig();
    const sent = armed(live);
    const edited: DiscoveryConfig = {
      ...live,
      weightsByMode: {
        map: { ...live.weightsByMode.map, proximity: 2 },
        swipe: { ...live.weightsByMode.swipe, proximity: 0.1 },
      },
    };

    await updateDiscoveryConfig(edited, ["weightsScroll"]);

    expect(sent.config?.weightsByMode.swipe.proximity).toBe(0.1);
    expect(sent.config?.weightsByMode.map).toEqual(live.weightsByMode.map);
    expect(sent.config?.weightsByMode.map.proximity).toBe(0.4);
  });

  it("a Signals save cannot move either column", async () => {
    // The params card still writes the `signals` slice, and it holds a whole
    // config object — so the columns have to survive its Save too.
    const live = liveConfig();
    const sent = armed(live);
    const edited: DiscoveryConfig = {
      ...live,
      weightsByMode: {
        map: { ...live.weightsByMode.map, proximity: 2 },
        swipe: { ...live.weightsByMode.swipe, proximity: 0.1 },
      },
      params: { ...live.params, proximity: { maxKm: 3, kneeKm: 1, missingGeo: 0.1 } },
    };

    await updateDiscoveryConfig(edited, ["signals"]);

    expect(sent.config?.params.proximity.maxKm).toBe(3);
    expect(sent.config?.weightsByMode).toEqual(live.weightsByMode);
  });

  it("an unrelated slice — the Chat prompt — moves nothing", async () => {
    const live = liveConfig();
    const sent = armed(live);
    const edited: DiscoveryConfig = {
      ...live,
      chat: { prompt: "after" },
      weightsByMode: {
        map: { ...live.weightsByMode.map, proximity: 2 },
        swipe: { ...live.weightsByMode.swipe, proximity: 0.1 },
      },
    };

    await updateDiscoveryConfig(edited, ["chat"]);

    expect(sent.config?.chat.prompt).toBe("after");
    expect(sent.config?.weightsByMode).toEqual(live.weightsByMode);
    expect(sent.config?.weights).toEqual(live.weights);
  });

  it("a whole-config save (no slices named) still carries both columns", async () => {
    const live = liveConfig();
    const sent = armed(live);
    const edited: DiscoveryConfig = {
      ...live,
      weightsByMode: {
        map: { ...live.weightsByMode.map, proximity: 2 },
        swipe: { ...live.weightsByMode.swipe, proximity: 0.1 },
      },
    };

    await updateDiscoveryConfig(edited);

    expect(sent.config?.weightsByMode.map.proximity).toBe(2);
    expect(sent.config?.weightsByMode.swipe.proximity).toBe(0.1);
  });
});
