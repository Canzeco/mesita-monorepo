// consumer-web-list-catalog on the Area pipeline's one pool (MESITA-2379):
// Google and Mesita candidates merged and ranked by `selectAreaPool`; the
// client pages the pool. The legacy rails are cut from the same pool.
import { assert, assertEquals } from "jsr:@std/assert@1";

const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("list-catalog: one ranking, the Map's — Proximity^a × Popularity^1 × Selected^1 (MESITA-2516)", () => {
  assert(src.includes("proximity: cfg.map.proximityWeight,"));
  assert(src.includes("popularity: 1,"));
  assert(src.includes("selected: 1,"));
  assert(src.includes("signals: { reachKm: cfg.params.proximity.reachKm, weights },"));
  // Home's Nearby / Popular are gone: the guest's mode is never read.
  assertEquals(src.includes("readAreaMode("), false);
  assertEquals(src.includes("body.prefer"), false);
});

Deno.test("list-catalog: one pool from the shared engine, both wires", () => {
  assert(src.includes("selectAreaPool<OwnedRow>("));
  assert(src.includes("selectedPoolQuery("));
  assert(src.includes("selectedOnly: false"));
  assert(src.includes("const unified = body.unified === true;"));
  assert(src.includes("location: { kind: location.kind }"));
  // Legacy rails come from the same ranked pool, split by source.
  assert(src.includes("buildCatalogRails("));
  assert(src.includes('pool.places.filter((p) => p.area.source === "selected")'));
  // The one-pool wire buys the operator's stop; the legacy wire one call.
  assert(src.includes("unified ? googleCallsForStop(cfg.map.googlePlaces) : 1"));
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

Deno.test("list-catalog: one circle; no guest review stop (MESITA-2417)", () => {
  assert(src.includes("const radiusKm = cfg.map.radiusKm;"));
  assertEquals(src.includes("nearbyDecision.radiusKm"), false);
  assertEquals(src.includes("NEARBY_RADIUS_KM"), false);
  assertEquals(src.includes("guestReviewFloor"), false);
  assertEquals(src.includes("body.minReviews"), false);
});

Deno.test("list-catalog: Home never reads bounds into the location (MESITA-2500)", () => {
  assert(src.includes("resolveAreaLocation(null, center, radiusKm)"));
  assertEquals(src.includes("resolveAreaLocation(unified ? body.bounds"), false);
  assertEquals(src.includes("location.kind === \"area\" ? location.bounds"), false);
  // A bounds from an old build is only logged.
  assert(src.includes('event: "bounds_ignored"'));
});
