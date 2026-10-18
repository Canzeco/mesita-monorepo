import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  coerceConfig,
  DEFAULT_CATALOG,
  DEFAULT_CONFIG,
  DEFAULT_GENERAL,
  DEFAULT_MAP,
  DEFAULT_NAME,
  DEFAULT_SWIPE,
  DISCOVERY_ENTITIES,
  DISCOVERY_MODE_KEYS,
  DISCOVERY_MODE_SOURCES,
  DISCOVERY_POOLS,
  DISCOVERY_SOURCES,
  DISCOVERY_SOURCES_NO_CALLER,
  GOOGLE_PULL_STOPS,
  modeCallsSource,
  modeRequiresPool,
  modeReturnsEntity,
  modeSignalState,
  resetLegacySignalWarnings,
  SUPER_FIELDS,
  SIGNAL_KEYS,
  SIGNAL_WEIGHT_MAX,
  SIGNALS,
  snapMapReloadPair,
  WEIGHT_MAX,
  WEIGHT_MIN,
  WEIGHTED_MODE_KEYS,
  weightMaxFor,
} from "./catalog";

describe("Discovery function APIs", () => {
  it("only maxKm and closedFloor are extra operator knobs", () => {
    expect(
      SIGNALS.flatMap((s) => s.fields.map((f) => `${s.key}.${f.key}`)),
    ).toEqual(["proximity.maxKm", "timing.closedFloor"]);
  });

  it("library order is section 8.3 — asked-for, then world, then us, then the tie-break", () => {
    // The blend is a product of s^w, so the table order cannot move a score.
    expect([...SIGNAL_KEYS]).toEqual([
      "name",
      "category",
      "proximity",
      "timing",
      "enriched",
      "popularity",
      "randomness",
    ]);
  });

  it("only Map and Scroll earn a weight column", () => {
    // A mode earns one when it has a live weightsForMode caller AND a mask
    // over one signal. Word satisfies the first and fails the second — a
    // one-factor Π s^w is a monotone transform, so its exponent provably
    // cannot reorder. The EF twin's contract test asserts both halves; this
    // side just has to agree with it, because the keys are PERSISTED.
    expect([...WEIGHTED_MODE_KEYS]).toEqual(["map", "swipe"]);
    for (const mode of WEIGHTED_MODE_KEYS) {
      expect(DISCOVERY_MODE_KEYS).toContain(mode);
    }
  });

  it("a per-mode column round-trips, clamps, and seeds from the blob's own vector", () => {
    const tuned = coerceConfig({
      weightsByMode: { map: { proximity: 2, enriched: 4 } },
    });
    expect(tuned.weightsByMode.map.proximity).toBe(2);
    // Enriched caps at 2, not the uniform 4, on every mode.
    expect(tuned.weightsByMode.map.enriched).toBe(2);
    expect(tuned.weightsByMode.swipe).toEqual(DEFAULT_CONFIG.weights);

    // THE MIGRATION. The live blob has hand-tuned GLOBAL exponents and no
    // per-mode bag at all. Seeding a missing column from DEFAULT_CONFIG would
    // revert every one of them the first time this page loaded, silently.
    const legacy = coerceConfig({ weights: { proximity: 1.5 } });
    for (const mode of WEIGHTED_MODE_KEYS) {
      expect(legacy.weightsByMode[mode], mode).toEqual(legacy.weights);
      expect(legacy.weightsByMode[mode].proximity, mode).toBe(1.5);
    }
    // Two decimals, or the 0.05-step field leaves the page permanently dirty.
    expect(
      coerceConfig({ weightsByMode: { swipe: { timing: 1.7000000000000002 } } })
        .weightsByMode.swipe.timing,
    ).toBe(1.7);
    // Below the floor clamps up, not to NaN — a non-finite exponent would
    // turn the WHOLE signal off in the blend, scoring every place exactly 1.
    expect(
      coerceConfig({ weightsByMode: { swipe: { timing: -3, category: "x" } } })
        .weightsByMode.swipe,
    ).toMatchObject({ timing: WEIGHT_MIN, category: DEFAULT_CONFIG.weights.category });
    // A mode nothing ranks is not stored at all.
    expect(
      Object.keys(coerceConfig({ weightsByMode: { word: { name: 3 } } }).weightsByMode).sort(),
    ).toEqual([...WEIGHTED_MODE_KEYS].sort());
  });

  it("seven sources and a locked mode → source matrix", () => {
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
      "Mesita Places Catalog Search",
      "Mesita Social Catalog Search",
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
    // The Feed buys Google Nearby for rail 1 (Google Places) and reads the
    // Mesita Nearby pool for its Mesita Selected and family rails when the
    // guest shares a location, the catalog otherwise (MESITA-2298 §7).
    // Browse and Flexible are gone (MESITA-2195): Places Catalog is for
    // places, Social Catalog for events.
    expect(DISCOVERY_MODE_SOURCES.catalog).toEqual([
      "Google Places Nearby Search",
      "Mesita Places Nearby Search",
      "Mesita Places Catalog Search",
    ]);
    expect(DISCOVERY_MODE_SOURCES.swipe).toEqual(["Mesita Places Catalog Search"]);
    expect(DISCOVERY_MODE_SOURCES.chat).toEqual([]);
    expect(DISCOVERY_MODE_SOURCES.favorites).toEqual([]);
    // The pin biases Autocomplete and Text Search; a bias is not a call.
    expect(modeCallsSource("word", "Google Places Nearby Search")).toBe(false);
    // Perplexity was on the old module list twice and is not retrieval we do.
    expect(DISCOVERY_SOURCES.some((s) => s.includes("Perplexity"))).toBe(false);
    // A Source has a caller, or it is NAMED as one that has none. An empty
    // row is allowed; an empty row nobody declared is a mode list that lost
    // a source by accident.
    expect([...DISCOVERY_SOURCES_NO_CALLER]).toEqual([
      "Mesita Social Catalog Search",
    ]);
    for (const source of DISCOVERY_SOURCES) {
      const called = DISCOVERY_MODE_KEYS.some((mode) =>
        modeCallsSource(mode, source),
      );
      const declaredCallerless = (
        DISCOVERY_SOURCES_NO_CALLER as readonly string[]
      ).includes(source);
      expect(called, source).toBe(!declaredCallerless);
    }
    for (const source of DISCOVERY_SOURCES_NO_CALLER) {
      expect(
        (DISCOVERY_SOURCES as readonly string[]).includes(source),
        source,
      ).toBe(true);
    }
  });

  // DISCOVERY_MODE_SOURCES is `as const` with no type annotation, so a mode
  // list may name a string that is in no source list and still compile — the
  // mode would just call nothing. The test above walks sources → modes; this
  // one walks modes → sources, which is the direction the Socials rename
  // could have broken silently (MESITA-1856).
  it("no mode names a source that does not exist", () => {
    for (const mode of DISCOVERY_MODE_KEYS) {
      for (const source of DISCOVERY_MODE_SOURCES[mode] as readonly string[]) {
        expect(
          (DISCOVERY_SOURCES as readonly string[]).includes(source),
          `${mode} → ${source}`,
        ).toBe(true);
      }
    }
  });

  // The three bands live only in discovery-matrix.ts, so these literals are
  // their one pin.
  it("result entities are Locations · Places · Socials, in that order", () => {
    expect(DISCOVERY_ENTITIES.map((e) => e.key)).toEqual([
      "location",
      "place",
      "social",
    ]);
    expect(DISCOVERY_ENTITIES.map((e) => e.label)).toEqual([
      "Locations",
      "Places",
      "Socials",
    ]);
    for (const mode of DISCOVERY_MODE_KEYS) {
      expect(modeReturnsEntity(mode, "place"), mode).toBe(mode !== "chat");
      expect(modeReturnsEntity(mode, "location"), mode).toBe(
        modeCallsSource(mode, "Google Places Autocomplete Search"),
      );
      // An entity comes from a source: the modes that answer with a Social
      // are exactly the modes that call Social Catalog. It stays Soon until
      // an events engine exists.
      expect(modeReturnsEntity(mode, "social"), mode).toBe(
        modeCallsSource(mode, "Mesita Social Catalog Search"),
      );
    }
    expect(modeReturnsEntity("catalog", "social")).toBe(false);
    expect(modeReturnsEntity("chat", "social")).toBe(false);
    expect(modeReturnsEntity("map", "social")).toBe(false);
  });

  it("two guest scopes: Google Places and Mesita Selected", () => {
    // The band IS `PlacesScope = "google" | "selected"` from nearby-places.ts
    // (MESITA-2298). The middle ring (Mesita Places) and the word Enriched
    // are the code's, never a scope a guest picks: a Created row rides inside
    // Google Places as a painted hit, the gray pin.
    expect(DISCOVERY_POOLS.map((p) => p.key)).toEqual(["google", "selected"]);
    expect(DISCOVERY_POOLS.map((p) => p.label)).toEqual([
      "Google Places",
      "Mesita Selected",
    ]);
    for (const pool of DISCOVERY_POOLS) {
      expect(pool.label, pool.key).not.toMatch(/Enriched/);
    }
    // Map is the one mode whose GUEST picks the scope; the Feed serves both
    // (rail 1 Google Places, rail 2 Mesita Selected, then the families).
    expect(modeRequiresPool("map", "google")).toBe(true);
    expect(modeRequiresPool("map", "selected")).toBe(true);
    expect(modeRequiresPool("catalog", "google")).toBe(true);
    expect(modeRequiresPool("catalog", "selected")).toBe(true);
    // Scroll hardcodes requireReady, which IS the Selected gate
    // (`enriched_at IS NOT NULL` AND `content_state = 'ready'`, MESITA-2154).
    expect(modeRequiresPool("swipe", "selected")).toBe(true);
    expect(modeRequiresPool("swipe", "google")).toBe(false);
    // A bookmark is always a Google-sourced place, and it is NOT gated on
    // enrichment: Created profiles get bookmarked too.
    expect(modeRequiresPool("favorites", "google")).toBe(true);
    expect(modeRequiresPool("favorites", "selected")).toBe(false);
    // Word and Chat answer from whatever came back; no scope gate at all.
    for (const pool of DISCOVERY_POOLS) {
      expect(modeRequiresPool("word", pool.key), pool.key).toBe(false);
      expect(modeRequiresPool("chat", pool.key), pool.key).toBe(false);
    }
    // No row is dead: every scope is required by at least one mode.
    for (const pool of DISCOVERY_POOLS) {
      expect(
        DISCOVERY_MODE_KEYS.some((mode) => modeRequiresPool(mode, pool.key)),
        pool.key,
      ).toBe(true);
    }
  });

  it("signals light Word Name, Chat Name, Map without Randomness", () => {
    expect(modeSignalState("word", "name")).toBe("on");
    expect(modeSignalState("chat", "name")).toBe("on");
    expect(modeSignalState("chat", "randomness")).toBe("off");
    expect(modeSignalState("map", "proximity")).toBe("on");
    expect(modeSignalState("map", "randomness")).toBe("zero");
    expect(modeSignalState("swipe", "randomness")).toBe("on");
    // Every mode Level was on for reads Enriched, and no mode gains it.
    expect(modeSignalState("catalog", "enriched")).toBe("on");
    expect(modeSignalState("map", "enriched")).toBe("on");
    expect(modeSignalState("swipe", "enriched")).toBe("on");
    expect(modeSignalState("chat", "enriched")).toBe("on");
    expect(modeSignalState("word", "enriched")).toBe("off");
    expect(modeSignalState("favorites", "proximity")).toBe("off");
    expect(
      SIGNAL_KEYS.every((key) => modeSignalState("favorites", key) === "off"),
    ).toBe(true);
  });

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

  it("coerceConfig drops the retired param bags and Name's unembedded (MESITA-2144)", () => {
    // What the live blob still stores under `params`. A bag this page keeps
    // is a bag the next whole-blob Save writes back over the strip migration.
    const cfg = coerceConfig({
      params: {
        summary: { unembedded: 0.4 },
        name: { unembedded: 0.4 },
        mesita_level: {},
        proximity: { maxKm: 30 },
      },
    });
    expect(cfg.params).not.toHaveProperty("summary");
    expect(cfg.params).not.toHaveProperty("mesita_level");
    expect(cfg.params.name).toEqual({});
    expect(Object.keys(cfg.params).sort()).toEqual([...SIGNAL_KEYS].sort());
    expect(cfg.params.proximity.maxKm).toBe(30);
  });

  it("coerceConfig defaults swipe on an old blob and clamps knobs", () => {
    expect(coerceConfig({ weights: {}, slotting: {} }).swipe).toEqual(DEFAULT_SWIPE);
    expect(
      coerceConfig({
        swipe: { radiusKm: 99, minReviews: -2, closingBufferMin: 999 },
      }).swipe,
    ).toMatchObject({
      radiusKm: 50,
      minReviews: 0,
      closingBufferMin: 180,
    });
  });

  it("the category param is fifteen families", () => {
    expect(coerceConfig({ weights: {}, slotting: {} }).general).toEqual(DEFAULT_GENERAL);
    expect(SUPER_FIELDS.length).toBe(15);
    expect(new Set(SUPER_FIELDS.map((f) => f.key)).size).toBe(15);
    for (const f of SUPER_FIELDS) expect(f.battery.length, f.key).toBeGreaterThan(0);
    const on = SUPER_FIELDS.filter((f) => DEFAULT_MAP.supers[f.key]).map((f) => f.key);
    expect(new Set(on)).toEqual(
      new Set(["coffee", "dinner", "sweet", "drinks", "night_out"]),
    );
    expect(
      new Set(SUPER_FIELDS.filter((f) => on.includes(f.key)).flatMap((f) => f.battery)),
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
  it("is two subpages — Modes, then Signals (MESITA-2303)", () => {
    const page = readFileSync(join(__dirname, "page.tsx"), "utf8");
    const layout = readFileSync(join(__dirname, "layout.tsx"), "utf8");
    const nav = readFileSync(join(__dirname, "nav.ts"), "utf8");
    const nextConfig = readFileSync(
      join(__dirname, "../../../../next.config.ts"),
      "utf8",
    );
    const modesAt = nav.indexOf('label: "Modes"');
    const signalsAt = nav.indexOf('label: "Signals"');
    expect(modesAt).toBeGreaterThan(-1);
    expect(modesAt).toBeLessThan(signalsAt);
    for (const gone of ['label: "Sources"', 'label: "Matrix"', 'label: "Catalog"']) {
      expect(nav).not.toContain(gone);
    }
    expect(nav).toContain("/filters-config/modes#s-map");
    expect(nav).toContain('"/filters-config/modes#s-catalog"');
    expect(layout).toContain("DiscoveryChrome");
    expect(layout).toContain("DiscoveryPanels");
    expect(layout).not.toContain("SearchSourcesView");
    expect(layout).not.toContain("DiscoveryMatrixView");
    expect(page).toContain("redirect(DISCOVERY_TABS[0].href)");
    // Every retired subpage keeps an operator's bookmark alive, one hop.
    for (const old of ["sources", "matrix", "modules", "catalog", "chat"]) {
      expect(nextConfig).toContain(`source: "/filters-config/${old}"`);
    }
    expect(nextConfig).not.toContain('destination: "/filters-config/sources"');
    expect(nextConfig).not.toContain('destination: "/filters-config/matrix"');
  });
});

// ── MESITA-1858: the cap and the deploy window ─────────────────────────────

describe("Mesita Level is Enriched", () => {
  it("carries the Enriched cap BY NAME, in a map that is never empty", () => {
    // A loop over an empty map asserts nothing, so the cap is pinned by name.
    expect(Object.keys(SIGNAL_WEIGHT_MAX).length).toBeGreaterThan(0);
    expect(weightMaxFor("enriched")).toBe(2);
    expect(weightMaxFor("proximity")).toBe(WEIGHT_MAX);
  });

  it("clamps a console write above the cap instead of accepting it", () => {
    const cfg = coerceConfig({ weights: { enriched: 4, proximity: 4 } });
    expect(cfg.weights.enriched).toBe(2);
    expect(cfg.weights.proximity).toBe(4);
  });

  it("every Record<SignalKey, …> map on this page has full key coverage", () => {
    // A missing DEFAULT_SIGNAL_PARAMS entry on the EF side throws a TypeError
    // that `loadDiscoveryConfig` swallows, returning DISCOVERY_DEFAULTS for
    // the whole config on every request. Same shape of hazard here.
    const expected = [...SIGNAL_KEYS].sort();
    expect(Object.keys(DEFAULT_CONFIG.weights).sort()).toEqual(expected);
    expect(Object.keys(DEFAULT_CONFIG.params).sort()).toEqual(expected);
    expect(SIGNALS.map((s) => s.key).sort()).toEqual(expected);
    // And the icon map the Signals page renders, read as source: a missing
    // key there is a card with no icon, not a type error, because ICONS is
    // declared Record<SignalKey, …> in a file this test cannot import.
    const client = readFileSync(join(__dirname, "SignalsConfigClient.tsx"), "utf8");
    const icons = client.slice(client.indexOf("const ICONS"));
    for (const key of SIGNAL_KEYS) {
      expect(icons.slice(0, icons.indexOf("};"))).toContain(`${key}:`);
    }
  });

  it("reads mesita_level as a deprecated alias, onto Enriched", () => {
    resetLegacySignalWarnings();
    const cfg = coerceConfig({ weights: { mesita_level: 2 } });
    expect(cfg.weights.enriched).toBe(2);
  });

  it("lets an explicitly-set new key win over the alias", () => {
    resetLegacySignalWarnings();
    const cfg = coerceConfig({
      weights: { mesita_level: 2, enriched: 1.25 },
    });
    expect(cfg.weights.enriched).toBe(1.25);
  });

  it("loads a blob that still carries partnered, slotting and partnerCount", () => {
    // The shape a blob saved before this signal list carries. The stored
    // `partnered` exponent stays on the global vector as inert storage (the
    // deploy window below); no rebuilt branch keeps it.
    resetLegacySignalWarnings();
    const original = console.warn;
    console.warn = () => {};
    let cfg: ReturnType<typeof coerceConfig>;
    try {
      cfg = coerceConfig({
        weights: { mesita_level: 2, partnered: 1.5, proximity: 1.25 },
        weightsByMode: { map: { partnered: 2, proximity: 0.5 } },
        params: { partnered: {} },
        slotting: { enabled: true, everyNth: 5 },
        name: { deep: { partnerCount: 3, mesitaCount: 4 } },
      });
    } finally {
      console.warn = original;
    }
    expect(cfg.weights.enriched).toBe(2);
    expect(cfg.weights).toHaveProperty("partnered", 1.5);
    expect(cfg.weightsByMode.map.proximity).toBe(0.5);
    expect(Object.keys(cfg.weightsByMode.map).sort()).toEqual([...SIGNAL_KEYS].sort());
    expect(Object.keys(cfg.params).sort()).toEqual([...SIGNAL_KEYS].sort());
    expect(cfg).not.toHaveProperty("slotting");
    expect(cfg.name.deep).not.toHaveProperty("partnerCount");
    expect(cfg.name.deep.mesitaCount).toBe(4);
  });

  it("PRESERVES an unknown weight key — the deploy-window mitigation", () => {
    // This page auto-deploys on merge; the Edge Functions deploy by hand. In
    // between, a whole-blob Save from here must not evict a key the EF side
    // is about to need. A rebuild-from-SIGNAL_KEYS would have done exactly
    // that, and the still-old EF would read a set 2 back as the default 1.
    resetLegacySignalWarnings();
    const cfg = coerceConfig({ weights: { mesita_level: 2, proximity: 1.5 } });
    expect(cfg.weights).toHaveProperty("mesita_level", 2);
    expect(cfg.weights.proximity).toBe(1.5);
  });

  it("survives an unrelated Save — save the Chat prompt, diff the weights", () => {
    // The literal failure: Vercel ships, the operator saves the Chat prompt,
    // and the save path is `weights: live.config.weights` where `live.config`
    // is a coerceConfig of whatever the EF returned. So a round-trip is what
    // a save does to the weights map.
    resetLegacySignalWarnings();
    const live = coerceConfig({
      weights: { mesita_level: 2, proximity: 1.5 },
      chat: { prompt: "before" },
    });
    const afterSave = coerceConfig({ ...live, chat: { prompt: "after" } });
    expect(afterSave.weights).toEqual(live.weights);
    expect(afterSave.weights).toHaveProperty("mesita_level", 2);
    expect(afterSave.chat.prompt).toBe("after");
  });

  it("logs ONCE, structured, when a legacy key is folded", () => {
    resetLegacySignalWarnings();
    const seen: unknown[][] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => void seen.push(args);
    try {
      coerceConfig({ weights: { mesita_level: 2 } });
      coerceConfig({ weights: { mesita_level: 2 } });
    } finally {
      console.warn = original;
    }
    expect(seen).toHaveLength(1);
    expect(seen[0][0]).toBe("[filters-config] legacy signal key");
    expect(seen[0][1]).toMatchObject({
      key: "mesita_level",
      value: 2,
      foldedTo: ["enriched"],
    });
  });
});
