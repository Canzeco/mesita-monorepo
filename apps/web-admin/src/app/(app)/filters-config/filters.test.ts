import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  MODULE_KEYS,
  SURFACE_KEYS,
  coerceFiltersConfig,
  generalWarnings,
  resolveSurface,
  surfaceWarnings,
  type FiltersConfig,
} from "./filters";

function clone(): FiltersConfig {
  return structuredClone(DEFAULT_FILTERS);
}

describe("defaults", () => {
  it("mirror the shipped consumer engine's neutral open", () => {
    const { defaults, bounds } = DEFAULT_FILTERS.general;
    expect(defaults).toEqual({
      context: "any",
      when: "anytime",
      maxKm: null,
      randomness: 0,
    });
    expect(bounds.distanceMinKm).toBe(1);
    expect(bounds.distanceMaxKm).toBe(50);
    expect(bounds.randomnessMax).toBe(4);
    expect(bounds.categoryOptionsCap).toBe(12);
  });

  it("enable the live surfaces and leave the parked Home modes off", () => {
    expect(DEFAULT_FILTERS.surfaces.swipe.enabled).toBe(true);
    expect(DEFAULT_FILTERS.surfaces.map.enabled).toBe(true);
    expect(DEFAULT_FILTERS.surfaces.search.enabled).toBe(true);
    expect(DEFAULT_FILTERS.surfaces.catalog.enabled).toBe(false);
    expect(DEFAULT_FILTERS.surfaces.chat.enabled).toBe(false);
    expect(DEFAULT_FILTERS.surfaces.social.enabled).toBe(false);
  });
});

describe("resolveSurface", () => {
  it("inherit TRACKS general rather than copying it", () => {
    const cfg = clone();
    expect(resolveSurface(cfg, "swipe").modules.random).toBe(true);
    cfg.general.modules.random = false;
    // The surface was never edited — it still says `inherit`, and it followed.
    expect(cfg.surfaces.swipe.modules.random).toBe("inherit");
    expect(resolveSurface(cfg, "swipe").modules.random).toBe(false);
  });

  it("general's master switch beats a surface saying `on`", () => {
    const cfg = clone();
    cfg.general.modules.distance = false;
    cfg.surfaces.map.modules.distance = "on";
    expect(resolveSurface(cfg, "map").modules.distance).toBe(false);
  });

  it("a surface can switch a module off while general keeps it", () => {
    const cfg = clone();
    cfg.surfaces.map.modules.random = "off";
    expect(resolveSurface(cfg, "map").modules.random).toBe(false);
    expect(resolveSurface(cfg, "swipe").modules.random).toBe(true);
  });

  it("folds default overrides, with `any` distinct from inherit", () => {
    const cfg = clone();
    cfg.general.defaults.maxKm = 10;
    cfg.surfaces.search.overrides.maxKm = "any";
    cfg.surfaces.swipe.overrides.maxKm = null;
    cfg.surfaces.map.overrides.maxKm = 25;

    expect(resolveSurface(cfg, "search").defaults.maxKm).toBeNull();
    expect(resolveSurface(cfg, "swipe").defaults.maxKm).toBe(10);
    expect(resolveSurface(cfg, "map").defaults.maxKm).toBe(25);
  });

  it("resolves context, when and randomness through the same inherit rule", () => {
    const cfg = clone();
    cfg.general.defaults.context = "visit";
    cfg.surfaces.swipe.overrides.context = "any";
    cfg.surfaces.map.overrides.randomness = 3;

    expect(resolveSurface(cfg, "swipe").defaults.context).toBe("any");
    expect(resolveSurface(cfg, "search").defaults.context).toBe("visit");
    expect(resolveSurface(cfg, "map").defaults.randomness).toBe(3);
    expect(resolveSurface(cfg, "swipe").defaults.randomness).toBe(0);
  });
});

