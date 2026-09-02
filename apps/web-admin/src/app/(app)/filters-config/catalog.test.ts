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
  DISCOVERY_MODE_KEYS,
  DISCOVERY_MODE_SOURCES,
  DISCOVERY_SOURCES,
  LIBRARY_SIGNALS,
  SIGNALS,
  SIGNAL_KEYS,
  modeCallsSource,
  modeRequiresPool,
  modeSignalState,
  snapMapReloadPair,
} from "./catalog";

describe("Discovery function APIs", () => {
  it("every signal is a stored-index function — no vendor API at rank time", () => {
    expect(SIGNALS.map((s) => [s.key, s.apis]).sort()).toEqual(
      [
        ["name", []],
        ["summary", []],
        ["category", []],
        ["proximity", []],
        ["timing", []],
        ["mesita_level", []],
        ["popularity", []],
        ["randomness", []],
      ].sort(),
    );
  });

  it("only maxKm and closedFloor are extra operator knobs", () => {
    expect(
      SIGNALS.flatMap((s) => s.fields.map((f) => `${s.key}.${f.key}`)),
    ).toEqual(["proximity.maxKm", "timing.closedFloor"]);
  });

  it("library order is section 8.3 — asked-for, then world, then us, then the tie-break", () => {
    expect(LIBRARY_SIGNALS.map((row) => row.key)).toEqual([
      "name",
      "summary",
      "category",
      "proximity",
      "timing",
      "mesita_level",
      "popularity",
      "randomness",
    ]);
    // The blend is a product of s^w, so the table order cannot move a score.
    expect([...SIGNAL_KEYS]).toEqual(LIBRARY_SIGNALS.map((row) => row.key));
    expect(SIGNAL_KEYS).not.toContain("promoting");
    expect(SIGNAL_KEYS).not.toContain("semantic");
    expect(SIGNAL_KEYS).toContain("mesita_level");
    // Never bare `level` — `places.price_level` owns that word on a place.
    expect(SIGNAL_KEYS).not.toContain("level");
    expect(SIGNAL_KEYS).toContain("randomness");
    expect(SIGNAL_KEYS).toContain("name");
    expect(SIGNAL_KEYS).toContain("summary");
    // Merged into mesita_level; Social left the library (MESITA-1408).
    expect(SIGNAL_KEYS).not.toContain("partnership");
    expect(SIGNAL_KEYS).not.toContain("promotion");
    expect(SIGNAL_KEYS).not.toContain("social");
  });

  it("coerceConfig folds old semantic weight and params onto summary", () => {
    const cfg = coerceConfig({
      weights: { semantic: 2, proximity: 1.5 },
      params: { semantic: { unembedded: 0.2 } },
    });
    expect(cfg.weights.summary).toBe(2);
    expect(cfg.weights.name).toBe(1);
    expect(cfg.weights.mesita_level).toBe(1);
    expect(cfg.params.summary.unembedded).toBe(0.2);
    expect(cfg.weights).not.toHaveProperty("semantic");
  });

  it("nine sources and a locked mode → source matrix", () => {
    expect([...DISCOVERY_MODE_KEYS]).toEqual([
      "word",
      "map",
      "catalog",
      "swipe",
      "chat",
      "favorites",
    ]);
    expect([...DISCOVERY_SOURCES]).toEqual([
      "Google Places Autocomplete Search",
      "Google Places Text Search",
      "Google Places Nearby Search",
      "Mesita Places Name Search",
      "Mesita Places Nearby Search",
      "Mesita Places Browse Search",
      "Mesita Places Flexible Search",
      "Mesita Social Browse Search",
      "Mesita Social Flexible Search",
    ]);
    expect(DISCOVERY_MODE_SOURCES.word).toEqual([
      "Google Places Autocomplete Search",
      "Google Places Text Search",
      "Mesita Places Name Search",
    ]);
    expect(DISCOVERY_MODE_SOURCES.map).toEqual([
      "Google Places Nearby Search",
      "Mesita Places Nearby Search",
    ]);
    expect(DISCOVERY_MODE_SOURCES.catalog).toEqual([
      "Mesita Places Browse Search",
      "Mesita Social Browse Search",
    ]);
    expect(DISCOVERY_MODE_SOURCES.swipe).toEqual(["Mesita Places Flexible Search"]);
    expect(DISCOVERY_MODE_SOURCES.chat).toEqual([
      "Google Places Text Search",
      "Google Places Nearby Search",
      "Mesita Places Flexible Search",
      "Mesita Social Flexible Search",
    ]);
    expect(DISCOVERY_MODE_SOURCES.favorites).toEqual([]);
    // The pin biases Autocomplete and Text Search; a bias is not a call.
    expect(modeCallsSource("word", "Google Places Nearby Search")).toBe(false);
    // Perplexity was on the old module list twice and is not retrieval we do.
    expect(DISCOVERY_SOURCES.some((s) => s.includes("Perplexity"))).toBe(false);
    // A Source nothing calls is not a Source.
    for (const source of DISCOVERY_SOURCES) {
      expect(
        DISCOVERY_MODE_KEYS.some((mode) => modeCallsSource(mode, source)),
        source,
      ).toBe(true);
    }
  });

  it("pool mask is Google Places + Listed on Catalog · Swipe; Favorites requires Google Places", () => {
    expect(modeRequiresPool("swipe", "google")).toBe(true);
    expect(modeRequiresPool("swipe", "listed")).toBe(true);
    expect(modeRequiresPool("favorites", "google")).toBe(true);
    expect(modeRequiresPool("favorites", "listed")).toBe(false);
    expect(modeRequiresPool("favorites", "enriched")).toBe(false);
    expect(modeRequiresPool("catalog", "listed")).toBe(true);
    expect(modeRequiresPool("word", "listed")).toBe(false);
    expect(modeRequiresPool("chat", "google")).toBe(false);
    expect(modeRequiresPool("map", "enriched")).toBe(false);
    expect(modeRequiresPool("swipe", "enriched")).toBe(false);
  });

  it("signals light Word Name, Chat Summary, Map without Randomness", () => {
    expect(modeSignalState("word", "name")).toBe("on");
    expect(modeSignalState("word", "summary")).toBe("off");
    expect(modeSignalState("chat", "summary")).toBe("on");
    expect(modeSignalState("chat", "randomness")).toBe("off");
    expect(modeSignalState("map", "proximity")).toBe("on");
    expect(modeSignalState("map", "randomness")).toBe("zero");
    expect(modeSignalState("swipe", "randomness")).toBe("on");
    expect(modeSignalState("catalog", "mesita_level")).toBe("on");
    expect(modeSignalState("map", "mesita_level")).toBe("on");
    expect(modeSignalState("swipe", "mesita_level")).toBe("on");
    expect(modeSignalState("chat", "mesita_level")).toBe("on");
    expect(modeSignalState("word", "mesita_level")).toBe("off");
    expect(modeSignalState("favorites", "proximity")).toBe("off");
    expect(
      SIGNAL_KEYS.every((key) => modeSignalState("favorites", key) === "off"),
    ).toBe(true);
  });

  it("map() is closest N of the selected Places set", () => {
    const map = ENGINES.find((e) => e.key === "map");
    expect(map?.state).toBe("LIVE");
    expect(map?.apis).toEqual(["Google Places Nearby Search"]);
    expect(map?.input).toMatch(/guest pin/i);
    expect(map?.process).toMatch(/Partners/);
    expect(map?.process).toMatch(/Mesita/);
    expect(map?.process).toMatch(/Google/);
    expect(map?.process).toMatch(/paints/);
    expect(map?.process).toMatch(/reload pair/);
    expect(map?.process).not.toMatch(/Concat/);
    expect(map?.process).not.toMatch(/ignoring Mesita membership/);
    expect(map?.process).not.toMatch(/Union 20/);
    expect(map?.process).not.toMatch(/never stub/);
    expect(map?.process).not.toMatch(/Nearest 50/);
    expect(map?.process).not.toMatch(/under 10/);
  });

  it("coerceConfig drops every map set cap — how many is the guest's question", () => {
    // Asked ONCE, on the consumer Filters sheet (Pato, 2026-08-29). A
    // legacy blob carrying the retired knobs must not resurrect them.
    const legacy = coerceConfig({
      map: { partnerCount: 99, notPartnerCount: 7, mesitaCount: 10, googleCount: 20 },
    }).map;
    for (const dead of [
      "partnerCount",
      "notPartnerCount",
      "mesitaCount",
      "googleCount",
    ]) {
      expect(dead in legacy).toBe(false);
    }
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
    expect(name?.process).toMatch(/other Lineup signals/);
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
    expect(swipe?.process).toMatch(/Places Lineup/);
    expect(swipe?.process).toMatch(/Swipe mask/);
    expect(swipe?.process).not.toMatch(/slot bought/);
    expect(swipe?.process).not.toMatch(/two-signal/);
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
  it("is two subpages — Discovery Modes and Discovery Sources", () => {
    const page = readFileSync(join(__dirname, "page.tsx"), "utf8");
    const layout = readFileSync(join(__dirname, "layout.tsx"), "utf8");
    const nav = readFileSync(join(__dirname, "nav.ts"), "utf8");
    const modesPage = readFileSync(join(__dirname, "modes/page.tsx"), "utf8");
    const sourcesPage = readFileSync(join(__dirname, "sources/page.tsx"), "utf8");
    const surfaces = readFileSync(join(__dirname, "DiscoverySurfaceCards.tsx"), "utf8");
    const swipe = readFileSync(join(__dirname, "SwipeConfigClient.tsx"), "utf8");
    const name = readFileSync(join(__dirname, "NameConfigClient.tsx"), "utf8");
    const general = readFileSync(join(__dirname, "GeneralConfigClient.tsx"), "utf8");
    const catalog = readFileSync(join(__dirname, "CatalogConfigClient.tsx"), "utf8");
    const chat = readFileSync(join(__dirname, "DiscoveryConfigClient.tsx"), "utf8");
    const map = readFileSync(join(__dirname, "MapConfigClient.tsx"), "utf8");
    const signals = readFileSync(join(__dirname, "SignalsConfigClient.tsx"), "utf8");
    const googleSources = readFileSync(join(__dirname, "GoogleSourceCards.tsx"), "utf8");
    const mesitaSources = readFileSync(join(__dirname, "MesitaSourceCards.tsx"), "utf8");
    const chips = readFileSync(join(__dirname, "ModeSourceChips.tsx"), "utf8");
    const nextConfig = readFileSync(
      join(__dirname, "../../../../next.config.ts"),
      "utf8",
    );

    expect(nav).toContain('label: "Discovery Modes"');
    expect(nav).toContain('label: "Discovery Sources"');
    expect(nav).toContain('"/filters-config/modes"');
    expect(nav).toContain('"/filters-config/sources"');
    expect(nav).not.toContain("modules");
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
    // The retired subpage keeps an operator's bookmark alive.
    expect(nextConfig).toContain('source: "/filters-config/modules"');
    expect(nextConfig).toContain('destination: "/filters-config/sources"');

    expect(general).toContain('title="Google types"');
    expect(general).toContain("NEARBY_TYPE_FIELDS");

    const gate = readFileSync(join(__dirname, "GeneralGateConfigClient.tsx"), "utf8");
    expect(gate).toContain('title="General"');
    expect(gate).toContain("Only active places");
    expect(gate).toContain("Minimum Google reviews");
    // The wipe is Discovery-wide, so it must not grow type batteries or a
    // per-mode cap — those belong to Sources and to each mode's own box.
    expect(gate).not.toContain("NEARBY_TYPE_FIELDS");
    expect(gate).not.toContain("categoryCount");
    expect(general).toContain('["general", "nameFast", "nameDeep", "map"]');
    // Word is ONE mode with two passes. The blob slices keep their names.
    expect(name).toContain('title="Word (Fast Search)"');
    expect(name).toContain('title="Word (Deep Search)"');
    expect(name).not.toContain('title="Name (Fast Search)"');
    expect(name).not.toContain('title="Name (Deep Search)"');
    expect(name).toContain("Google Places Autocomplete only");
    expect(name).toContain("Name signal only");
    expect(name).toContain("places.name");
    expect(name).toContain("google_name");
    expect(name).toContain("Word never calls Nearby Search");
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
    expect(name).toContain("same cap");
    expect(name).not.toContain("Deep symmetry");
    const deepKnobs = name.slice(name.indexOf('title="Word (Deep Search)"'));
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
    expect(map).not.toContain("Then concat. Closest Partners");
    // No count knob on Map — the guest's How many is the only cap.
    expect(map).not.toContain("QueryConcatCaps");
    expect(map).not.toContain("MAP_SET_COUNT_MAX");
    expect(map).not.toContain("MAP_GOOGLE_COUNT_MAX");
    expect(map).toContain("THE MAX NUMBER IS ASKED ONCE, ON THE CONSUMER");
    expect(map).toContain("Mesita Places means created AND enriched");
    expect(map).not.toContain("LaneMergeFunnel");
    expect(map).not.toContain("cascadeLaneCounts");
    expect(map).toContain("Closest N of the selected set");
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
    expect(surfaces).toContain('title="Favorites is coming soon"');
    expect(surfaces).toContain("ConfigSoon");
    expect(surfaces).not.toContain('title="Favs"');
    expect(surfaces).not.toContain('title="Name"');
    expect(surfaces).not.toContain('title="Swipe"');
    // Social left the mode list; it has no box of its own any more.
    expect(() => readFileSync(join(__dirname, "SocialConfigClient.tsx"))).toThrow();
    expect(signals).toContain('title="Mesita Places Search Signals"');
    expect(signals).toContain("LIBRARY_SIGNALS");
    expect(signals).not.toContain("Promoting");
    expect(signals).toContain("randomness");
    expect(signals).toContain("mesita_level");
    expect(signals).toContain("modeSignalState");
    expect(signals).toContain('kind="enforced"');
    expect(signals).toContain("Swipe read the mode mask");
    expect(signals).not.toContain("Swipe keeps its own sum");
    expect(googleSources).toContain("Google Places Autocomplete Search");
    expect(googleSources).toContain("Google Places Nearby Search");
    expect(googleSources).toContain("Google Places Text Search");
    expect(googleSources).toContain("Word (Deep Search)");
    expect(googleSources).toContain("Word does not");
    expect(mesitaSources).toContain("Mesita Places Name Search");
    expect(mesitaSources).toContain("Mesita Places Nearby Search");
    expect(mesitaSources).toContain("Mesita Places Browse Search");
    expect(mesitaSources).toContain("Mesita Places Flexible Search");
    expect(mesitaSources).toContain("Mesita Social Browse Search");
    expect(mesitaSources).toContain("Mesita Social Flexible Search");
    // Name and Nearby ship today without knobs of their own; the other four
    // have no engine, so they are the only Soon boxes on this strip.
    expect(mesitaSources.match(/ConfigSoon\n/g)?.length).toBe(4);
    expect(chips).toContain("export function ModeSourceChips");
    expect(chips).toContain("None");
    expect(modesPage).toContain("DiscoveryMatrix");
    const matrix = readFileSync(join(__dirname, "DiscoveryMatrix.tsx"), "utf8");
    expect(matrix).toContain("Places Types");
    expect(matrix).toContain("Search Sources");
    expect(matrix).toContain("Mesita Places Search Signals");
    expect(matrix).not.toContain("Search Modules");
    // The band title carries the class noun; a row never repeats it.
    expect(matrix).not.toContain("Places Lineup {label}");
    expect(matrix).toContain("BandRule");
    expect(matrix).toContain("modeSignalState");
    expect(matrix).not.toContain("zero=");
    expect(matrix).not.toContain("Map Randomness is 0");
    const flags = readFileSync(join(__dirname, "DiscoveryFlags.tsx"), "utf8");
    expect(flags).not.toContain("zero");
    expect(matrix).not.toContain(">0</span>");
    expect(name).toContain("ModeSourceChips");
    expect(name).not.toContain("TypeBatteries");
    expect(name).not.toContain("Google categories");
    expect(map).toContain("ModeSourceChips");
    expect(map).not.toContain("Google categories");
    expect(swipe).toContain("ModeSourceChips");

    const modesJsx = modesPage.slice(modesPage.indexOf("return ("));
    const sourcesJsx = sourcesPage.slice(sourcesPage.indexOf("return ("));
    // General is the post-Google wipe: below the matrix, above Fast Search
    // (Pato, 2026-08-29). It runs last but reads first. The mode cards then
    // run in section 8.1 order.
    const modeOrder = [
      "DiscoveryMatrix",
      "GeneralGateConfigClient",
      "NameConfigClient",
      "MapConfigClient",
      "CatalogConfigClient",
      "SwipeConfigClient",
      "DiscoveryConfigClient",
      "FavsConfigCard",
    ];
    let last = -1;
    for (const n of modeOrder) {
      const idx = modesJsx.indexOf(n);
      expect(idx, n).toBeGreaterThan(last);
      last = idx;
    }
    expect(modesJsx).not.toContain("SocialConfigClient");
    // Google types stay on Sources; the wipe stays on Modes. Two boxes,
    // two questions — never fold one into the other.
    expect(modesJsx).not.toContain("GeneralConfigClient");
    expect(sourcesJsx).not.toContain("GeneralGateConfigClient");
    expect(modesJsx).not.toContain("SignalsConfigClient");
    expect(modesJsx).not.toContain("ConfigSoon");

    const sourceOrder = [
      "GeneralConfigClient",
      "GoogleSourceCards",
      "MesitaSourceCards",
      "SignalsConfigClient",
    ];
    let lastSource = -1;
    for (const n of sourceOrder) {
      const idx = sourcesJsx.indexOf(n);
      expect(idx, n).toBeGreaterThan(lastSource);
      lastSource = idx;
    }
    // Perplexity is a Chat connection, never a Source box.
    expect(sourcesJsx).not.toContain("Perplexity");
    expect(sourcesPage).not.toContain("Perplexity");
    expect(sourcesJsx).not.toContain("NameConfigClient");
    expect(sourcesJsx).not.toContain("MapConfigClient");
    expect(sourcesJsx).not.toContain("FavsConfigCard");
    expect(sourcesJsx).not.toContain('title="General"');
    expect(sourcesJsx).not.toContain('title="Signals"');
  });
});
