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
  LIBRARY_SIGNALS,
  SIGNALS,
  SIGNAL_KEYS,
} from "./catalog";

describe("Discovery function APIs", () => {
  it("every signal is a stored-index function — no vendor API at rank time", () => {
    expect(SIGNALS.map((s) => [s.key, s.apis])).toEqual([
      ["proximity", []],
      ["timing", []],
      ["category", []],
      ["popularity", []],
      ["semantic", []],
      ["randomness", []],
    ]);
  });

  it("only maxKm and closedFloor are extra operator knobs", () => {
    expect(
      SIGNALS.flatMap((s) => s.fields.map((f) => `${s.key}.${f.key}`)),
    ).toEqual(["proximity.maxKm", "timing.closedFloor"]);
  });

  it("library order is Proximity · Timing · Popularity · Promoting · Semantic · Category", () => {
    expect(LIBRARY_SIGNALS.map((row) => (row.kind === "promoting" ? "promoting" : row.key)))
      .toEqual([
        "proximity",
        "timing",
        "popularity",
        "promoting",
        "semantic",
        "category",
      ]);
    expect(SIGNAL_KEYS).not.toContain("promoting");
    expect(SIGNAL_KEYS).toContain("randomness");
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
    expect(map?.process).toMatch(/reloadMinKm/);
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

  it("name() is Fast Autocomplete plus Deep three-lane merge", () => {
    const name = ENGINES.find((e) => e.key === "name");
    expect(name?.state).toBe("LIVE");
    expect(name?.apis).toEqual([
      "Google Places Autocomplete",
      "Google Places Text Search",
      "Place Details",
    ]);
    expect(name?.process).toMatch(/Fast/);
    expect(name?.process).toMatch(/Deep/);
    expect(name?.process).toMatch(/Partners/);
    expect(name?.process).toMatch(/name embedding/i);
    expect(name?.process).not.toMatch(/summary embedding/i);
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

  it("coerceConfig defaults name Fast 5 and Deep 3+3+3 on an old blob", () => {
    expect(coerceConfig({ weights: {}, slotting: {} }).name).toEqual(DEFAULT_NAME);
    expect(coerceConfig({ name: { fast: { count: 99 }, deep: { partnerCount: -1 } } }).name)
      .toMatchObject({
        fast: { count: 20 },
        deep: { partnerCount: 0, mesitaCount: 3, googleCount: 3 },
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

    expect(general).toContain('title="General"');
    expect(name).toContain('title="Name (Fast Search)"');
    expect(name).toContain('title="Name (Deep Search)"');
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
    expect(signals).toContain('title="Signals"');
    expect(signals).toContain("LIBRARY_SIGNALS");
    expect(signals).toContain("Promoting");
    expect(signals).not.toContain("Randomness");

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
    expect(modulesJsx.indexOf("SignalsConfigClient")).toBeGreaterThan(
      modulesJsx.indexOf("GeneralConfigClient"),
    );
    expect(modulesJsx).not.toContain("NameConfigClient");
    expect(modulesJsx).not.toContain("MapConfigClient");
    expect(modulesJsx).not.toContain("FavsConfigCard");
  });
});
