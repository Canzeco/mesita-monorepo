import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  coerceConfig,
  DEFAULT_CATALOG,
  DEFAULT_CONFIG,
  DEFAULT_GENERAL,
  DEFAULT_MAP,
  DEFAULT_NAME,
  GOOGLE_PULL_STOPS,
  SUPER_FIELDS,
  snapMapReloadPair,
} from "./catalog";

// `app_config.discovery_config` as stored on 2026-10-18 (trimmed): the
// retired deck's keys beside the live ones. The EF twin pins the same blob.
const LIVE_BLOB = {
  swipe: { savedAt: null, radiusKm: 5, minReviews: 1, closingBufferMin: 30 },
  engines: { swipe: { ranked: true } },
  weights: { name: 1, timing: 1, proximity: 1, randomness: 0.35, mesita_level: 1 },
  params: {
    name: {},
    timing: { dawn: 0.55, openShare: 0.7, closedFloor: 0.2 },
    category: { miss: 0.1, exact: 1, family: 0.55 },
    proximity: { maxKm: 25, kneeKm: 1, missingGeo: 0.35 },
    popularity: { confidence: 60, floorRating: 3, priorRating: 4.2 },
    randomness: {},
  },
  filters: { minRating: 0, minReviews: 0, requireReady: true, maxDistanceKm: 0 },
  general: { minReviews: 0, requireActive: true },
  chat: { prompt: "Be Memo." },
};

describe("the Swipe deck's keys are gone (MESITA-2328)", () => {
  it("coerceConfig drops swipe, engines, weights and weightsByMode", () => {
    const cfg = coerceConfig({ ...LIVE_BLOB, weightsByMode: { swipe: { timing: 1.5 } } });
    for (const dead of ["swipe", "engines", "weights", "weightsByMode"]) {
      expect(cfg).not.toHaveProperty(dead);
    }
    expect(Object.keys(cfg).sort()).toEqual(Object.keys(DEFAULT_CONFIG).sort());
  });

  it("params keeps only the reach, half credit, Selected's other value and the weights table; the linear balance is dropped (MESITA-2428, MESITA-2431, MESITA-2439)", () => {
    expect(coerceConfig(LIVE_BLOB).params).toEqual(DEFAULT_CONFIG.params);
    expect(
      coerceConfig({
        params: {
          proximity: { maxKm: 30, halfDistanceKm: 6 },
          popularity: { priorRating: 4.2, referenceRating: 4, referenceReviews: 500, halfReviews: 250 },
          balance: { proximity: 8 },
          modes: { popular: { proximity: 0.5 } },
          timing: { closedFloor: 0.2 },
        },
      }).params,
    ).toEqual({
      proximity: { reachKm: 15 },
      popularity: { halfReviews: 250 },
      selected: { otherFactor: 0.3 },
      modes: { ...DEFAULT_CONFIG.params.modes, popular: { proximity: 0.5, popularity: 3, selected: 1 } },
    });
  });

  it("the Area params clamp to their bounds, at their own decimals", () => {
    expect(
      coerceConfig({
        params: {
          proximity: { reachKm: 12.34 },
          popularity: { halfReviews: 0 },
          selected: { otherFactor: 0 },
          modes: { nearby: { proximity: 99, popularity: 1.234 }, family: { proximity: -2, selected: 2.5 } },
        },
      }).params,
    ).toEqual({
      proximity: { reachKm: 12.3 },
      popularity: { halfReviews: 1 },
      selected: { otherFactor: 0.01 },
      modes: {
        ...DEFAULT_CONFIG.params.modes,
        nearby: { proximity: 5, popularity: 1.23, selected: 1 },
        family: { proximity: 0, popularity: 1, selected: 2.5 },
      },
    });
    const other = (v: unknown) => coerceConfig({ params: { selected: { otherFactor: v } } }).params.selected.otherFactor;
    expect(other(0.456)).toBe(0.46);
    expect(other(7)).toBe(1);
    expect(other("lots")).toBe(0.3);
    const reach = (v: unknown) => coerceConfig({ params: { proximity: { reachKm: v } } }).params.proximity.reachKm;
    expect(reach(0.2)).toBe(1);
    expect(reach(999)).toBe(50);
    expect(reach("far")).toBe(15);
  });

  it("filters go too: list-places' listed lanes were their last reader (MESITA-2337)", () => {
    expect(coerceConfig(LIVE_BLOB)).not.toHaveProperty("filters");
    expect(coerceConfig({ filters: { minRating: 4.26, minReviews: -5 } })).not.toHaveProperty(
      "filters",
    );
  });

  it("the Mode × Entity × Pool × Source twin is deleted, not parked", () => {
    for (const gone of ["discovery-matrix.ts", "source-floor-copy.ts"]) {
      expect(existsSync(join(__dirname, gone))).toBe(false);
    }
  });
});

