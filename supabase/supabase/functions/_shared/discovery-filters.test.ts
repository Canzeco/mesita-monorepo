import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  applyDiscoveryFilters,
  trimToRadius,
  type DiscoveryFilterQuery,
} from "./discovery-filters.ts";
import {
  DISCOVERY_DEFAULTS,
  normalizeDiscoveryConfig,
  WIRED_ENGINE_KEYS,
  type DiscoveryFilters,
} from "./discovery-config.ts";
import { SIGNAL_KEYS } from "./discovery-signals.ts";

/** Records every predicate instead of talking to PostgREST. */
type Call = { op: string; col: string; val: unknown };

class FakeQuery implements DiscoveryFilterQuery<FakeQuery> {
  calls: Call[] = [];
  eq(col: string, val: unknown) {
    this.calls.push({ op: "eq", col, val });
    return this;
  }
  gte(col: string, val: unknown) {
    this.calls.push({ op: "gte", col, val });
    return this;
  }
  lte(col: string, val: unknown) {
    this.calls.push({ op: "lte", col, val });
    return this;
  }
  not(col: string, op: string, val: unknown) {
    this.calls.push({ op: `not.${op}`, col, val });
    return this;
  }
}

const filters = (over: Partial<DiscoveryFilters> = {}): DiscoveryFilters => ({
  ...DISCOVERY_DEFAULTS.filters,
  ...over,
});

const CDMX = { lat: 19.4326, lng: -99.1332 };
const NOWHERE = { lat: null, lng: null };

// ── The predicates ───────────────────────────────────────────────────────────

Deno.test("defaults push exactly the Enriched gate: enriched_at IS NOT NULL AND content_state = 'ready'", () => {
  const q = applyDiscoveryFilters(new FakeQuery(), filters(), NOWHERE);
  assertEquals(q.calls, [
    { op: "not.is", col: "enriched_at", val: null },
    { op: "eq", col: "content_state", val: "ready" },
  ]);
});

Deno.test("the Enriched gate needs BOTH facts (MESITA-2154)", () => {
  const q = applyDiscoveryFilters(new FakeQuery(), filters(), NOWHERE);
  // `ready` alone admitted every Created place: Create saves 'ready' and
  // never stamps enriched_at.
  assert(q.calls.some((c) => c.op === "not.is" && c.col === "enriched_at"));
  // The stamp alone admitted an Enriched place mid re-enrich ('generating')
  // or after a failed one ('failed'), whose Reserve then 409s
  // `profile_not_ready` in consumer-web-create-reservation.
  assert(q.calls.some((c) => c.op === "eq" && c.col === "content_state" && c.val === "ready"));
});

Deno.test("requireReady off pushes nothing at all", () => {
  const q = applyDiscoveryFilters(new FakeQuery(), filters({ requireReady: false }), NOWHERE);
  assertEquals(q.calls, []);
});

Deno.test("quality floors become gte predicates only above zero", () => {
  const off = applyDiscoveryFilters(
    new FakeQuery(),
    filters({ requireReady: false, minRating: 0, minReviews: 0 }),
    NOWHERE,
  );
  assertEquals(off.calls, []);

  const on = applyDiscoveryFilters(
    new FakeQuery(),
    filters({ requireReady: false, minRating: 4.3, minReviews: 50 }),
    NOWHERE,
  );
  assertEquals(on.calls, [
    { op: "gte", col: "google_stars_overall", val: 4.3 },
    { op: "gte", col: "google_review_count", val: 50 },
  ]);
});

Deno.test("the radius becomes a bounding box, and only with a guest location", () => {
  const noGeo = applyDiscoveryFilters(
    new FakeQuery(),
    filters({ requireReady: false, maxDistanceKm: 10 }),
    NOWHERE,
  );
  assertEquals(noGeo.calls, [], "a radius with nowhere to centre must not narrow anything");

  const withGeo = applyDiscoveryFilters(
    new FakeQuery(),
    filters({ requireReady: false, maxDistanceKm: 10 }),
    CDMX,
  );
  assertEquals(withGeo.calls.map((c) => `${c.op} ${c.col}`), [
    "gte lat",
    "lte lat",
    "gte lng",
    "lte lng",
  ]);
  // The box brackets the guest, and the lng span is wider than the lat span
  // because a degree of longitude is shorter away from the equator.
  const [latLo, latHi, lngLo, lngHi] = withGeo.calls.map((c) => c.val as number);
  assert(latLo < CDMX.lat && CDMX.lat < latHi);
  assert(lngLo < CDMX.lng && CDMX.lng < lngHi);
  assert(lngHi - lngLo > latHi - latLo);
});

