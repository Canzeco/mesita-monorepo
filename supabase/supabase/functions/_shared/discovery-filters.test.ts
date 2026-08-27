import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  anyFilterActive,
  applyDiscoveryFilters,
  trimToRadius,
  type FilterableQuery,
} from "./discovery-filters.ts";
import {
  DISCOVERY_DEFAULTS,
  normalizeDiscoveryConfig,
  WIRED_ENGINE_KEYS,
  type DiscoveryFilters,
} from "./discovery-config.ts";

/** Records every predicate instead of talking to PostgREST. */
type Call = { op: string; col: string; val: unknown };

class FakeQuery implements FilterableQuery<FakeQuery> {
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
}

const filters = (over: Partial<DiscoveryFilters> = {}): DiscoveryFilters => ({
  ...DISCOVERY_DEFAULTS.filters,
  ...over,
});

const CDMX = { lat: 19.4326, lng: -99.1332 };
const NOWHERE = { lat: null, lng: null };

// ── The predicates ───────────────────────────────────────────────────────────

Deno.test("defaults push exactly one predicate: the enrichment gate", () => {
  const q = applyDiscoveryFilters(new FakeQuery(), filters(), NOWHERE);
  assertEquals(q.calls, [{ op: "eq", col: "content_status", val: "ready" }]);
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
  assertEquals(q.calls.length, 7);
  assert(q.calls.some((c) => c.col === "content_status"));
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

// ── The summary helper ───────────────────────────────────────────────────────

Deno.test("anyFilterActive is true on the defaults, because the gate ships on", () => {
  assert(anyFilterActive(DISCOVERY_DEFAULTS.filters));
  assert(!anyFilterActive(filters({ requireReady: false })));
  assert(anyFilterActive(filters({ requireReady: false, minRating: 0.1 })));
  assert(anyFilterActive(filters({ requireReady: false, minReviews: 1 })));
  assert(anyFilterActive(filters({ requireReady: false, maxDistanceKm: 1 })));
});

// ── The config, now that it carries four sections ────────────────────────────

Deno.test("a blob from before this change reads back with the new sections defaulted", () => {
  // Exactly what the previous migration stored: weights + slotting only.
  const old = {
    weights: { proximity: 2, timing: 1, category: 1, popularity: 1, semantic: 1, randomness: 0.35 },
    slotting: { enabled: true, everyNth: 7 },
  };
  const cfg = normalizeDiscoveryConfig(old);
  // The operator's own values survive...
  assertEquals(cfg.weights.proximity, 2);
  assertEquals(cfg.slotting.everyNth, 7);
  // ...and the new sections arrive at their defaults rather than undefined.
  assertEquals(cfg.filters, DISCOVERY_DEFAULTS.filters);
  assertEquals(cfg.engines, DISCOVERY_DEFAULTS.engines);
  assertEquals(cfg.params, DISCOVERY_DEFAULTS.params);
  assertEquals(cfg.catalog, DISCOVERY_DEFAULTS.catalog);
  assertEquals(cfg.map, DISCOVERY_DEFAULTS.map);
  assertEquals(cfg.social, DISCOVERY_DEFAULTS.social);
  assertEquals(cfg.chat, DISCOVERY_DEFAULTS.chat);
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
  assertEquals(cfg.params.semantic.unembedded, DISCOVERY_DEFAULTS.params.semantic.unembedded);
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

Deno.test("social knobs default on an old blob and clamp", () => {
  const missing = normalizeDiscoveryConfig({ weights: {}, slotting: {} });
  assertEquals(missing.social, DISCOVERY_DEFAULTS.social);
  const clamped = normalizeDiscoveryConfig({
    social: { seedCount: 99, eventsPerRail: 1, minSeedEvents: 0, horizonDays: 400 },
  });
  assertEquals(clamped.social.seedCount, 20);
  assertEquals(clamped.social.eventsPerRail, 4);
  assertEquals(clamped.social.minSeedEvents, 1);
  assertEquals(clamped.social.horizonDays, 90);
});

Deno.test("only WIRED engines are storable — an unwired one has no knob to persist", () => {
  // The registry the console renders is longer than this list on purpose; if
  // an engine ever gains a key here without being wired, the console would
  // offer a toggle the engine ignores.
  assertEquals([...WIRED_ENGINE_KEYS], ["swipe"]);
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
      googleFill: "yes",
      types: { restaurant: false, ghost: true },
    },
  });
  assertEquals(clamped.map.minRating, 5);
  assertEquals(clamped.map.minReviews, 0);
  assertEquals(clamped.map.minPopularity, 1);
  assertEquals(clamped.map.reloadMinKm, 20);
  assertEquals(clamped.map.googleFill, true);
  assertEquals(clamped.map.partnerCount, 10);
  assertEquals(clamped.map.notPartnerCount, 10);
  assertEquals(clamped.map.googleCount, 20);
  assertEquals(clamped.map.types.restaurant, false);
  assertEquals(clamped.map.types.bakery, true);
});

Deno.test("map lane caps clamp and default on an old blob", () => {
  const missing = normalizeDiscoveryConfig({ weights: {}, slotting: {} });
  assertEquals(missing.map.partnerCount, 10);
  assertEquals(missing.map.notPartnerCount, 10);
  assertEquals(missing.map.googleCount, 20);
  const clamped = normalizeDiscoveryConfig({
    map: { partnerCount: 99, notPartnerCount: -3, googleCount: 7.8 },
  });
  assertEquals(clamped.map.partnerCount, 20);
  assertEquals(clamped.map.notPartnerCount, 0);
  assertEquals(clamped.map.googleCount, 8);
});
