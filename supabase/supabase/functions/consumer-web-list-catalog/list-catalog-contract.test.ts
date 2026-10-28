// consumer-web-list-catalog, the Catalog pipeline (MESITA-2379, MESITA-2909):
// every Mesita place ranked by `selectAreaPool`, no radius; the client pages
// the list.
import { assert, assertEquals } from "jsr:@std/assert@1";

const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("list-catalog: the Catalog's ranking — Proximity × Popularity, no exponents; the half distance is the operator's (MESITA-2722, MESITA-2909)", () => {
  assertEquals(src.includes("areaWeights"), false);
  // The engine reads the half distance from the blob; no caller override.
  assertEquals(src.includes("signals:"), false);
  assertEquals(src.includes("reachKm"), false);
  // Home's Nearby / Popular are gone: the guest's mode is never read.
  assertEquals(src.includes("readAreaMode("), false);
  assertEquals(src.includes("body.prefer"), false);
});

Deno.test("list-catalog: one pool from the shared engine", () => {
  assert(src.includes("selectAreaPool<PoolRow>("));
  assert(src.includes("selectedPoolQuery("));
  assert(src.includes("selectedOnly: false"));
  assertEquals(src.includes("buildCatalogRails"), false);
  assert(src.includes('wire: "unified"'));
  assert(src.includes('surface: "catalog"'));
  // The answer names the operator's radius (the location sheet) and the
  // page size (MESITA-2909).
  assert(src.includes("location: { kind: location.kind, operatorRadiusKm: cfg.map.radiusKm }"));
  assert(src.includes("pageSize: pool.summary.pageSize"));
  assertEquals(src.includes("googleCalls"), false);
  assertEquals(src.includes("mesitaLimit"), false);
  for (const gone of ["selectGooglePlaces", "selectMesitaSelected"]) {
    assertEquals(src.includes(gone), false, gone);
  }
  // No Google Nearby Search, no quota, no key (MESITA-2872).
  for (const gone of ["searchNearby", "areaQuota", "consumeQuota", "lookupOwned", "apiKey"]) {
    assertEquals(src.includes(gone), false, gone);
  }
});

Deno.test("list-catalog: Right Now, Universal and predicates are gone", () => {
  for (const gone of [
    "right-now-google",
    "rightNowGooglePlaces",
    "withGoogleRightNow",
    "rankCatalogRails",
    "readDeckPredicates",
    "applyDeckPredicates",
    "predicates",
  ]) {
    assertEquals(src.includes(gone), false, gone);
  }
});

Deno.test("list-catalog: no radius at all, the whole catalog; no guest review stop (MESITA-2909)", () => {
  assertEquals(src.includes("requestRadiusKm"), false);
  assert(src.includes("{ center: null, radiusKm: 0, families, selectedOnly: false }"));
  assertEquals(src.includes("nearbyDecision.radiusKm"), false);
  assertEquals(src.includes("NEARBY_RADIUS_KM"), false);
  assertEquals(src.includes("guestReviewFloor"), false);
  assertEquals(src.includes("body.minReviews"), false);
});

Deno.test("list-catalog: Home never reads bounds into the location (MESITA-2500)", () => {
  // resolveAreaLocation takes no bounds (MESITA-2603) and, here, no radius.
  assert(src.includes("resolveAreaLocation(center, null)"));
  assertEquals(src.includes("body.bounds,"), false);
  assertEquals(src.includes("location.kind === \"area\" ? location.bounds"), false);
  // A bounds from an old build is only logged.
  assert(src.includes('event: "bounds_ignored"'));
});