Deno.test("a zero radius is off, never a box that admits nothing", () => {
  const q = applyDiscoveryFilters(
    new FakeQuery(),
    filters({ requireReady: false, maxDistanceKm: 0 }),
    CDMX,
  );
  assertEquals(q.calls, []);
});

Deno.test("every filter at once still pushes every predicate", () => {
  const q = applyDiscoveryFilters(
    new FakeQuery(),
    filters({ requireReady: true, minRating: 4, minReviews: 10, maxDistanceKm: 5 }),
    CDMX,
  );
  assertEquals(q.calls.length, 8);
  assert(q.calls.some((c) => c.col === "enriched_at"));
  assert(q.calls.some((c) => c.col === "content_state"));
  assert(q.calls.some((c) => c.col === "google_stars_overall"));
  assert(q.calls.some((c) => c.col === "google_review_count"));
  assertEquals(q.calls.filter((c) => c.col === "lat" || c.col === "lng").length, 4);
});

// ── The corner trim ──────────────────────────────────────────────────────────

type Row = { id: string; lat: number | null; lng: number | null };
const latOf = (r: Row) => r.lat;
const lngOf = (r: Row) => r.lng;

Deno.test("the trim removes the box corners the circle excludes", () => {
  // ~7 km north, and ~7 km north-east — the second is ~9.9 km from centre, so
  // a 10 km circle keeps both, but at 8 km only the first survives.
  const north: Row = { id: "n", lat: CDMX.lat + 7 / 111, lng: CDMX.lng };
  const corner: Row = {
    id: "c",
    lat: CDMX.lat + 7 / 111,
    lng: CDMX.lng + 7 / (111 * Math.cos((CDMX.lat * Math.PI) / 180)),
  };
  const rows = [north, corner];

  assertEquals(trimToRadius(rows, latOf, lngOf, 10, CDMX).map((r) => r.id), ["n", "c"]);
  assertEquals(trimToRadius(rows, latOf, lngOf, 8, CDMX).map((r) => r.id), ["n"]);
});

Deno.test("the trim is a no-op when the filter is off or there is no location", () => {
  const rows: Row[] = [{ id: "far", lat: 0, lng: 0 }];
  assertEquals(trimToRadius(rows, latOf, lngOf, 0, CDMX), rows);
  assertEquals(trimToRadius(rows, latOf, lngOf, 5, NOWHERE), rows);
});

Deno.test("the trim keeps a row with no geo rather than silently dropping it", () => {
  const rows: Row[] = [{ id: "unlocated", lat: null, lng: null }];
  assertEquals(trimToRadius(rows, latOf, lngOf, 5, CDMX).map((r) => r.id), ["unlocated"]);
});

// ── The config, now that it carries four sections ────────────────────────────

Deno.test("a blob from before this change reads back with the new sections defaulted", () => {
  // Exactly what the previous migration stored: weights + slotting only.
  const old = {
    weights: { proximity: 2, timing: 1, category: 1, popularity: 1, summary: 1, randomness: 0.35 },
    slotting: { enabled: true, everyNth: 7 },
  };
  const cfg = normalizeDiscoveryConfig(old);
  // The operator's own values survive...
  assertEquals(cfg.weights.proximity, 2);
  // ...the retired Summary exponent as inert storage only (MESITA-2144): the
  // weights map is additive, and no signal key binds it any more...
  assertEquals((cfg.weights as unknown as Record<string, number>).summary, 1);
  assertEquals((SIGNAL_KEYS as readonly string[]).includes("summary"), false);
  assertEquals(cfg.weights.name, 1);
  assertEquals(cfg.weights.enriched, 1);
  assertEquals("slotting" in cfg, false);
  // ...and the new sections arrive at their defaults rather than undefined.
  assertEquals(cfg.filters, DISCOVERY_DEFAULTS.filters);
  assertEquals(cfg.engines, DISCOVERY_DEFAULTS.engines);
  assertEquals(cfg.params, DISCOVERY_DEFAULTS.params);
  assertEquals(cfg.catalog, DISCOVERY_DEFAULTS.catalog);
  assertEquals(cfg.map, DISCOVERY_DEFAULTS.map);
  assertEquals(cfg.name, DISCOVERY_DEFAULTS.name);
  assertEquals(cfg.chat, DISCOVERY_DEFAULTS.chat);
  assertEquals(cfg.swipe, DISCOVERY_DEFAULTS.swipe);
});

