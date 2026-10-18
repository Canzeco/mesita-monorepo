import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  applyDiscoveryFilters,
  trimToRadius,
  type DiscoveryFilterQuery,
} from "./discovery-filters.ts";
import {
  DISCOVERY_DEFAULTS,
  normalizeDiscoveryConfig,
  type DiscoveryFilters,
} from "./discovery-config.ts";

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

// ── The config ───────────────────────────────────────────────────────────────

Deno.test("a blob from before this change reads back with every live section defaulted", () => {
  // What an early migration stored: weights + slotting only. Both retired.
  const old = {
    weights: { proximity: 2, timing: 1, category: 1, popularity: 1, summary: 1, randomness: 0.35 },
    slotting: { enabled: true, everyNth: 7 },
  };
  const cfg = normalizeDiscoveryConfig(old);
  const keys = cfg as unknown as Record<string, unknown>;
  assertEquals("weights" in keys, false);
  assertEquals("slotting" in keys, false);
  // ...and the live sections arrive at their defaults rather than undefined.
  assertEquals(cfg.filters, DISCOVERY_DEFAULTS.filters);
  assertEquals(cfg.params, DISCOVERY_DEFAULTS.params);
  assertEquals(cfg.catalog, DISCOVERY_DEFAULTS.catalog);
  assertEquals(cfg.map, DISCOVERY_DEFAULTS.map);
  assertEquals(cfg.name, DISCOVERY_DEFAULTS.name);
  assertEquals(cfg.chat, DISCOVERY_DEFAULTS.chat);
});

// THE SWIPE DECK RETIRED (MESITA-2328), and every key only it read went with
// it. A blob that still carries them must come back WITHOUT them, or the next
// Save writes them straight back. `swipe` is dropped, never renamed.
Deno.test("the deck's slices do not survive a normalize: swipe, engines, weights, weightsByMode", () => {
  const cfg = normalizeDiscoveryConfig({
    swipe: { radiusKm: 7, closingBufferMin: 30, minReviews: 1, savedAt: null },
    engines: { swipe: { ranked: false } },
    weights: { proximity: 1.5, mesita_level: 2, partnership: 2 },
    weightsByMode: { swipe: { timing: 1.5 }, map: { proximity: 0.5 } },
  }) as unknown as Record<string, unknown>;
  for (const dead of ["swipe", "engines", "weights", "weightsByMode"]) {
    assertEquals(dead in cfg, false, dead);
  }
});

// What the live blob still stores under `params` (2026-10-18): the deck's
// shape numbers on seven bags. Only the Area pipeline's three numbers are
// read now; the rest must not come back, or the next Save writes it back.
Deno.test("the deck's param bags and numbers do not survive a normalize", () => {
  const cfg = normalizeDiscoveryConfig({
    params: {
      name: {},
      timing: { dawn: 0.55, openShare: 0.7, closedFloor: 0.2 },
      category: { miss: 0.1, exact: 1, family: 0.55 },
      proximity: { maxKm: 25, kneeKm: 1, missingGeo: 0.35, halfDistanceKm: 6 },
      popularity: { confidence: 60, floorRating: 3, priorRating: 4.2, referenceReviews: 500 },
      randomness: {},
      summary: { unembedded: 0.4 },
      mesita_level: {},
    },
  });
  assertEquals(cfg.params, {
    proximity: { halfDistanceKm: 6 },
    popularity: {
      referenceRating: DISCOVERY_DEFAULTS.params.popularity.referenceRating,
      referenceReviews: 500,
    },
  });
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
