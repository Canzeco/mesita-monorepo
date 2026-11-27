import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  coerceConfig,
  coerceMix,
  coerceRecipes,
  DEFAULT_CONFIG,
  DEFAULT_GENERAL,
  DEFAULT_MAP,
  DEFAULT_MIX,
  DEFAULT_NAME,
  DEFAULT_RECIPES,
  EXPONENT_MAX,
  EXPONENT_MIN,
  HALF_KM_MAX,
  HALF_KM_MIN,
  MIX_BOUNDS,
  RECIPE_BOUNDS,
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

  it("params keeps every typed key at its value, and an unknown key rides along untouched until a migration deletes it (H-2, MESITA-4454)", () => {
    const typed = (cfg: ReturnType<typeof coerceConfig>) => {
      const { proximity, popularity, shuffle, recipes, mix } = cfg.params;
      return { proximity, popularity, shuffle, recipes, mix };
    };
    expect(typed(coerceConfig(LIVE_BLOB))).toEqual(DEFAULT_CONFIG.params);
    const params = coerceConfig({
      params: {
        proximity: { maxKm: 30, halfDistanceKm: 6, radiusDivisor: 3 },
        popularity: { priorRating: 4.2, referenceRating: 4, referenceReviews: 500, halfReviews: 250 },
        balance: { proximity: 8 },
        modes: { popular: { proximity: 0.5 } },
      },
    }).params as unknown as Record<string, unknown>;
    // Typed keys are rebuilt field by field: their stale sub-keys go.
    expect(params.proximity).toEqual({ halfKm: 1, exponent: 1 });
    expect(params.popularity).toEqual({ root: 0.33, starsPower: 6 });
    // Unknown keys under params are kept as stored (the server keeps them too).
    expect(params.balance).toEqual({ proximity: 8 });
    expect(params.modes).toEqual({ popular: { proximity: 0.5 } });
  });

  it("the half distance clamps to 0.1–100 km at one decimal, the exponent to 0.5–5, the root to 0.1–1 at two (MESITA-2909, MESITA-3083)", () => {
    const params = coerceConfig({
      params: {
        proximity: { reachKm: 12.34, halfKm: 2.34, exponent: 1.26 },
        popularity: { halfReviews: 0, root: 0.3333 },
      },
    }).params;
    expect(params.proximity).toEqual({ halfKm: 2.3, exponent: 1.3 });
    expect(params.popularity).toEqual({ root: 0.33, starsPower: 6 });
    expect(coerceConfig({ params: { proximity: { halfKm: 0 } } }).params.proximity).toEqual({ halfKm: 0.1, exponent: 1 });
    expect(coerceConfig({ params: { proximity: { halfKm: 999, exponent: 9 } } }).params.proximity).toEqual({ halfKm: 100, exponent: 5 });
    expect(coerceConfig({ params: { popularity: { root: 0 } } }).params.popularity).toEqual({ root: 0.1, starsPower: 6 });
    expect(coerceConfig({ params: { popularity: { root: 5 } } }).params.popularity).toEqual({ root: 1, starsPower: 6 });
    // MESITA-4153: the stars weight and the temperature clamp.
    expect(coerceConfig({ params: { popularity: { starsPower: 99 } } }).params.popularity.starsPower).toBe(12);
    expect(coerceConfig({ params: { shuffle: { temperature: -1 } } }).params.shuffle).toEqual({ temperature: 0 });
  });

  it("map keeps its typed keys clamped and every other stored key as is (H-2, MESITA-4454)", () => {
    const m = coerceConfig({
      map: { googlePopular: 20, mesitaClosest: 20, catalogPlacesShown: 40, selectedFactor: 5, placesShown: 33 },
    }).map as unknown as Record<string, unknown>;
    for (const kept of ["googlePopular", "mesitaClosest", "catalogPlacesShown", "selectedFactor"]) {
      expect(kept in m).toBe(true);
    }
    expect(m.placesShown).toBe(33);
    // Catalog page size (MESITA-2909): whole, 5..100, default 20.
    expect(DEFAULT_MAP.catalogPageSize).toBe(20);
    expect(coerceConfig({ map: { catalogPageSize: 1 } }).map.catalogPageSize).toBe(5);
    expect(coerceConfig({ map: { catalogPageSize: 500 } }).map.catalogPageSize).toBe(100);
    // Most pins shown (MESITA-2713, MESITA-2909): whole, 1..200, default 50.
    expect(DEFAULT_MAP.placesShown).toBe(50);
    expect(coerceConfig({ map: { placesShown: 0 } }).map.placesShown).toBe(1);
    expect(coerceConfig({ map: { placesShown: 900 } }).map.placesShown).toBe(200);
    expect(coerceConfig({ map: { placesShown: 33.4 } }).map.placesShown).toBe(33);
    // Minimum Popularity lives on Name (MESITA-3086): 0..20, one decimal.
    expect(coerceConfig({}).name.popularityFloor).toBe(2.7);
    expect(coerceConfig({ name: { popularityFloor: -1 } }).name.popularityFloor).toBe(0);
    expect(coerceConfig({ name: { popularityFloor: 99 } }).name.popularityFloor).toBe(20);
    expect(coerceConfig({ name: { popularityFloor: 3.44 } }).name.popularityFloor).toBe(3.4);
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
  it("coerceConfig drops the rails engine's catalog section (MESITA-2923)", () => {
    expect(coerceConfig({ catalog: { seedCount: 99 } })).not.toHaveProperty("catalog");
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
      supers: { restaurants: false },
    });
    // The live throttle (MESITA-2444): 1.5 s by default, the client's 0.5–10.
    expect(coerceConfig({}).map.reloadIdleSec).toBe(1.5);
    expect(coerceConfig({ map: { reloadIdleSec: 0.1 } }).map.reloadIdleSec).toBe(0.5);
    expect(coerceConfig({ map: { reloadIdleSec: 99 } }).map.reloadIdleSec).toBe(10);
    expect(coerceConfig({ map: { reloadIdleSec: 2.25 } }).map.reloadIdleSec).toBe(2.25);
    expect(coerceConfig({}).map.reloadMinViewportPct).toBe(15);
    expect(coerceConfig({ map: { reloadMinViewportPct: -4 } }).map.reloadMinViewportPct).toBe(0);
    expect(coerceConfig({ map: { reloadMinViewportPct: 99 } }).map.reloadMinViewportPct).toBe(50);
    expect(coerceConfig({ map: { reloadMinViewportPct: 12.26 } }).map.reloadMinViewportPct).toBe(12.3);
  });

  it("coerceConfig keeps only latestEvents under social; the retired engine's knobs drop (MESITA-2144, MESITA-4572)", () => {
    // The tentative Social engine's knobs had no reader. A blob that still
    // carries them comes back without them, so a whole-blob Save stops
    // writing them. The one Social setting since MESITA-4572 is latestEvents.
    const cfg = coerceConfig({
      social: { seedCount: 6, generatedCount: 6, eventsPerRail: 8, minSeedEvents: 1, horizonDays: 14 },
    });
    expect(cfg.social).toEqual({ latestEvents: 100 });
    expect(coerceConfig({ social: { latestEvents: 9999 } }).social.latestEvents).toBe(500);
  });

  it("coerceConfig drops the retired Search-bar family switches (MESITA-2767)", () => {
    expect(coerceConfig({ weights: {}, slotting: {} }).general).toEqual(DEFAULT_GENERAL);
    const name = coerceConfig({
      name: { fast: { count: 4, supers: { coffee: false } }, deep: { supers: { pizza: true } } },
    }).name;
    expect(name.fast).not.toHaveProperty("supers");
    expect(name.deep).not.toHaveProperty("supers");
  });


  it("the Map's root is still normalized while it waits for its migration (MESITA-3086, MESITA-4454)", () => {
    // Unread since MESITA-4454 (the Map rows replace it); kept, clamped.
    expect(DEFAULT_MAP.popularityRoot).toBe(0.33);
    const root = (raw: unknown) => coerceConfig({ map: { popularityRoot: raw } }).map.popularityRoot;
    expect(root(0.01)).toBe(0.1);
    expect(root(9)).toBe(1);
    expect(root(0.456)).toBe(0.46);
    expect(root("x")).toBe(0.33);
  });

  it("coerceConfig defaults name Fast 5 and Deep 3+3; a stored mesitaCount is dropped (MESITA-2896)", () => {
    expect(coerceConfig({ weights: {}, slotting: {} }).name).toEqual(DEFAULT_NAME);
    expect(coerceConfig({ name: { fast: { count: 99 }, deep: { mesitaCount: -1 } } }).name)
      .toMatchObject({
        fast: { googleCount: 20, count: 20 },
        deep: {
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
    });
    expect(
      coerceConfig({ name: { admin: { autoCount: 2, textCount: 7, mesitaCount: 5, emptyQuery: false } } })
        .name.admin,
    ).toEqual({ autoCount: 2, textCount: 7, emptyQuery: false });
  });
});