Deno.test("swipe knobs default on an old blob and clamp", () => {
  const missing = normalizeDiscoveryConfig({ weights: {}, slotting: {} });
  assertEquals(missing.swipe, DISCOVERY_DEFAULTS.swipe);
  const clamped = normalizeDiscoveryConfig({
    swipe: {
      radiusKm: 99,
      closingBufferMin: -4,
      minReviews: -1,
      savedAt: "not-a-date",
    },
  });
  assertEquals(clamped.swipe.radiusKm, 50);
  assertEquals(clamped.swipe.closingBufferMin, 0);
  assertEquals(clamped.swipe.minReviews, 0);
  assertEquals(clamped.swipe.savedAt, null);
  assertEquals(
    normalizeDiscoveryConfig({ swipe: { savedAt: "2026-08-26T18:00:00.000Z" } }).swipe.savedAt,
    "2026-08-26T18:00:00.000Z",
  );
});

// THE FIVE UNREAD RANKING KNOBS ARE DELETED (MESITA-1859), not merely
// unrendered. A blob that still carries them must come back WITHOUT them, or
// `weightProximity: 0.7` sits in jsonb next to a live per-mode Proximity
// exponent and the next reader has to work out which one the deck obeys.
Deno.test("the retired swipe ranking knobs do not survive a normalize", () => {
  const swipe = normalizeDiscoveryConfig({
    swipe: {
      radiusKm: 7,
      weightProximity: 0.7,
      starsExponent: 1.5,
      logDivisor: 10,
      partnerBias: { none: 1, dominant: 2 },
      randomnessMax: 1.3,
    },
  }).swipe as Record<string, unknown>;
  for (
    const dead of [
      "weightProximity",
      "starsExponent",
      "logDivisor",
      "partnerBias",
      "randomnessMax",
    ]
  ) {
    assertEquals(dead in swipe, false, dead);
  }
  // The admission knobs beside them are untouched.
  assertEquals(swipe.radiusKm, 7);
});

Deno.test("signal params clamp and an old blob without params stays default-shaped", () => {
  const cfg = normalizeDiscoveryConfig({
    params: {
      proximity: { maxKm: 999, kneeKm: 0, missingGeo: 2 },
      popularity: { confidence: -3 },
    },
  });
  assertEquals(cfg.params.proximity.maxKm, 200);
  assertEquals(cfg.params.proximity.kneeKm, 0.1);
  assertEquals(cfg.params.proximity.missingGeo, 1);
  assertEquals(cfg.params.popularity.confidence, 1);
  assertEquals(cfg.params.name, DISCOVERY_DEFAULTS.params.name);
});

// What the live blob still stores under `params` (MESITA-2144): the retired
// Summary bag, Name's `unembedded` at its own fallback, and the empty
// `mesita_level` bag. None of it may come back from a normalize, or the next
// Save writes it straight back over the migration that strips it.
Deno.test("the retired param bags and Name's unembedded do not survive a normalize", () => {
  const cfg = normalizeDiscoveryConfig({
    params: {
      summary: { unembedded: 0.4 },
      name: { unembedded: 0.4 },
      mesita_level: {},
      proximity: { maxKm: 30 },
    },
  });
  const params = cfg.params as unknown as Record<string, unknown>;
  assertEquals("summary" in params, false);
  assertEquals("mesita_level" in params, false);
  assertEquals(cfg.params.name, {});
  assertEquals(Object.keys(cfg.params).sort(), [...SIGNAL_KEYS].sort());
  // The live bag beside them is untouched.
  assertEquals(cfg.params.proximity.maxKm, 30);
});

Deno.test("filters clamp, and minRating keeps one decimal", () => {
  const cfg = normalizeDiscoveryConfig({
    filters: { requireReady: "yes", minRating: 99, minReviews: -5, maxDistanceKm: 9999 },
  });
  // A non-boolean falls back rather than coercing truthy.
  assertEquals(cfg.filters.requireReady, DISCOVERY_DEFAULTS.filters.requireReady);
  assertEquals(cfg.filters.minRating, 5);
  assertEquals(cfg.filters.minReviews, 0);
  assertEquals(cfg.filters.maxDistanceKm, 200);

  assertEquals(normalizeDiscoveryConfig({ filters: { minRating: 4.26 } }).filters.minRating, 4.3);
});

