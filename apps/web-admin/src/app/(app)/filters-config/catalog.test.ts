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
  googleCallsPerLoad,
  SUPER_FIELDS,
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

  it("params keeps the two half points; the reach, Selected, the linear balance and the weights table are dropped (MESITA-2687, MESITA-2703, MESITA-2706)", () => {
    expect(coerceConfig(LIVE_BLOB).params).toEqual(DEFAULT_CONFIG.params);
    expect(
      coerceConfig({
        params: {
          // `halfDistanceKm` is the first cut's retired key, not `halfKm`.
          proximity: { maxKm: 30, halfDistanceKm: 6 },
          popularity: { priorRating: 4.2, referenceRating: 4, referenceReviews: 500, halfReviews: 250 },
          balance: { proximity: 8 },
          modes: { popular: { proximity: 0.5 } },
          timing: { closedFloor: 0.2 },
        },
      }).params,
    ).toEqual({
      proximity: { halfKm: 10 },
      popularity: { halfReviews: 250 },
    });
  });

  it("the Area params: the half-distance clamps to 0.5–50 at one decimal; reach and Selected are dropped (MESITA-2703, MESITA-2706)", () => {
    expect(
      coerceConfig({
        params: {
          proximity: { reachKm: 12.34, halfKm: 12.34 },
          popularity: { halfReviews: 0 },
          selected: { otherFactor: 0 },
        },
      }).params,
    ).toEqual({ proximity: { halfKm: 12.3 }, popularity: { halfReviews: 1 } });
    expect(coerceConfig({ params: { proximity: { halfKm: 0 } } }).params.proximity).toEqual({ halfKm: 0.5 });
    expect(coerceConfig({ params: { proximity: { halfKm: 999 } } }).params.proximity).toEqual({ halfKm: 50 });
  });

  it("the four Area sources are 0 or 20, and only the Google two bill (MESITA-2703)", () => {
    const m = coerceConfig({
      map: { googlePopular: 20, googleClosest: 0, mesitaPopular: 3, mesitaClosest: "x" },
    }).map;
    expect([m.googlePopular, m.googleClosest, m.mesitaPopular, m.mesitaClosest]).toEqual([20, 0, 0, 20]);
    expect(googleCallsPerLoad(m)).toBe(1);
    expect(googleCallsPerLoad(DEFAULT_MAP)).toBe(2);
    expect(coerceConfig({ map: { popularityWeight: 9 } }).map.popularityWeight).toBe(5);
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
          reloadMinKm: 1,
          reloadMinSec: 4,
          mapGooglePlaces: 45,
          googleFill: false,
          googleClosest: 7,
        },
      }).map,
    ).toEqual({
      ...DEFAULT_MAP,
      minRating: 5,
      minPopularity: 1,
      googleClosest: 0,
    });
    // The live throttle (MESITA-2444): 1.5 s by default, the client's 0.5–10.
    expect(coerceConfig({}).map.reloadIdleSec).toBe(1.5);
    expect(coerceConfig({ map: { reloadIdleSec: 0.1 } }).map.reloadIdleSec).toBe(0.5);
    expect(coerceConfig({ map: { reloadIdleSec: 99 } }).map.reloadIdleSec).toBe(10);
    expect(coerceConfig({ map: { reloadIdleSec: 2.25 } }).map.reloadIdleSec).toBe(2.25);
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

  it("the category param is twelve families", () => {
    expect(coerceConfig({ weights: {}, slotting: {} }).general).toEqual(DEFAULT_GENERAL);
    expect(SUPER_FIELDS.length).toBe(12);
    expect(new Set(SUPER_FIELDS.map((f) => f.key)).size).toBe(12);
    for (const f of SUPER_FIELDS) expect(f.battery.length, f.key).toBeGreaterThan(0);
    const on = SUPER_FIELDS.filter((f) => DEFAULT_NAME.deep.supers[f.key]).map((f) => f.key);
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
    expect("googlePull" in DEFAULT_MAP).toBe(false);
    expect("googlePull" in coerceConfig({ map: { googlePull: 60 } }).map).toBe(false);
    // The radius: default 15 = the reach (MESITA-2687), clamped 1..50
    // (Google's circle cap), one decimal.
    expect(DEFAULT_MAP.radiusKm).toBe(15);
    const radius = (raw: unknown) => coerceConfig({ map: { radiusKm: raw } }).map.radiusKm;
    expect(radius(0.2)).toBe(1);
    expect(radius(999)).toBe(50);
    expect(radius(12.34)).toBe(12.3);
    expect(radius(7)).toBe(7);
    expect(radius("far")).toBe(15);
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
