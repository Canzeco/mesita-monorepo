// consumer-web-list-catalog on the Area pipeline's one pool (MESITA-2379,
// four sources since MESITA-2703): the four sources merged and ranked by
// `selectAreaPool`; the client pages the pool. The legacy rails are cut from
// the same pool.
import { assert, assertEquals } from "jsr:@std/assert@1";

const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("list-catalog: one ranking, the Map's — Proximity^a × Popularity^b; the half-distance is the operator's (MESITA-2703, MESITA-2706)", () => {
  assert(src.includes("const weights = areaWeights(cfg.map);"));
  // The engine reads the radius divisor from the blob and the radius from
  // the location; no caller override.
  assertEquals(src.includes("signals:"), false);
  assertEquals(src.includes("reachKm"), false);
  assertEquals(src.includes("halfKm"), false);
  // Home's Nearby / Popular are gone: the guest's mode is never read.
  assertEquals(src.includes("readAreaMode("), false);
  assertEquals(src.includes("body.prefer"), false);
});

Deno.test("list-catalog: one pool from the shared engine, both wires", () => {
  assert(src.includes("selectAreaPool<OwnedRow>("));
  assert(src.includes("selectedPoolQuery("));
  assert(src.includes("selectedOnly: false"));
  assert(src.includes("const unified = body.unified === true;"));
  // The answer says which radius ranked it, and the operator's (MESITA-2703).
  assert(src.includes("location: { kind: location.kind, radiusKm, operatorRadiusKm: cfg.map.radiusKm }"));
  // Legacy rails come from the same ranked pool, split by source.
  assert(src.includes("buildCatalogRails("));
  assert(src.includes('pool.places.filter((p) => p.area.source === "selected")'));
  // Both wires run the same four switches: no per-wire Google budget.
  assertEquals(src.includes("googleCalls"), false);
  assertEquals(src.includes("mesitaLimit"), false);
  for (const gone of ["selectGooglePlaces", "selectMesitaSelected"]) {
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

Deno.test("list-catalog: one circle, the saved pin's radius else the operator's; no guest review stop", () => {
  // MESITA-2703: validated before the Mesita box and Google's circle read it.
  assert(src.includes("const radius = requestRadiusKm(body.radiusKm, cfg.map.radiusKm);"));
  assert(src.includes("const radiusKm = radius.km;"));
  assertEquals(src.includes("nearbyDecision.radiusKm"), false);
  assertEquals(src.includes("NEARBY_RADIUS_KM"), false);
  assertEquals(src.includes("guestReviewFloor"), false);
  assertEquals(src.includes("body.minReviews"), false);
});

Deno.test("list-catalog: Home never reads bounds into the location (MESITA-2500)", () => {
  // resolveAreaLocation takes no bounds at all since MESITA-2603.
  assert(src.includes("resolveAreaLocation(center, radiusKm)"));
  assertEquals(src.includes("body.bounds,"), false);
  assertEquals(src.includes("location.kind === \"area\" ? location.bounds"), false);
  // A bounds from an old build is only logged.
  assert(src.includes('event: "bounds_ignored"'));
});