Deno.test("engines are rebuilt from the code list, so a retired key cannot survive", () => {
  const cfg = normalizeDiscoveryConfig({
    engines: { swipe: { ranked: false }, chat: { ranked: true }, ghost: { ranked: true } },
  });
  assertEquals(Object.keys(cfg.engines).sort(), [...WIRED_ENGINE_KEYS].sort());
  assertEquals(cfg.engines.swipe.ranked, false);
});

// The tentative Social engine's box had no reader (MESITA-2144). A blob that
// still carries it must come back without it, like `slotting` before it.
Deno.test("the retired social box does not survive a normalize", () => {
  const cfg = normalizeDiscoveryConfig({
    social: { seedCount: 6, generatedCount: 6, eventsPerRail: 8, minSeedEvents: 1, horizonDays: 14 },
  });
  assertEquals("social" in cfg, false);
});

Deno.test("chat.prompt round-trips, truncates, and garbage becomes blank", () => {
  assertEquals(normalizeDiscoveryConfig({ chat: { prompt: "  Be Memo.  " } }).chat.prompt, "  Be Memo.  ");
  assertEquals(normalizeDiscoveryConfig({}).chat.prompt, "");
  assertEquals(normalizeDiscoveryConfig({ chat: { prompt: 12 } }).chat.prompt, "");
  const tooLong = "x".repeat(12_001);
  assertEquals(normalizeDiscoveryConfig({ chat: { prompt: tooLong } }).chat.prompt.length, 12_000);
});

Deno.test("map knobs default on an old blob and clamp", () => {
  const missing = normalizeDiscoveryConfig({ weights: {}, slotting: {} });
  assertEquals(missing.map, DISCOVERY_DEFAULTS.map);
  const clamped = normalizeDiscoveryConfig({
    map: {
      minRating: 9,
      minReviews: -2,
      minPopularity: 4,
      reloadMinKm: 99,
      reloadMinSec: 40,
      googleFill: "yes",
      supers: { restaurants: false },
    },
  });
  assertEquals(clamped.map.minRating, 5);
  assertEquals(clamped.map.minReviews, 0);
  assertEquals(clamped.map.minPopularity, 1);
  assertEquals(clamped.map.reloadMinKm, 4);
  assertEquals(clamped.map.reloadMinSec, 15);
  const legacyReload = normalizeDiscoveryConfig({
    map: { reloadMinKm: 0.4, reloadMinSec: 2 },
  });
  assertEquals(legacyReload.map.reloadMinKm, 0.5);
  assertEquals(legacyReload.map.reloadMinSec, 2);
  assertEquals(clamped.map.googleFill, true);
  assertEquals(clamped.map.supers.coffee, true);
  assertEquals(clamped.map.supers.dinner, true);
  assertEquals("restaurants" in clamped.map.supers, false);
});

Deno.test("map.pinCount is the operator's How many, snapped to a stop", () => {
  // MESITA-1699 took the Search Filters sheet off the consumer app, so the
  // number that was the guest's since 2026-08-29 lives here. It caps BOTH
  // lanes and the merged union, so max pins = pinCount, never the sum.
  const pins = (raw: unknown) =>
    normalizeDiscoveryConfig({ map: { pinCount: raw } }).map.pinCount;
  assertEquals(normalizeDiscoveryConfig({}).map.pinCount, 20);
  assertEquals(pins(40), 40);
  assertEquals(pins(60), 60);
  assertEquals(pins(29), 20);
  assertEquals(pins(31), 40);
  // A tie snaps DOWN, so a hand-edited blob costs less than it asked for
  // rather than more — this number is what the map bills Google against.
  assertEquals(pins(30), 20);
  assertEquals(pins(9_000), 60);
  assertEquals(pins("plenty"), 20);
});

Deno.test("map.googlePull is retired: an old blob's key is dropped on normalize (MESITA-2298)", () => {
  // One Nearby Search (New) call per request, 20 places, never widened — the
  // Legacy 40/60 pull is gone, so the normalizer rebuilds `map` without it
  // and the next save drops it from the blob.
  const map = normalizeDiscoveryConfig({ map: { googlePull: 60 } }).map;
  assertEquals("googlePull" in map, false);
  assertEquals(map.pinCount, 20);
  assertEquals("googlePull" in DISCOVERY_DEFAULTS.map, false);
});