describe("warnings — reported, never corrected", () => {
  it("is silent on the defaults", () => {
    expect(generalWarnings(DEFAULT_FILTERS)).toEqual([]);
    for (const key of SURFACE_KEYS) {
      // Parked surfaces are disabled with modules inheriting `on`, which is a
      // real contradiction worth saying out loud.
      const warnings = surfaceWarnings(DEFAULT_FILTERS, key);
      if (DEFAULT_FILTERS.surfaces[key].enabled) expect(warnings).toEqual([]);
      else expect(warnings.length).toBeGreaterThan(0);
    }
  });

  it("flags a surface `on` that general has switched off", () => {
    const cfg = clone();
    cfg.general.modules.what = false;
    cfg.surfaces.swipe.modules.what = "on";
    expect(surfaceWarnings(cfg, "swipe").join(" ")).toContain("General wins");
  });

  it("flags an override for a module that is off here", () => {
    const cfg = clone();
    cfg.surfaces.map.modules.distance = "off";
    cfg.surfaces.map.overrides.maxKm = 5;
    expect(surfaceWarnings(cfg, "map").join(" ")).toContain(
      "Distance module is off",
    );
  });

  it("flags a distance range that cannot exist", () => {
    const cfg = clone();
    cfg.general.bounds.distanceMinKm = 50;
    cfg.general.bounds.distanceMaxKm = 5;
    expect(generalWarnings(cfg).join(" ")).toContain("not below the ceiling");
  });

  it("flags a narrowing default with no control to clear it", () => {
    const cfg = clone();
    cfg.general.defaults.context = "visit";
    cfg.general.modules.context = false;
    expect(generalWarnings(cfg).join(" ")).toContain("no visible control");
  });

  it("flags Distance on with Where off", () => {
    const cfg = clone();
    cfg.general.modules.where = false;
    expect(generalWarnings(cfg).join(" ")).toContain("no center");
  });

  it("does not mutate the config it inspects", () => {
    const cfg = clone();
    cfg.general.modules.where = false;
    const before = JSON.stringify(cfg);
    generalWarnings(cfg);
    surfaceWarnings(cfg, "swipe");
    resolveSurface(cfg, "swipe");
    expect(JSON.stringify(cfg)).toBe(before);
  });
});

describe("coerceFiltersConfig", () => {
  it("returns a complete config from garbage", () => {
    for (const raw of [null, undefined, 3, "x", [], {}]) {
      const cfg = coerceFiltersConfig(raw);
      expect(cfg.version).toBe(1);
      expect(Object.keys(cfg.surfaces).sort()).toEqual([...SURFACE_KEYS].sort());
      for (const key of SURFACE_KEYS) {
        expect(Object.keys(cfg.surfaces[key].modules).sort()).toEqual(
          [...MODULE_KEYS].sort(),
        );
      }
    }
  });

  it("keeps a valid blob intact through a round trip", () => {
    const cfg = clone();
    cfg.general.modules.random = false;
    cfg.general.defaults.context = "visit";
    cfg.general.defaults.maxKm = 12;
    cfg.surfaces.map.overrides.maxKm = "any";
    cfg.surfaces.swipe.resultCap = 40;
    expect(coerceFiltersConfig(JSON.parse(JSON.stringify(cfg)))).toEqual(cfg);
  });

  it("clamps out-of-range numbers instead of rejecting the blob", () => {
    const cfg = coerceFiltersConfig({
      general: {
        defaults: { randomness: 99, maxKm: 100000 },
        bounds: { categoryOptionsCap: 0, randomnessMax: -5 },
      },
      surfaces: { swipe: { resultCap: 99999 } },
    });
    expect(cfg.general.defaults.randomness).toBe(4);
    expect(cfg.general.defaults.maxKm).toBe(200);
    expect(cfg.general.bounds.categoryOptionsCap).toBe(1);
    expect(cfg.general.bounds.randomnessMax).toBe(0);
    expect(cfg.surfaces.swipe.resultCap).toBe(500);
  });

  it("keeps null maxKm as `Any` rather than falling back to a number", () => {
    const cfg = coerceFiltersConfig({ general: { defaults: { maxKm: null } } });
    expect(cfg.general.defaults.maxKm).toBeNull();
  });

  it("distinguishes an `any` override from an absent one", () => {
    const cfg = coerceFiltersConfig({
      surfaces: { map: { overrides: { maxKm: "any" } } },
    });
    expect(cfg.surfaces.map.overrides.maxKm).toBe("any");
    expect(cfg.surfaces.swipe.overrides.maxKm).toBeNull();
  });

  it("drops unknown surfaces, modules and enum values", () => {
    const cfg = coerceFiltersConfig({
      surfaces: {
        nonsense: { enabled: true },
        swipe: {
          modules: { context: "maybe", nonsense: "on" },
          overrides: { context: "order", when: "later" },
        },
      },
    });
    expect("nonsense" in cfg.surfaces).toBe(false);
    expect("nonsense" in cfg.surfaces.swipe.modules).toBe(false);
    expect(cfg.surfaces.swipe.modules.context).toBe("inherit");
    // `order` is parked and can never be a default — it falls back, never through.
    expect(cfg.surfaces.swipe.overrides.context).toBe("any");
    expect(cfg.surfaces.swipe.overrides.when).toBe("anytime");
  });
});