describe("recipes and mix (MESITA-4454), the twin of normalizeRecipes and normalizeMix", () => {
  it("read the recipe table and the mix defaults when absent", () => {
    expect(coerceConfig({}).params.recipes).toEqual(DEFAULT_RECIPES);
    expect(coerceConfig({}).params.mix).toEqual(DEFAULT_MIX);
    expect(DEFAULT_RECIPES.catalogNearbyOrganic).toEqual({ halfKm: 0.1, distanceExp: 4, googleExp: 0.33, foursquareFactor: 1, foursquareExponent: 20, premierExp: 0, batch: 10 });
    expect(DEFAULT_RECIPES.mapInorganic).toEqual({ halfKm: null, distanceExp: null, googleExp: 0.17, foursquareFactor: 0.5, foursquareExponent: 20, premierExp: 1, batch: null });
  });

  it("clamp each field; an Organic row's Premier exponent is 0 and a Map row has no distance (C1, L-1)", () => {
    const r = coerceRecipes({
      catalogPopularOrganic: { halfKm: 500, distanceExp: 0.1, googleExp: 0.01, premierExp: 2 },
      catalogPopularInorganic: { premierExp: 3, googleExp: "0.5" },
      catalogFamilyBoth: { halfKm: null, distanceExp: "x", batch: 0 },
      catalogNearbyOrganic: { halfKm: 0.123 },
      mapOrganic: { halfKm: 3, distanceExp: 2, premierExp: 1 },
    });
    expect(r.catalogPopularOrganic).toEqual({ halfKm: 100, distanceExp: 0.5, googleExp: 0.1, foursquareFactor: 1, foursquareExponent: 20, premierExp: 0, batch: 10 });
    expect(r.catalogPopularInorganic.premierExp).toBe(2);
    expect(r.catalogPopularInorganic.googleExp).toBe(0.5);
    expect([r.catalogFamilyBoth.halfKm, r.catalogFamilyBoth.distanceExp]).toEqual([2, 2]);
    expect(r.catalogFamilyBoth.batch).toBe(1);
    // A save from before MESITA-4517: Family Organic becomes Family both.
    expect(coerceRecipes({ catalogFamilyOrganic: { halfKm: 3 } }).catalogFamilyBoth.halfKm).toBe(3);
    expect(r.catalogNearbyOrganic.halfKm).toBe(0.12);
    expect(r.mapOrganic).toEqual({ halfKm: null, distanceExp: null, googleExp: 0.33, foursquareFactor: 1, foursquareExponent: 20, premierExp: 0, batch: null });
    expect(coerceRecipes({ catalogNearbyOrganic: { foursquareFactor: 0 } }).catalogNearbyOrganic.foursquareFactor).toBe(0);
    expect(coerceRecipes({}).catalogNearbyOrganic.foursquareExponent).toBe(20);
  });

  it("mix: Temperature 0–5 per mode, ad floor 0–1, ad cadence 0–10 whole", () => {
    expect(coerceMix({ temperature: { nearby: 9, family: -1, popular: 0.333 }, adFloor: 2, adEvery: 3.6 })).toEqual({
      temperature: { nearby: 5, family: 0, popular: 0.33 },
      adFloor: 1,
      adEvery: 4,
      proFactor: 2,
      maxFactor: 5,
      growthWeightCap: 0.5,
    });
    // MESITA-5028: Pro and Max are 1–10, defaults 2 and 5.
    expect(coerceMix({ proFactor: 0, maxFactor: 20 })).toMatchObject({ proFactor: 1, maxFactor: 10 });
    expect(coerceMix({ growthWeightCap: 0.8 }).growthWeightCap).toBe(0.8);
    expect(coerceMix({ growthWeightCap: 2 }).growthWeightCap).toBe(0.8);
    expect(coerceMix({ adEvery: 0 }).adEvery).toBe(0);
    expect(coerceMix({ adEvery: 99 }).adEvery).toBe(10);
  });

  it("an unknown key under params and map survives coerce and a round trip (H-2)", () => {
    const raw = {
      params: { future: { knob: 1 }, recipes: { catalogNearbyOrganic: { halfKm: 0.3 } } },
      map: { futureMap: true },
      future: { top: 1 },
    };
    const once = coerceConfig(raw);
    for (const cfg of [once, coerceConfig(once)]) {
      expect((cfg.params as unknown as Record<string, unknown>).future).toEqual({ knob: 1 });
      expect((cfg.map as unknown as Record<string, unknown>).futureMap).toBe(true);
      expect(cfg.params.recipes.catalogNearbyOrganic.halfKm).toBe(0.3);
      expect(cfg).not.toHaveProperty("future");
    }
  });

  it("the bounds name the same ranges as the constants", () => {
    expect(RECIPE_BOUNDS.halfKm).toEqual({ min: HALF_KM_MIN, max: HALF_KM_MAX, decimals: 2 });
    expect(RECIPE_BOUNDS.distanceExp).toEqual({ min: EXPONENT_MIN, max: EXPONENT_MAX, decimals: 1 });
    expect(MIX_BOUNDS.adEvery.decimals).toBe(0);
  });
});

describe("Discovery page box order", () => {
  it("is ONE page of six sections in the guest's order, no subpages (MESITA-2327, MESITA-3828, MESITA-4454, MESITA-4463, MESITA-4694)", () => {
    const page = readFileSync(join(__dirname, "page.tsx"), "utf8");
    const nav = readFileSync(join(__dirname, "nav.ts"), "utf8");
    const nextConfig = readFileSync(
      join(__dirname, "../../../../next.config.ts"),
      "utf8",
    );
    const order = ["<RankingBox", "<MixingBox", "<SocialDiscoveryBox", "<MapDisplayBox", "<SearchbarsBox", "<HowRankedCard"].map((tag) =>
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