describe("coerceConfig", () => {
  it("coerceConfig defaults catalog on an old blob", () => {
    expect(coerceConfig({ weights: {}, slotting: {} }).catalog).toEqual(DEFAULT_CATALOG);
    expect(coerceConfig({ catalog: { seedCount: 99 } }).catalog.seedCount).toBe(20);
  });

  it("coerceConfig defaults map on an old blob and clamps knobs", () => {
    expect(coerceConfig({ weights: {}, slotting: {} }).map).toEqual(DEFAULT_MAP);
    expect(
      coerceConfig({
        map: {
          minRating: 9,
          minPopularity: 4,
          supers: { restaurants: false },
        },
      }).map,
    ).toEqual({
      ...DEFAULT_MAP,
      minRating: 5,
      minPopularity: 1,
      supers: { ...DEFAULT_MAP.supers },
    });
    expect(
      coerceConfig({ map: { reloadMinKm: 99, reloadMinSec: 40 } }).map,
    ).toMatchObject({ reloadMinKm: 4, reloadMinSec: 15 });
    expect(
      coerceConfig({ map: { reloadMinKm: 0.4, reloadMinSec: 2 } }).map,
    ).toMatchObject({ reloadMinKm: 0.5, reloadMinSec: 2 });
    expect(snapMapReloadPair(0.4, 2)).toEqual({ km: 0.5, sec: 2 });
    expect(snapMapReloadPair(99, 40)).toEqual({ km: 4, sec: 15 });
  });

  it("coerceConfig drops the retired social box (MESITA-2144)", () => {
    // The tentative Social engine's knobs had no reader. A blob that still
    // carries them comes back without them, so a whole-blob Save stops
    // writing them.
    const cfg = coerceConfig({
      social: { seedCount: 6, generatedCount: 6, eventsPerRail: 8, minSeedEvents: 1, horizonDays: 14 },
    });
    expect(cfg).not.toHaveProperty("social");
  });

  it("the category param is thirteen families", () => {
    expect(coerceConfig({ weights: {}, slotting: {} }).general).toEqual(DEFAULT_GENERAL);
    expect(SUPER_FIELDS.length).toBe(13);
    expect(new Set(SUPER_FIELDS.map((f) => f.key)).size).toBe(13);
    for (const f of SUPER_FIELDS) expect(f.battery.length, f.key).toBeGreaterThan(0);
    const on = SUPER_FIELDS.filter((f) => DEFAULT_MAP.supers[f.key]).map((f) => f.key);
    expect(new Set(on)).toEqual(
      new Set(["coffee", "dinner", "sweet", "drinks", "night_out"]),
    );
    expect(
      new Set(SUPER_FIELDS.filter((f) => on.includes(f.key)).map((f) => f.battery[0])),
    ).toEqual(new Set(["restaurant", "bar", "night_club", "cafe", "bakery"]));
  });

  it("map.googlePull is retired and map.radiusKm is the one Nearby radius (MESITA-2298)", () => {
    // One Nearby Search (New) call per request, 20 places, never widened: the
    // Legacy 40/60 pull is gone and an old blob's key is dropped on coerce.
    expect(GOOGLE_PULL_STOPS).toEqual([20, 40, 60]);
    expect("googlePull" in DEFAULT_MAP).toBe(false);
    expect("googlePull" in coerceConfig({ map: { googlePull: 60 } }).map).toBe(false);
    // The radius: default 50, clamped 1..50 (Google's circle cap), one decimal.
    expect(DEFAULT_MAP.radiusKm).toBe(50);
    const radius = (raw: unknown) => coerceConfig({ map: { radiusKm: raw } }).map.radiusKm;
    expect(radius(0.2)).toBe(1);
    expect(radius(999)).toBe(50);
    expect(radius(12.34)).toBe(12.3);
    expect(radius(7)).toBe(7);
    expect(radius("far")).toBe(50);
  });

  it("coerceConfig defaults name Fast 5 and Deep 3+3+3", () => {
    expect(coerceConfig({ weights: {}, slotting: {} }).name).toEqual(DEFAULT_NAME);
    expect(coerceConfig({ name: { fast: { count: 99 }, deep: { mesitaCount: -1 } } }).name)
      .toMatchObject({
        fast: { googleCount: 20, count: 20 },
        deep: {
          mesitaCount: 0,
          autoCount: 3,
          googleCount: 3,
        },
      });
    expect(
      coerceConfig({
        name: {
          deep: {
            autoCount: 5,
            googleCount: 1,
            mesitaCount: 10,
            partnerCount: 8,
          },
        },
      }).name.deep,
    ).toEqual({
      autoCount: 5,
      googleCount: 1,
      mesitaCount: 10,
      supers: DEFAULT_NAME.deep.supers,
    });
  });
});

describe("Discovery page box order", () => {
  it("is ONE page of four pipeline boxes, no subpages (MESITA-2327)", () => {
    const page = readFileSync(join(__dirname, "page.tsx"), "utf8");
    const nav = readFileSync(join(__dirname, "nav.ts"), "utf8");
    const nextConfig = readFileSync(
      join(__dirname, "../../../../next.config.ts"),
      "utf8",
    );
    const order = ["<NameAdminBox", "<NameBox", "<AreaBox", "<DeepBox"].map((tag) =>
      page.indexOf(tag),
    );
    expect(order.every((at) => at > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(page).not.toContain("redirect(");
    for (const gone of ["layout.tsx", "modes", "signals", "discovery-route.tsx"]) {
      expect(existsSync(join(__dirname, gone))).toBe(false);
    }
    expect(nav).not.toContain("DISCOVERY_TABS");
    expect(nav).toContain('"/filters-config#s-name"');
    // Every retired subpage keeps an operator's bookmark alive, one hop.
    for (const old of ["modes", "signals", "sources", "matrix", "modules", "catalog", "chat"]) {
      expect(nextConfig).toContain(`"/filters-config/${old}"`);
    }
    expect(nextConfig).toContain('destination: "/filters-config"');
    expect(nextConfig).not.toMatch(/destination: "\/filters-config\/[a-z]/);
  });
});