Deno.test("map.radiusKm is the one Nearby radius: default 50, clamped 1..50, one decimal", () => {
  // Shared by the Map and the Feed's Google Places and Mesita Selected rails
  // (MESITA-2298). The operator's number; a guest never sends it. 50 km is
  // Google's Nearby circle cap, so the knob cannot ask for more.
  const radius = (raw: unknown) =>
    normalizeDiscoveryConfig({ map: { radiusKm: raw } }).map.radiusKm;
  assertEquals(normalizeDiscoveryConfig({}).map.radiusKm, 50);
  assertEquals(DISCOVERY_DEFAULTS.map.radiusKm, 50);
  assertEquals(radius(0.2), 1);
  assertEquals(radius(999), 50);
  assertEquals(radius(12.34), 12.3);
  assertEquals(radius(7), 7);
  assertEquals(radius("far"), 50);
});

Deno.test("name knobs default Fast 5 and Deep 3+3+3 on an old blob and clamp", () => {
  const missing = normalizeDiscoveryConfig({ weights: {}, slotting: {} });
  assertEquals(missing.name, DISCOVERY_DEFAULTS.name);
  assertEquals(missing.name.fast.count, 5);
  assertEquals(missing.name.fast.googleCount, 5);
  assertEquals(missing.name.deep, {
    mesitaCount: 3,
    autoCount: 3,
    googleCount: 3,
    supers: DISCOVERY_DEFAULTS.map.supers,
  });
  const clamped = normalizeDiscoveryConfig({
    name: {
      fast: { count: 99, supers: { restaurants: false } },
      deep: { partnerCount: 5, mesitaCount: 7.2, googleCount: 40, autoCount: 0 },
    },
  });
  assertEquals(clamped.name.fast.count, 20);
  assertEquals(clamped.name.fast.supers.coffee, true);
  assertEquals(clamped.name.fast.supers.dinner, true);
  assertEquals("restaurants" in clamped.name.fast.supers, false);
  // The retired Deep partners cap does not survive a read.
  assertEquals("partnerCount" in clamped.name.deep, false);
  assertEquals(clamped.name.deep.mesitaCount, 7);
  assertEquals(clamped.name.deep.googleCount, 20);
  assertEquals(clamped.name.deep.autoCount, 0);
  assertEquals(clamped.name.fast.googleCount, 20);
  const missingAuto = normalizeDiscoveryConfig({
    name: { deep: { googleCount: 40 } },
  });
  assertEquals(missingAuto.name.deep.autoCount, 3);
  assertEquals(missingAuto.name.deep.googleCount, 20);
});

Deno.test("the retired partnership/promotion/social weights bind to nothing, but are no longer erased", () => {
  const cfg = normalizeDiscoveryConfig({
    weights: { partnership: 2, promotion: 3, social: 4, proximity: 1.5 },
    params: { partnership: {}, promotion: {}, social: {} },
  });
  // WHAT CHANGED AT MESITA-1858: the weights map is ADDITIVE, so an unknown
  // key rides along instead of being deleted. That is the whole
  // mitigation for the deploy window — web-admin ships on merge, the Edge
  // Functions ship by hand, and in between a whole-blob Save from the old
  // side must not evict a key the new side is about to need.
  const kept = cfg.weights as unknown as Record<string, number>;
  assertEquals(kept.partnership, 2);
  assertEquals(kept.promotion, 3);
  assertEquals(kept.social, 4);
  // NO LONGER TRUE, deliberately: these keys used to be asserted absent.
  // They bind to no signal either way — `blend` iterates SIGNAL_KEYS — so
  // preservation is inert storage, not a resurrected signal.
  assertEquals((SIGNAL_KEYS as readonly string[]).includes("partnership"), false);
  // `params` is still rebuilt from SIGNAL_KEYS: a param bag for a signal that
  // does not exist cannot be read by anything and has no deploy-window risk.
  assertEquals(Object.hasOwn(cfg.params, "partnership"), false);
  // The replacement axes arrive at their defaults rather than inheriting a number.
  assertEquals(cfg.weights.enriched, DISCOVERY_DEFAULTS.weights.enriched);
  assertEquals(cfg.weights.proximity, 1.5);
});
