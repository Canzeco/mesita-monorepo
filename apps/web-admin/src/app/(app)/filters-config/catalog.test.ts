import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  coerceConfig,
  DEFAULT_CATALOG,
  DEFAULT_GENERAL,
  DEFAULT_MAP,
  DEFAULT_NAME,
  DEFAULT_SOCIAL,
  DEFAULT_SWIPE,
  ENGINES,
  DISCOVERY_MODE_MODULES,
  DISCOVERY_MODULES,
  LIBRARY_SIGNALS,
  SIGNALS,
  SIGNAL_KEYS,
  modeCallsModule,
  modeRequiresPool,
  modeSignalState,
  snapMapReloadPair,
} from "./catalog";

describe("Discovery function APIs", () => {
  it("every signal is a stored-index function — no vendor API at rank time", () => {
    expect(SIGNALS.map((s) => [s.key, s.apis])).toEqual([
      ["name", []],
      ["summary", []],
      ["proximity", []],
      ["timing", []],
      ["category", []],
      ["popularity", []],
      ["partnership", []],
      ["randomness", []],
      ["social", []],
    ]);
  });

  it("only maxKm and closedFloor are extra operator knobs", () => {
    expect(
      SIGNALS.flatMap((s) => s.fields.map((f) => `${s.key}.${f.key}`)),
    ).toEqual(["proximity.maxKm", "timing.closedFloor"]);
  });

  it("library order is the nine Lineup signals — Promoting is not a row", () => {
    expect(LIBRARY_SIGNALS.map((row) => row.key)).toEqual([
      "name",
      "summary",
      "proximity",
      "timing",
      "category",
      "popularity",
      "partnership",
      "randomness",
      "social",
    ]);
    expect(SIGNAL_KEYS).not.toContain("promoting");
    expect(SIGNAL_KEYS).not.toContain("semantic");
    expect(SIGNAL_KEYS).toContain("randomness");
    expect(SIGNAL_KEYS).toContain("name");
    expect(SIGNAL_KEYS).toContain("summary");
    expect(SIGNAL_KEYS).toContain("partnership");
    expect(SIGNAL_KEYS).toContain("social");
  });

  it("coerceConfig folds old semantic weight and params onto summary", () => {
    const cfg = coerceConfig({
      weights: { semantic: 2, proximity: 1.5 },
      params: { semantic: { unembedded: 0.2 } },
    });
    expect(cfg.weights.summary).toBe(2);
    expect(cfg.weights.name).toBe(1);
    expect(cfg.weights.partnership).toBe(1);
    expect(cfg.params.summary.unembedded).toBe(0.2);
    expect(cfg.weights).not.toHaveProperty("semantic");
  });

  it("seven modules and a locked mode → module matrix", () => {
    expect([...DISCOVERY_MODULES]).toEqual([
      "Google Places Autocomplete",
      "Google Places Text Search",
      "Google Places Nearby Search",
      "Perplexity Search",
      "Perplexity Agent",
      "Mesita Places Lineup",
      "Mesita Social Lineup",
    ]);
    expect(DISCOVERY_MODE_MODULES.fast).toEqual(["Google Places Autocomplete"]);
    expect(DISCOVERY_MODE_MODULES.deep).toEqual([
      "Google Places Autocomplete",
      "Google Places Text Search",
      "Mesita Places Lineup",
    ]);
    expect(DISCOVERY_MODE_MODULES.map).toEqual([
      "Google Places Nearby Search",
      "Mesita Places Lineup",
    ]);
    expect(DISCOVERY_MODE_MODULES.chat).toEqual([
      "Google Places Text Search",
      "Google Places Nearby Search",
      "Perplexity Search",
      "Perplexity Agent",
      "Mesita Places Lineup",
    ]);
    expect(DISCOVERY_MODE_MODULES.social).toEqual(["Mesita Social Lineup"]);
    expect(DISCOVERY_MODE_MODULES.favorites).toEqual([]);
    expect(modeCallsModule("chat", "Mesita Social Lineup")).toBe(false);
    expect(modeCallsModule("deep", "Google Places Nearby Search")).toBe(false);
  });

  it("pool mask is Google Places + Listed on Swipe · Catalog · Social; Favorites requires Google Places", () => {
    expect(modeRequiresPool("swipe", "google")).toBe(true);
    expect(modeRequiresPool("swipe", "listed")).toBe(true);
    expect(modeRequiresPool("favorites", "google")).toBe(true);
    expect(modeRequiresPool("favorites", "listed")).toBe(false);
    expect(modeRequiresPool("favorites", "enriched")).toBe(false);
    expect(modeRequiresPool("deep", "listed")).toBe(false);
    expect(modeRequiresPool("chat", "google")).toBe(false);
    expect(modeRequiresPool("map", "enriched")).toBe(false);
    expect(modeRequiresPool("swipe", "enriched")).toBe(false);
  });

  it("Places Lineup signals light Deep Name, Chat Summary, Map without Randomness", () => {
    expect(modeSignalState("deep", "name")).toBe("on");
    expect(modeSignalState("deep", "summary")).toBe("off");
    expect(modeSignalState("chat", "summary")).toBe("on");
    expect(modeSignalState("chat", "randomness")).toBe("off");
    expect(modeSignalState("map", "proximity")).toBe("on");
    expect(modeSignalState("map", "randomness")).toBe("zero");
    expect(modeSignalState("swipe", "randomness")).toBe("on");
    expect(modeSignalState("catalog", "partnership")).toBe("on");
    expect(modeSignalState("social", "name")).toBe("off");
    expect(modeSignalState("favorites", "proximity")).toBe("off");
    expect(SIGNAL_KEYS.every((key) => modeSignalState("fast", key) === "off")).toBe(
      true,
    );
    expect(modeSignalState("chat", "social")).toBe("off");
  });

  it("map() is three closest-N lanes then one catalog", () => {
    const map = ENGINES.find((e) => e.key === "map");
    expect(map?.state).toBe("LIVE");
    expect(map?.apis).toEqual(["Google Places Nearby Search"]);
    expect(map?.input).toMatch(/guest pin/i);
    expect(map?.process).toMatch(/Partners/);
    expect(map?.process).toMatch(/Mesita/);
    expect(map?.process).toMatch(/Google/);
    expect(map?.process).toMatch(/overlaps/);
    expect(map?.process).toMatch(/reload pair/);
    expect(map?.process).not.toMatch(/Nearest 50/);
    expect(map?.process).not.toMatch(/under 10/);
  });

  it("coerceConfig defaults map lane caps on an old blob", () => {
    expect(coerceConfig({ weights: {}, slotting: {} }).map.partnerCount).toBe(10);
    expect(coerceConfig({ weights: {}, slotting: {} }).map.mesitaCount).toBe(10);
    expect(coerceConfig({ weights: {}, slotting: {} }).map.googleCount).toBe(20);
    expect(coerceConfig({ map: { partnerCount: 99, googleCount: -1 } }).map).toMatchObject({
      partnerCount: 20,
      mesitaCount: 10,
      googleCount: 0,
    });
    expect(coerceConfig({ map: { notPartnerCount: 7 } }).map.mesitaCount).toBe(7);
  });

  it("catalog() is parked — Home Catalog is Soon", () => {
    const catalog = ENGINES.find((e) => e.key === "catalog");
    expect(catalog?.state).toBe("PARKED");
    expect(catalog?.apis).toEqual([]);
    expect(catalog?.process).toMatch(/Parked/i);
    expect(catalog?.process).toMatch(/Soon/);
  });

  it("coerceConfig defaults catalog on an old blob", () => {
    expect(coerceConfig({ weights: {}, slotting: {} }).catalog).toEqual(DEFAULT_CATALOG);
    expect(coerceConfig({ catalog: { seedCount: 99 } }).catalog.seedCount).toBe(20);
  });

  it("coerceConfig defaults map on an old blob and clamps knobs", () => {
    expect(coerceConfig({ weights: {}, slotting: {} }).map).toEqual(DEFAULT_MAP);
    expect(
      coerceConfig({
        map: { minRating: 9, minPopularity: 4, types: { restaurant: false } },
      }).map,
    ).toEqual({
      ...DEFAULT_MAP,
      minRating: 5,
      minPopularity: 1,
      types: { ...DEFAULT_MAP.types, restaurant: false },
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

  it("coerceConfig defaults social on an old blob and clamps knobs", () => {
    expect(coerceConfig({ weights: {}, slotting: {} }).social).toEqual(DEFAULT_SOCIAL);
    expect(coerceConfig({ social: { seedCount: 99, horizonDays: 400 } }).social).toEqual({
      ...DEFAULT_SOCIAL,
      seedCount: 20,
      horizonDays: 90,
    });
  });

  it("social() stays parked and names events, not places", () => {
    const social = ENGINES.find((e) => e.key === "social");
    expect(social?.state).toBe("PARKED");
    expect(social?.process).toMatch(/events/i);
    expect(social?.input).toMatch(/events/i);
    expect(social?.process).not.toMatch(/Check-ins/);
  });

  it("name() is Fast Autocomplete plus Deep four-query concat", () => {
    const name = ENGINES.find((e) => e.key === "name");
    expect(name?.state).toBe("LIVE");
    expect(name?.apis).toEqual([
      "Google Places Autocomplete",
      "Google Places Text Search",
      "Place Details",
    ]);
    expect(name?.process).toMatch(/Fast/);
    expect(name?.process).toMatch(/Autocomplete only/);
    expect(name?.process).toMatch(/Deep/);
    expect(name?.process).toMatch(/Places Lineup Name/);
    expect(name?.process).toMatch(/places\.name/);
    expect(name?.process).toMatch(/not `google_name`/);
    expect(name?.process).toMatch(/resolves/);
    expect(name?.process).toMatch(/Partners/);
    expect(name?.process).toMatch(/Deep never calls Nearby Search/);
    expect(name?.process).toMatch(/first query keeps the slot/);
    expect(name?.apis).not.toContain("Google Places Nearby Search");
    expect(name?.process).toMatch(/Map Filters never cut this list/);
    expect(name?.process).not.toMatch(/summary embedding/i);
    expect(name?.process).not.toMatch(/Max results caps the merge/);
  });

  it("coerceConfig defaults swipe on an old blob and clamps knobs", () => {
    expect(coerceConfig({ weights: {}, slotting: {} }).swipe).toEqual(DEFAULT_SWIPE);
    expect(
      coerceConfig({
        swipe: {
          radiusKm: 99,
          weightProximity: 4,
          partnerBias: { dominant: 9 },
          minReviews: -2,
          randomnessMax: 9,
        },
      }).swipe,
    ).toMatchObject({
      radiusKm: 50,
      weightProximity: 1,
      partnerBias: { ...DEFAULT_SWIPE.partnerBias, dominant: 2 },
      minReviews: 0,
      closingBufferMin: 30,
      randomnessMax: 2,
    });
  });

  it("swipe() is parked with the rest of Home", () => {
    const swipe = ENGINES.find((e) => e.key === "swipe");
    expect(swipe?.state).toBe("PARKED");
    expect(swipe?.process).toMatch(/Parked/i);
    expect(swipe?.process).toMatch(/Soon/);
    expect(swipe?.process).not.toMatch(/slot bought/);
  });

  it("coerceConfig defaults general.categoryCount to 5 and clamps 0–5", () => {
    expect(coerceConfig({ weights: {}, slotting: {} }).general).toEqual(DEFAULT_GENERAL);
    expect(coerceConfig({ general: { categoryCount: 99 } }).general.categoryCount).toBe(5);
    expect(coerceConfig({ general: { categoryCount: -1 } }).general.categoryCount).toBe(0);
    expect(coerceConfig({ general: { categoryCount: 3.6 } }).general.categoryCount).toBe(4);
  });

  it("coerceConfig defaults name Fast 5 and Deep 3+3+3+3", () => {
    expect(coerceConfig({ weights: {}, slotting: {} }).name).toEqual(DEFAULT_NAME);
    expect(coerceConfig({ name: { fast: { count: 99 }, deep: { partnerCount: -1 } } }).name)
      .toMatchObject({
        fast: { googleCount: 20, count: 20 },
        deep: {
          partnerCount: 0,
          mesitaCount: 3,
          autoCount: 3,
          googleCount: 3,
          count: 9,
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
    ).toMatchObject({
      autoCount: 5,
      googleCount: 1,
      mesitaCount: 10,
      partnerCount: 8,
    });
  });

  it("chat() is parked with the rest of Home", () => {
    const chat = ENGINES.find((e) => e.key === "chat");
    expect(chat?.state).toBe("PARKED");
    expect(chat?.process).toMatch(/Soon/);
    expect(chat?.apis).toEqual(["OpenAI"]);
  });

  it("Home engines are Soon — Swipe · Catalog · Chat · Social · Favorites", () => {
    for (const key of ["swipe", "catalog", "chat", "social", "favorites"] as const) {
      expect(ENGINES.find((e) => e.key === key)?.state, key).toBe("PARKED");
    }
  });

  it("engines name only the vendor APIs they actually call", () => {
    expect(ENGINES.map((e) => [e.key, e.apis])).toEqual([
      ["swipe", []],
      ["map", ["Google Places Nearby Search"]],
      ["favorites", []],
      ["catalog", []],
      ["chat", ["OpenAI"]],
      ["social", []],
      ["name", ["Google Places Autocomplete", "Google Places Text Search", "Place Details"]],
      ["web", ["Perplexity"]],
    ]);
  });
});

describe("Discovery page box order", () => {
  it("is two subpages — Discovery Modes and Discovery Modules", () => {
    const page = readFileSync(join(__dirname, "page.tsx"), "utf8");
    const layout = readFileSync(join(__dirname, "layout.tsx"), "utf8");
    const nav = readFileSync(join(__dirname, "nav.ts"), "utf8");
    const modesPage = readFileSync(join(__dirname, "modes/page.tsx"), "utf8");
    const modulesPage = readFileSync(join(__dirname, "modules/page.tsx"), "utf8");
    const surfaces = readFileSync(join(__dirname, "DiscoverySurfaceCards.tsx"), "utf8");
    const swipe = readFileSync(join(__dirname, "SwipeConfigClient.tsx"), "utf8");
    const name = readFileSync(join(__dirname, "NameConfigClient.tsx"), "utf8");
    const general = readFileSync(join(__dirname, "GeneralConfigClient.tsx"), "utf8");
    const catalog = readFileSync(join(__dirname, "CatalogConfigClient.tsx"), "utf8");
    const social = readFileSync(join(__dirname, "SocialConfigClient.tsx"), "utf8");
    const chat = readFileSync(join(__dirname, "DiscoveryConfigClient.tsx"), "utf8");
    const map = readFileSync(join(__dirname, "MapConfigClient.tsx"), "utf8");
    const signals = readFileSync(join(__dirname, "SignalsConfigClient.tsx"), "utf8");
    const googleModules = readFileSync(join(__dirname, "GoogleModuleCards.tsx"), "utf8");
    const chips = readFileSync(join(__dirname, "ModeModuleChips.tsx"), "utf8");
    const nextConfig = readFileSync(
      join(__dirname, "../../../../next.config.ts"),
      "utf8",
    );

    expect(nav).toContain('label: "Discovery Modes"');
    expect(nav).toContain('label: "Discovery Modules"');
    expect(nav).toContain('"/filters-config/modes"');
    expect(nav).toContain('"/filters-config/modules"');
    expect(nav).toContain("/filters-config/modes#s-map");
    expect(layout).toContain("DiscoveryChrome");
    const chrome = readFileSync(join(__dirname, "DiscoveryChrome.tsx"), "utf8");
    expect(chrome).toContain("ConfigTabNav");
    expect(chrome).toContain("DISCOVERY_TABS");
    expect(chrome).toContain("tab?.label");
    expect(page).toContain("redirect(DISCOVERY_MODES_HREF)");
    expect(page).not.toContain("GeneralConfigClient");
    expect(page).not.toContain("ConfigSection");
    expect(nextConfig).toContain('destination: "/filters-config/modes"');
    expect(nextConfig).not.toContain('destination: "/filters-config",');

    expect(general).toContain('title="Google types"');
    expect(general).toContain("NEARBY_TYPE_FIELDS");
    expect(general).toContain('["general", "nameFast", "nameDeep", "map"]');
    expect(name).toContain('title="Name (Fast Search)"');
    expect(name).toContain('title="Name (Deep Search)"');
    expect(name).toContain("Google Places Autocomplete only");
    expect(name).toContain("Name signal only");
    expect(name).toContain("places.name");
    expect(name).toContain("google_name");
    expect(name).toContain("Deep never calls Nearby Search");
    expect(name).toContain("Needs a location. No pin, no bias.");
    expect(name).toContain("Deep reads Name (off vs on)");
    expect(name).toContain('label="Google places"');
    expect(name).toContain('label="Max results"');
    expect(name).toContain("name.fast.googleCount");
    expect(name).toContain("name.fast.count");
    expect(name).toContain("patchFast({ googleCount, count: googleCount })");
    expect(name).toContain("patchFast({ count, googleCount: count })");
    expect(name).toContain("name.deep.autoCount");
    expect(name).toContain("name.deep.partnerCount");
    expect(name).toContain("name.deep.mesitaCount");
    expect(name).toContain("name.deep.googleCount");
    expect(name).not.toContain("name.deep.count");
    expect(name).not.toContain("Max results caps the merge");
    expect(name).toContain("Map Filters never cut this list");
    expect(name).toContain("same cap — Max results stays for Deep symmetry");
    const deepKnobs = name.slice(name.indexOf('title="Name (Deep Search)"'));
    const deepAuto = deepKnobs.indexOf('label: "Google Autocomplete"');
    const deepText = deepKnobs.indexOf('label: "Google Text Search"');
    const deepPlaces = deepKnobs.indexOf('label: "Mesita places"');
    const deepPartners = deepKnobs.indexOf('label: "Mesita partners"');
    expect(deepAuto).toBeLessThan(deepText);
    expect(deepText).toBeLessThan(deepPlaces);
    expect(deepPlaces).toBeLessThan(deepPartners);
    expect(deepKnobs).not.toContain('label: "Max results"');
    expect(name).toContain(
      "Then concat. Autocomplete → Text Search → Mesita Places → Mesita Partners.",
    );
    expect(name).toContain("QueryConcatCaps");
    expect(name).not.toContain("cascadeLaneCounts");
    expect(map).toContain(
      "Then concat. Closest Partners → closest Mesita Places → closest Google Nearby.",
    );
    expect(map).toContain("QueryConcatCaps");
    expect(map).not.toContain("LaneMergeFunnel");
    expect(map).not.toContain("cascadeLaneCounts");
    expect(map).toContain("Listed pins then Lineup, not distance");
    expect(map).toContain("Map reads the Map mask");
    expect(map).toContain("Reload after");
    expect(map).toContain("MAP_RELOAD_PAIRS");
    expect(map).toContain("Only dragging the map counts");
    expect(map).not.toContain("Reload after the camera moves");
    expect(map).not.toContain("Reload after waiting");
    expect(name).not.toContain('title="Search"');
    expect(map).toContain('title="Map"');
    expect(swipe).toContain('title="Swipe is coming soon"');
    expect(swipe).toContain("ConfigSoon");
    expect(catalog).toContain('title="Catalog is coming soon"');
    expect(catalog).toContain("ConfigSoon");
    expect(chat).toContain('title="Chat is coming soon"');
    expect(chat).toContain("ConfigSoon");
    expect(social).toContain('title="Social is coming soon"');
    expect(social).toContain("ConfigSoon");
    expect(surfaces).toContain('title="Favorites is coming soon"');
    expect(surfaces).toContain("ConfigSoon");
    expect(surfaces).not.toContain('title="Favs"');
    expect(surfaces).not.toContain('title="Name"');
    expect(surfaces).not.toContain('title="Swipe"');
    expect(catalog).not.toContain("SocialConfig");
    expect(signals).toContain('title="Mesita Places Lineup"');
    expect(signals).toContain("LIBRARY_SIGNALS");
    expect(signals).not.toContain("Promoting");
    expect(signals).toContain("randomness");
    expect(googleModules).toContain("Google Places Autocomplete");
    expect(googleModules).toContain("Google Places Nearby Search");
    expect(googleModules).toContain("Google Places Text Search");
    expect(googleModules).toContain("Name (Deep Search)");
    expect(googleModules).toContain("Name (Deep) does not");
    expect(googleModules).not.toContain("pin bias");
    expect(chips).toContain("export function ModeModuleChips");
    expect(chips).toContain("None");
    expect(modesPage).toContain("DiscoveryMatrix");
    const matrix = readFileSync(join(__dirname, "DiscoveryMatrix.tsx"), "utf8");
    expect(matrix).toContain("Places Lineup");
    expect(matrix).toContain("modeSignalState");
    expect(name).toContain("ModeModuleChips");
    expect(name).not.toContain("TypeBatteries");
    expect(name).not.toContain("Google categories");
    expect(map).toContain("ModeModuleChips");
    expect(map).not.toContain("Google categories");
    expect(swipe).toContain("ModeModuleChips");

    const modesJsx = modesPage.slice(modesPage.indexOf("return ("));
    const modulesJsx = modulesPage.slice(modulesPage.indexOf("return ("));
    const modeOrder = [
      "NameConfigClient",
      "MapConfigClient",
      "SwipeConfigClient",
      "CatalogConfigClient",
      "DiscoveryConfigClient",
      "SocialConfigClient",
      "FavsConfigCard",
    ];
    let last = -1;
    for (const n of modeOrder) {
      const idx = modesJsx.indexOf(n);
      expect(idx, n).toBeGreaterThan(last);
      last = idx;
    }
    expect(modesJsx).not.toContain("GeneralConfigClient");
    expect(modesJsx).not.toContain("SignalsConfigClient");
    expect(modesJsx).not.toContain("ConfigSoon");

    expect(modulesJsx.indexOf("GeneralConfigClient")).toBeGreaterThan(-1);
    expect(modulesJsx.indexOf("GoogleModuleCards")).toBeGreaterThan(
      modulesJsx.indexOf("GeneralConfigClient"),
    );
    expect(modulesJsx.indexOf("s-perplexity")).toBeGreaterThan(
      modulesJsx.indexOf("GoogleModuleCards"),
    );
    expect(modulesJsx.indexOf("s-perplexity-agent")).toBeGreaterThan(
      modulesJsx.indexOf("s-perplexity"),
    );
    expect(modulesJsx.indexOf("SignalsConfigClient")).toBeGreaterThan(
      modulesJsx.indexOf("s-perplexity-agent"),
    );
    expect(modulesJsx.indexOf("s-social-lineup")).toBeGreaterThan(
      modulesJsx.indexOf("SignalsConfigClient"),
    );
    expect(modulesJsx).toContain("Mesita Social Lineup is coming soon");
    expect(modulesJsx).toContain("Perplexity Search is coming soon");
    expect(modulesJsx).toContain("Perplexity Agent is coming soon");
    expect(modulesJsx).not.toContain("NameConfigClient");
    expect(modulesJsx).not.toContain("MapConfigClient");
    expect(modulesJsx).not.toContain("FavsConfigCard");
    expect(modulesJsx).not.toContain('title="General"');
    expect(modulesJsx).not.toContain('title="Signals"');
  });
});
