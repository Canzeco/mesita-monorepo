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
  DEFAULT_SOCIAL,
  DEFAULT_SWIPE,
  DISCOVERY_ENTITIES,
  DISCOVERY_MODE_KEYS,
  DISCOVERY_MODE_SOURCES,
  DISCOVERY_POOLS,
  DISCOVERY_SOURCES,
  DISCOVERY_SOURCES_NO_CALLER,
  GOOGLE_PULL_STOPS,
  LIBRARY_SIGNALS,
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
import { ENGINES } from "./discovery-engines";

describe("Discovery function APIs", () => {
  it("every signal is a stored-index function — no vendor API at rank time", () => {
    expect(SIGNALS.map((s) => [s.key, s.apis]).sort()).toEqual(
      [
        ["name", []],
        ["summary", []],
        ["category", []],
        ["proximity", []],
        ["timing", []],
        ["enriched", []],
        ["partnered", []],
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
      "enriched",
      "partnered",
      "popularity",
      "randomness",
    ]);
    // The blend is a product of s^w, so the table order cannot move a score.
    expect([...SIGNAL_KEYS]).toEqual(LIBRARY_SIGNALS.map((row) => row.key));
    expect(SIGNAL_KEYS).not.toContain("promoting");
    expect(SIGNAL_KEYS).not.toContain("semantic");
    expect(SIGNAL_KEYS).toContain("enriched");
    expect(SIGNAL_KEYS).toContain("partnered");
    // Split into the two binaries (MESITA-1858). The key is PERSISTED, so
    // this is what says the rename completed on the console side too.
    expect(SIGNAL_KEYS).not.toContain("mesita_level");
    // Never bare `level` — `places.price_level` owns that word on a place.
    expect(SIGNAL_KEYS).not.toContain("level");
    // Never bare `partner` — that is the consumer wire boolean.
    expect(SIGNAL_KEYS).not.toContain("partner");
    expect(SIGNAL_KEYS).toContain("randomness");
    expect(SIGNAL_KEYS).toContain("name");
    expect(SIGNAL_KEYS).toContain("summary");
    // Merged away at MESITA-1408; Social left the library then too.
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
    expect(cfg.weights.enriched).toBe(1);
    expect(cfg.weights.partnered).toBe(1);
    expect(cfg.params.summary.unembedded).toBe(0.2);
    // The legacy key itself is PRESERVED now (MESITA-1858, the additive
    // window) — it is the fold that matters, not the deletion.
    expect(cfg.weights).toHaveProperty("semantic");
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
    expect(WEIGHTED_MODE_KEYS).not.toContain("word");
    expect(WEIGHTED_MODE_KEYS).not.toContain("catalog");
  });

  it("a per-mode column round-trips, clamps, and seeds from the blob's own vector", () => {
    const tuned = coerceConfig({
      weightsByMode: { map: { proximity: 2, partnered: 4 } },
    });
    expect(tuned.weightsByMode.map.proximity).toBe(2);
    // Partnered caps at 2, not the uniform 4, on every mode.
    expect(tuned.weightsByMode.map.partnered).toBe(2);
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
      "Mesita Socials Browse Search",
      "Mesita Socials Flexible Search",
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
    // Catalog is FLEXIBLE for Places since MESITA-1697 — Home's Feed grew a
    // filter control and consumer-web-list-catalog cuts its pool with the
    // guest's predicates before planning a rail. Socials rails stay Browse:
    // no predicate reaches them, and no events engine exists to take one.
    // "Mesita Places Browse Search" lost its only caller there and keeps its
    // row anyway (MESITA-1856) — the Sources page still renders its box, and
    // a matrix that reports one source fewer than the page is a worse map
    // than one empty row.
    expect(DISCOVERY_MODE_SOURCES.catalog).toEqual([
      "Mesita Places Flexible Search",
      "Mesita Socials Browse Search",
    ]);
    expect(DISCOVERY_MODE_SOURCES.swipe).toEqual(["Mesita Places Flexible Search"]);
    expect(DISCOVERY_MODE_SOURCES.chat).toEqual([
      "Google Places Text Search",
      "Google Places Nearby Search",
      "Mesita Places Flexible Search",
      "Mesita Socials Flexible Search",
    ]);
    expect(DISCOVERY_MODE_SOURCES.favorites).toEqual([]);
    // The pin biases Autocomplete and Text Search; a bias is not a call.
    expect(modeCallsSource("word", "Google Places Nearby Search")).toBe(false);
    // Perplexity was on the old module list twice and is not retrieval we do.
    expect(DISCOVERY_SOURCES.some((s) => s.includes("Perplexity"))).toBe(false);
    // A Source has a caller, or it is NAMED as one that has none. An empty
    // row is allowed; an empty row nobody declared is a mode list that lost
    // a source by accident.
    expect([...DISCOVERY_SOURCES_NO_CALLER]).toEqual([
      "Mesita Places Browse Search",
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

  // THE TWIN PINS ITSELF. supabase/.../discovery-matrix.ts holds the same
  // three bands and nothing imports across the two packages (Vercel's root is
  // apps/web-admin), so each side duplicates the literals and a one-sided
  // edit goes red on one side.
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
      expect(modeReturnsEntity(mode, "place"), mode).toBe(true);
      expect(modeReturnsEntity(mode, "location"), mode).toBe(
        modeCallsSource(mode, "Google Places Autocomplete Search"),
      );
      // An entity comes from a source: the modes that answer with a Social
      // are exactly the modes that call a Socials source. Both are Soon, so
      // the row is spec-only until an events engine exists.
      expect(modeReturnsEntity(mode, "social"), mode).toBe(
        modeCallsSource(mode, "Mesita Socials Browse Search") ||
          modeCallsSource(mode, "Mesita Socials Flexible Search"),
      );
    }
    expect(modeReturnsEntity("catalog", "social")).toBe(true);
    expect(modeReturnsEntity("chat", "social")).toBe(true);
    expect(modeReturnsEntity("map", "social")).toBe(false);
  });

  it("three nested place types: Map picks the ring, Feed and Scroll need enrichment", () => {
    // The band IS `Google Places ⊃ Mesita Enriched Places ⊃ Mesita Partner
    // Places` from nearby-places.ts, in that order. `listed` retired at
    // MESITA-1856: a row existing is not a gate any mode runs.
    expect(DISCOVERY_POOLS.map((p) => p.key)).toEqual([
      "google",
      "enriched",
      "partner",
    ]);
    expect(DISCOVERY_POOLS.map((p) => p.label)).toEqual([
      "Google Places",
      "Mesita Enriched Places",
      "Mesita Partnered Places",
    ]);
    expect(
      (DISCOVERY_POOLS as readonly { key: string }[]).some(
        (p) => p.key === "listed",
      ),
    ).toBe(false);
    // Map is the one mode whose GUEST picks the ring — PlacesScope is
    // exactly these three — and keepListedForScope refuses an unenriched row
    // before it reads the scope at all.
    expect(modeRequiresPool("map", "google")).toBe(true);
    expect(modeRequiresPool("map", "enriched")).toBe(true);
    expect(modeRequiresPool("map", "partner")).toBe(true);
    // requireReady defaults true and Scroll hardcodes it, and requireReady
    // IS the enrichment gate. Neither mode reaches for partners only.
    expect(modeRequiresPool("catalog", "google")).toBe(true);
    expect(modeRequiresPool("catalog", "enriched")).toBe(true);
    expect(modeRequiresPool("catalog", "partner")).toBe(false);
    expect(modeRequiresPool("swipe", "google")).toBe(true);
    expect(modeRequiresPool("swipe", "enriched")).toBe(true);
    expect(modeRequiresPool("swipe", "partner")).toBe(false);
    // A bookmark is always a Google-sourced place, and it is NOT gated on
    // enrichment: Create stubs get bookmarked too.
    expect(modeRequiresPool("favorites", "google")).toBe(true);
    expect(modeRequiresPool("favorites", "enriched")).toBe(false);
    expect(modeRequiresPool("favorites", "partner")).toBe(false);
    // Word and Chat answer from whatever came back; no ring gate at all.
    for (const pool of DISCOVERY_POOLS) {
      expect(modeRequiresPool("word", pool.key), pool.key).toBe(false);
      expect(modeRequiresPool("chat", pool.key), pool.key).toBe(false);
    }
    // No row is dead: every place type is required by at least one mode.
    for (const pool of DISCOVERY_POOLS) {
      expect(
        DISCOVERY_MODE_KEYS.some((mode) => modeRequiresPool(mode, pool.key)),
        pool.key,
      ).toBe(true);
    }
  });

  it("signals light Word Name, Chat Summary, Map without Randomness", () => {
    expect(modeSignalState("word", "name")).toBe("on");
    expect(modeSignalState("word", "summary")).toBe("off");
    expect(modeSignalState("chat", "summary")).toBe("on");
    expect(modeSignalState("chat", "randomness")).toBe("off");
    expect(modeSignalState("map", "proximity")).toBe("on");
    expect(modeSignalState("map", "randomness")).toBe("zero");
    expect(modeSignalState("swipe", "randomness")).toBe("on");
    // Splitting one on-signal into two is the identity transform: every mode
    // Level was on for gets both halves, and no mode gains one.
    expect(modeSignalState("catalog", "enriched")).toBe("on");
    expect(modeSignalState("map", "enriched")).toBe("on");
    expect(modeSignalState("swipe", "enriched")).toBe("on");
    expect(modeSignalState("chat", "enriched")).toBe("on");
    expect(modeSignalState("word", "enriched")).toBe("off");
    expect(modeSignalState("catalog", "partnered")).toBe("on");
    expect(modeSignalState("swipe", "partnered")).toBe("on");
    expect(modeSignalState("chat", "partnered")).toBe("on");
    expect(modeSignalState("word", "partnered")).toBe("off");
    expect(modeSignalState("favorites", "proximity")).toBe("off");
    expect(
      SIGNAL_KEYS.every((key) => modeSignalState("favorites", key) === "off"),
    ).toBe(true);
  });

  it("Map prices partnership by splitting lanes, not by an exponent", () => {
    // The EF's `reorderListedLanes` splits listed rows on `isMesitaPartnerRow`
    // BEFORE it blends, and blends each lane independently — so `partnered()`
    // is a constant factor inside a lane and `s^w` over a constant cannot move
    // a row. The cell is the labelled em-dash, not an input an operator can
    // save and watch change nothing.
    expect(modeSignalState("map", "partnered")).toBe("zero");
    // Scroll ranks one deck with no lane split: there the exponent is real.
    expect(modeSignalState("swipe", "partnered")).toBe("on");
  });

  it("map() is closest N of the selected Places set", () => {
    const map = ENGINES.find((e) => e.key === "map");
    expect(map?.state).toBe("LIVE");
    expect(map?.apis).toEqual(["Google Places Nearby Search"]);
    expect(map?.input).toMatch(/guest pin/i);
    // The three rings, and the gate that makes the chain a containment
    // rather than a drawing (Pato, 2026-09-05).
    expect(map?.process).toMatch(/Mesita Partner Places/);
    expect(map?.process).toMatch(/Mesita Enriched Places/);
    expect(map?.process).toMatch(/Google Places/);
    expect(map?.process).toMatch(/ENRICHMENT GATES EVERY MESITA RING/);
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
      supers: { ...DEFAULT_MAP.supers, restaurants: false },
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
        swipe: { radiusKm: 99, minReviews: -2, closingBufferMin: 999 },
      }).swipe,
    ).toMatchObject({
      radiusKm: 50,
      minReviews: 0,
      closingBufferMin: 180,
    });
  });

  it("the five retired swipe ranking knobs do not survive a coerce", () => {
    // MESITA-1859 DELETED them, it did not merely stop rendering them. A blob
    // still carrying `weightProximity: 0.7` beside a live per-mode Proximity
    // exponent forces the next reader to work out which one the deck obeys.
    const swipe = coerceConfig({
      swipe: {
        weightProximity: 0.7,
        starsExponent: 1.5,
        logDivisor: 10,
        partnerBias: { dominant: 2 },
        randomnessMax: 1.3,
      },
    }).swipe;
    for (
      const dead of [
        "weightProximity",
        "starsExponent",
        "logDivisor",
        "partnerBias",
        "randomnessMax",
      ]
    ) {
      expect(swipe, dead).not.toHaveProperty(dead);
    }
  });

  it("swipe() is LIVE — Home shipped, and the catalog entry says so", () => {
    // It read PARKED until MESITA-1859, on copy dated 2026-08-28. ScrollDeck
    // is live in web-consumer and consumer-web-recommend-swipe is called on
    // every load; a PARKED row under a live console card is the same
    // dishonesty the ConfigSoon header exists to prevent.
    const swipe = ENGINES.find((e) => e.key === "swipe");
    expect(swipe?.state).toBe("LIVE");
    expect(swipe?.process).not.toMatch(/Parked/i);
    expect(swipe?.process).not.toMatch(/Soon/);
    expect(swipe?.process).toMatch(/Places Lineup/);
    expect(swipe?.process).toMatch(/Scroll mask/);
    expect(swipe?.process).not.toMatch(/two-signal/);
  });

  it("the category param is seven families, and categoryCount is gone", () => {
    // MESITA-1695: the operator's noun is the family, not Google's slug, and
    // the ordered "first N" cap that hid four whole families is deleted. A
    // stored blob carrying it must not resurrect it.
    expect(coerceConfig({ weights: {}, slotting: {} }).general).toEqual(DEFAULT_GENERAL);
    expect("categoryCount" in DEFAULT_GENERAL).toBe(false);
    expect(
      "categoryCount" in coerceConfig({ general: { categoryCount: 5 } }).general,
    ).toBe(false);
    expect(SUPER_FIELDS.length).toBe(7);
    expect(new Set(SUPER_FIELDS.map((f) => f.key)).size).toBe(7);
    // Every family names the Google battery it bills, so the box can say what
    // it spends without asking anyone to toggle Google's vocabulary.
    for (const f of SUPER_FIELDS) expect(f.battery.length, f.key).toBeGreaterThan(0);
    // The three the strip has always billed are on; the four it could not see
    // until MESITA-1683 stay off until an operator opts in.
    const on = SUPER_FIELDS.filter((f) => DEFAULT_MAP.supers[f.key]).map((f) => f.key);
    expect(new Set(on)).toEqual(
      new Set(["restaurants", "cafes_bakeries", "bars_nightlife"]),
    );
    // Their union is the five slugs the pre-1695 blob had true.
    expect(
      new Set(SUPER_FIELDS.filter((f) => on.includes(f.key)).flatMap((f) => f.battery)),
    ).toEqual(new Set(["restaurant", "bar", "night_club", "cafe", "bakery"]));
  });

  it("coerceConfig folds a pre-1695 Google-slug blob up into families", () => {
    // THE LIVE BLOB: five slugs true, nothing else stored. It has to land on
    // exactly the three F&B families or the console shows a different answer
    // than the Edge Functions read.
    const folded = coerceConfig({
      map: {
        types: {
          restaurant: true,
          bar: true,
          night_club: true,
          cafe: true,
          bakery: true,
        },
      },
    }).map.supers;
    expect(folded).toEqual({
      restaurants: true,
      cafes_bakeries: true,
      bars_nightlife: true,
      experiences: false,
      culture_arts: false,
      sports_fitness: false,
      wellness_beauty: false,
    });
    // An ABSENT slug keeps its pre-1695 default rather than reading false.
    expect(coerceConfig({ map: { types: { museum: true } } }).map.supers).toMatchObject({
      restaurants: true,
      culture_arts: true,
      sports_fitness: false,
    });
    // The new key wins whenever it is present.
    expect(
      coerceConfig({
        map: { supers: { restaurants: false }, types: { restaurant: true } },
      }).map.supers.restaurants,
    ).toBe(false);
  });

  it("googlePull snaps to a stop — 40 and 60 are billed calls, not a slider", () => {
    expect(GOOGLE_PULL_STOPS).toEqual([20, 40, 60]);
    expect(DEFAULT_MAP.googlePull).toBe(20);
    const pull = (raw: unknown) => coerceConfig({ map: { googlePull: raw } }).map.googlePull;
    expect(pull(40)).toBe(40);
    expect(pull(60)).toBe(60);
    expect(pull(37)).toBe(40);
    expect(pull(9_000)).toBe(60);
    expect(pull(-1)).toBe(20);
    expect(pull("lots")).toBe(20);
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

  it("Swipe left the parked list when Home shipped; the other four stayed", () => {
    // MESITA-1859: Scroll is the one Home surface with a live engine behind
    // it. Feed's rails rank by cosine and the rest have no engine at all.
    expect(ENGINES.find((e) => e.key === "swipe")?.state).toBe("LIVE");
    for (const key of ["catalog", "chat", "social", "favorites"] as const) {
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
  it("is three subpages — Matrix, Discovery Modes and Search Sources", () => {
    const page = readFileSync(join(__dirname, "page.tsx"), "utf8");
    const layout = readFileSync(join(__dirname, "layout.tsx"), "utf8");
    const nav = readFileSync(join(__dirname, "nav.ts"), "utf8");
    const modesPage = readFileSync(join(__dirname, "modes/page.tsx"), "utf8");
    const sourcesPage = readFileSync(join(__dirname, "sources/page.tsx"), "utf8");
    const matrixPage = readFileSync(join(__dirname, "matrix/page.tsx"), "utf8");
    const surfaces = readFileSync(join(__dirname, "DiscoverySurfaceCards.tsx"), "utf8");
    const swipe = readFileSync(join(__dirname, "SwipeConfigClient.tsx"), "utf8");
    const name = readFileSync(join(__dirname, "NameConfigClient.tsx"), "utf8");
    const supersStrip = readFileSync(join(__dirname, "FamiliesClient.tsx"), "utf8");
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

    // Matrix leads (Pato, 2026-09-08): it is neither a mode nor a source,
    // so it owns a page instead of riding on top of one.
    expect(nav).toContain('label: "Matrix"');
    expect(nav).toContain('"/filters-config/matrix"');
    expect(nav).toContain('label: "Discovery Modes"');
    // The second tab is Search Sources: all nine are searches, and the
    // matrix band on Modes has said so since it was drawn (Pato, 2026-09-02).
    expect(nav).toContain('label: "Search Sources"');
    expect(nav).not.toContain('label: "Discovery Sources"');
    expect(nav).toContain('"/filters-config/modes"');
    expect(nav).toContain('"/filters-config/sources"');
    expect(nav).not.toContain("modules");
    expect(nav).toContain("/filters-config/modes#s-map");
    expect(layout).toContain("DiscoveryChrome");
    const chrome = readFileSync(join(__dirname, "DiscoveryChrome.tsx"), "utf8");
    expect(chrome).toContain("ConfigTabNav");
    expect(chrome).toContain("DISCOVERY_TABS");
    expect(chrome).toContain("tab?.label");
    expect(page).toContain("redirect(DISCOVERY_MATRIX_HREF)");
    expect(page).not.toContain("FamiliesClient");
    expect(page).not.toContain("ConfigSection");
    expect(nextConfig).toContain('destination: "/filters-config/modes"');
    expect(nextConfig).not.toContain('destination: "/filters-config",');
    // The retired subpage keeps an operator's bookmark alive.
    expect(nextConfig).toContain('source: "/filters-config/modules"');
    expect(nextConfig).toContain('destination: "/filters-config/sources"');

    // The param is the family (MESITA-1695). Google's slugs are printed under
    // each switch as the battery it bills, never as twenty-two switches.
    expect(supersStrip).toContain('title="Families"');
    expect(supersStrip).toContain("SUPER_FIELDS");
    expect(supersStrip).not.toContain("NEARBY_TYPE_FIELDS");
    expect(supersStrip).not.toContain("Categories available");
    expect(supersStrip).not.toContain("categoryCount");

    // The floor lives INSIDE the source it cuts (Pato, 2026-09-08). One box
    // owns each key; the rest mirror it read-only, so no two inputs move one
    // number. Autocomplete owns `general`, Nearby owns the Map floors, and
    // Mesita Nearby owns `filters`.
    const floor = readFileSync(join(__dirname, "SourceFloor.tsx"), "utf8");
    expect(floor).toContain("Only active places");
    // Reviewers, not stars: the floor counts PEOPLE (Pato, 2026-09-08).
    expect(floor).toContain("Minimum Google reviewers");
    expect(floor).toContain("Minimum rating (stars)");
    expect(floor).not.toContain('label="Minimum reviews"');
    expect(floor).toContain('"general",');
    expect(floor).toContain('"mapFloors",');
    expect(floor).toContain('"mapPull",');
    expect(floor).toContain('"filters",');
    // A Soon source states the fact; it never gets a field to type in.
    expect(floor).toContain("FloorSoonNote");
    expect(floor).not.toContain("categoryCount");
    expect(googleSources).toContain("GeneralFloorOwner");
    expect(googleSources).toContain("MapFloorOwner");
    // The Google pull is a property of the SOURCE, so it lives on the Nearby
    // box, never on the Map mode box whose number is the guest's How many.
    expect(googleSources).toContain("NearbyPullOwner");
    expect(map).not.toContain("googlePull");
    expect(googleSources).toContain("FloorMirror");
    expect(mesitaSources).toContain("FiltersFloorOwner");
    expect(mesitaSources).toContain("FloorMirror");
    expect(mesitaSources.match(/FloorSoonNote \/>/g)?.length).toBe(4);
    // THREE boxes write `map` on this one page now, so none may save the
    // whole slice from its own seed or the last Save wipes the others.
    expect(supersStrip).toContain('["nameFast", "nameDeep", "mapSupers"]');
    const acts = readFileSync(join(__dirname, "actions.ts"), "utf8");
    expect(acts).toContain('"mapSupers"');
    expect(acts).toContain('"mapFloors"');
    expect(acts).toContain('"mapPull"');
    expect(acts).not.toContain('"mapTypes"');
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
    // ONE count knob on Map, and it is How many pins (MESITA-1699). The old
    // per-set cap constants and the queries funnel stay gone.
    expect(map).not.toContain("QueryConcatCaps");
    expect(map).not.toContain("MAP_SET_COUNT_MAX");
    expect(map).not.toContain("MAP_GOOGLE_COUNT_MAX");
    expect(map).toContain("HOW MANY PINS CAME BACK HERE");
    expect(map).toContain("pinCount");
    // The Nearby pull is a different number with a different owner, and it
    // lives on Search Sources, not here.
    expect(map).not.toContain("googlePull");
    expect(map).toContain("Three nested sets");
    expect(map).toContain("Enrichment gates every Mesita ring");
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
    // Scroll graduated (MESITA-1859). You cannot have "coming soon" above a
    // live exponent column, and that copy was dated 2026-08-28 — before Home
    // shipped.
    expect(swipe).not.toContain("coming soon");
    expect(swipe).not.toContain("ConfigSoon");
    expect(swipe).not.toContain("Home is parked");
    expect(swipe).toContain('title="Scroll"');
    expect(swipe).toContain("SectionCard");
    expect(swipe).toContain('kind="enforced"');
    expect(swipe).toContain("consumer-web-recommend-swipe admits the pool");
    // Exactly the three fields that have a reader — and NOT the exponents.
    expect(swipe).toContain('label="Radius (km)"');
    expect(swipe).toContain('label="Minimum Google reviewers"');
    expect(swipe).toContain('label="Closing buffer (min)"');
    // No exponent input on this card, and no control for the one admission
    // field nothing reads.
    expect(swipe).not.toContain("weightMaxFor");
    expect(swipe).not.toContain("categoryFilter");
    expect(swipe).not.toContain("weightProximity");
    expect(swipe).toContain('updateDiscoveryConfig(cfg, ["swipe"])');
    expect(catalog).toContain('title="Catalog is coming soon"');
    expect(catalog).toContain("ConfigSoon");
    expect(chat).toContain('title="Chat is coming soon"');
    expect(chat).toContain("ConfigSoon");
    expect(surfaces).toContain('title="Favorites is coming soon"');
    expect(surfaces).toContain("ConfigSoon");
    // A mode that cannot be tuned says so in ONE SENTENCE where the control
    // would be — never a staged column (MESITA-1859), following the
    // FloorSoonNote precedent on Search Sources.
    const noWeights = readFileSync(join(__dirname, "NoWeightsNote.tsx"), "utf8");
    expect(noWeights).toContain("Weights: none.");
    for (const src of [catalog, chat, surfaces]) {
      expect(src).toContain("NoWeightsNote");
    }
    expect(catalog).toContain("cosine similarity");
    expect(surfaces).toContain("signal mask is empty");
    // …and none of them grows an input.
    for (const src of [catalog, chat, surfaces]) {
      expect(src).not.toContain("weightMaxFor");
    }
    expect(surfaces).not.toContain('title="Favs"');
    expect(surfaces).not.toContain('title="Name"');
    expect(surfaces).not.toContain('title="Swipe"');
    // Social left the mode list; it has no box of its own any more.
    expect(() => readFileSync(join(__dirname, "SocialConfigClient.tsx"))).toThrow();
    expect(signals).toContain('title="Mesita Places Search Signals"');
    expect(signals).toContain("LIBRARY_SIGNALS");
    expect(signals).not.toContain("Promoting");
    expect(signals).toContain("randomness");
    expect(signals).toContain("enriched");
    expect(signals).toContain("partnered");
    // The per-card mode dot strip is gone (MESITA-1856): the Matrix table on
    // this same page draws that grid with column headers, and six unlabelled
    // circles under a card repeated it without them.
    expect(signals).not.toContain("modeSignalState");
    expect(signals).not.toContain("DISCOVERY_MODE_KEYS");
    expect(signals).toContain('kind="enforced"');
    // The exponents left this card at MESITA-1859: a weight is a property of
    // a signal IN A MODE, and one column of inputs could not say which.
    expect(signals).toContain("Scroll read these shape numbers");
    expect(signals).not.toContain("Swipe keeps its own sum");
    expect(signals).not.toContain("weightMaxFor");
    expect(signals).not.toContain("cfg.weights");
    expect(signals).toContain("Signal weights by mode");

    // ONE TABLE, on the page about modes. Signal rows, wired-mode columns.
    const weights = readFileSync(join(__dirname, "ModeWeightsClient.tsx"), "utf8");
    expect(modesPage).toContain("ModeWeightsClient");
    expect(matrixPage).not.toContain("ModeWeightsClient");
    expect(weights).toContain('title="Signal weights by mode"');
    expect(weights).toContain("LIBRARY_SIGNALS");
    expect(weights).toContain("WEIGHTED_MODE_KEYS");
    // The mask is consulted before anything is rendered, and a masked-off
    // cell is an em-dash, never a disabled 0.
    expect(weights).toContain("modeSignalState");
    expect(weights).toContain("—");
    expect(weights).not.toContain(">0</span>");
    // Every input names its signal AND its mode, or it is ~14 boxes all
    // called "Weight".
    expect(weights).toContain("aria-label={`${label} weight · ${modeLabel}`}");
    // The visible range, because weightMaxFor clamps silently.
    expect(weights).toContain("{WEIGHT_MIN}–{max}");
    // One Save per column, each on its OWN slice.
    expect(weights).toContain('map: "weightsMap"');
    expect(weights).toContain('swipe: "weightsScroll"');
    // Reset and Revert, and nothing else — no preset library.
    expect(weights).toContain("Reset to defaults");
    expect(weights).toContain("Revert to saved");
    // No preset library: no dropdown, no named presets, no CRUD.
    expect(weights).not.toContain("<select");
    expect(weights).not.toContain("PRESETS");
    // The matrix's own proven responsive bleed.
    expect(weights).toContain("-mx-4");
    expect(weights).toContain("min-w-[52rem]");
    expect(acts).toContain('"weightsMap"');
    expect(acts).toContain('"weightsScroll"');
    expect(googleSources).toContain("Google Places Autocomplete Search");
    expect(googleSources).toContain("Google Places Nearby Search");
    expect(googleSources).toContain("Google Places Text Search");
    expect(googleSources).toContain("Word (Deep Search)");
    expect(googleSources).toContain("Word does not");
    expect(mesitaSources).toContain("Mesita Places Name Search");
    expect(mesitaSources).toContain("Mesita Places Nearby Search");
    expect(mesitaSources).toContain("Mesita Places Browse Search");
    expect(mesitaSources).toContain("Mesita Places Flexible Search");
    expect(mesitaSources).toContain("Mesita Socials Browse Search");
    expect(mesitaSources).toContain("Mesita Socials Flexible Search");
    // Name and Nearby ship today without knobs of their own; the other four
    // have no engine, so they are the only Soon boxes on this strip.
    expect(mesitaSources.match(/ConfigSoon\n/g)?.length).toBe(4);
    expect(chips).toContain("export function ModeSourceChips");
    expect(chips).toContain("None");
    expect(matrixPage).toContain("DiscoveryMatrix");
    expect(matrixPage).toContain("SignalsConfigClient");
    expect(modesPage).not.toContain("DiscoveryMatrix");
    expect(sourcesPage).not.toContain("SignalsConfigClient");
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
    // ONE grammar, in ink. Fill carries the boolean on all four bands; the
    // emerald/rose pair that encoded it by hue alone is gone, and with it the
    // only saturated colour on the page (MESITA-1856).
    const marks = readFileSync(join(__dirname, "DiscoveryMarks.tsx"), "utf8");
    expect(marks).not.toContain("zero");
    expect(marks).not.toContain("modules");
    expect(marks).not.toContain("emerald");
    expect(marks).not.toContain("rose");
    expect(marks).not.toContain("export function Flag");
    expect(marks).toContain("bg-foreground");
    // A mark is not a bare title: title is no accessible name and never
    // reaches the keyboard, so each one carries its label in text too.
    expect(marks).toContain("sr-only");
    expect(() => readFileSync(join(__dirname, "DiscoveryFlags.tsx"))).toThrow();
    expect(matrix).not.toContain("Flag");
    expect(matrix).not.toContain(">0</span>");
    expect(name).toContain("ModeSourceChips");
    expect(name).not.toContain("TypeBatteries");
    expect(name).not.toContain("Google categories");
    expect(map).toContain("ModeSourceChips");
    expect(map).not.toContain("Google categories");
    expect(swipe).toContain("ModeSourceChips");

    const modesJsx = modesPage.slice(modesPage.indexOf("return ("));
    const sourcesJsx = sourcesPage.slice(sourcesPage.indexOf("return ("));
    // General is the post-Google wipe and now leads the page, the matrix
    // having moved to its own subpage (MESITA-1675). It runs last but reads
    // first. The mode cards then run in section 8.1 order.
    const modeOrder = [
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
    // Families stay on Sources; the wipe stays on Modes. Two boxes,
    // two questions — never fold one into the other.
    expect(modesJsx).not.toContain("FamiliesClient");
    expect(modesJsx).not.toContain("GeneralGateConfigClient");
    expect(sourcesJsx).not.toContain("GeneralGateConfigClient");
    expect(modesJsx).not.toContain("SignalsConfigClient");
    expect(modesJsx).not.toContain("ConfigSoon");

    // NINE BOXES AND NOTHING ELSE. The Families strip is a shared
    // battery above them, not a source, so it does not spend one of the nine.
    const sourceOrder = ["FamiliesClient", "GoogleSourceCards", "MesitaSourceCards"];
    expect(sourcesJsx).not.toContain("GoogleQualityFloorCard");
    expect(sourcesJsx).not.toContain("PoolQualityFloorCard");
    expect(sourcesJsx).not.toContain("SignalsConfigClient");
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

// ── MESITA-1858: the split, the cap, and the deploy window ─────────────────

describe("Mesita Level splits into Enriched and Partnered", () => {
  it("carries the money cap BY NAME — this map is keyed on the deleted string", () => {
    // Had `mesita_level` simply left this map, `partnered` would have
    // inherited the uniform 4 and money's exponent ceiling would have
    // DOUBLED on merge day, with nothing failing anywhere.
    expect(Object.keys(SIGNAL_WEIGHT_MAX).length).toBeGreaterThan(0);
    expect(weightMaxFor("partnered")).toBe(2);
    expect(weightMaxFor("enriched")).toBe(2);
    expect(weightMaxFor("proximity")).toBe(WEIGHT_MAX);
    expect(weightMaxFor("partnered")).not.toBe(WEIGHT_MAX);
  });

  it("clamps a console write above the cap instead of accepting it", () => {
    const cfg = coerceConfig({ weights: { partnered: 4, enriched: 4, proximity: 4 } });
    expect(cfg.weights.partnered).toBe(2);
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
    expect(LIBRARY_SIGNALS.map((r) => r.key).sort()).toEqual(expected);
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

  it("reads mesita_level as a deprecated alias, onto both halves", () => {
    resetLegacySignalWarnings();
    const cfg = coerceConfig({ weights: { mesita_level: 2 } });
    expect(cfg.weights.enriched).toBe(2);
    expect(cfg.weights.partnered).toBe(2);
  });

  it("lets an explicitly-set new key win over the alias", () => {
    resetLegacySignalWarnings();
    const cfg = coerceConfig({
      weights: { mesita_level: 2, partnered: 0.5, enriched: 1.25 },
    });
    expect(cfg.weights.partnered).toBe(0.5);
    expect(cfg.weights.enriched).toBe(1.25);
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
      foldedTo: ["enriched", "partnered"],
    });
  });

  it("mirrors the EF's signal key list exactly — these keys are PERSISTED", () => {
    // Renaming one side alone does not fail a type check anywhere. It
    // silently resets live discovery config to defaults.
    const ef = readFileSync(
      join(__dirname, "../../../../../../supabase/supabase/functions/_shared/discovery-signals.ts"),
      "utf8",
    );
    const block = ef.slice(
      ef.indexOf("export const SIGNAL_KEYS = ["),
      ef.indexOf("] as const;", ef.indexOf("export const SIGNAL_KEYS = [")),
    );
    const efKeys = [...block.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
    expect(efKeys).toEqual([...SIGNAL_KEYS]);
  });
});
