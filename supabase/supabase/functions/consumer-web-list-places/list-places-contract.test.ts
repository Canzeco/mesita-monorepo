// consumer-web-list-places on the shared engine (MESITA-2302, one pool since
// MESITA-2379). Source pins for the wiring the engine's own behavioural suite
// (area-pipeline.test) cannot see: the one pool inside the screen radius
// (MESITA-2504), the operator's Map Google calls, the fallback circle, and that web Search's
// call is the only one it answers (MESITA-2337).
import { assert, assertEquals } from "jsr:@std/assert@1";

const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
const anchor = src.indexOf("const center = { lat: nearbyDecision.lat");
const webBranch = anchor >= 0 ? src.slice(anchor) : "";

Deno.test("list-places: the Map is the one Area pool inside the screen radius, the operator's Google calls", () => {
  assert(webBranch.length > 0);
  assert(webBranch.includes("selectAreaPool<OwnedRow>("));
  // A point at the cross inside the screen radius (MESITA-2504): one circle
  // gates the Mesita read and the Google hits alike.
  assert(webBranch.includes("const screenKm = screenRadiusKm(body.bounds, center);"));
  assert(webBranch.includes('const location = { kind: "point" as const, anchor: center, radiusKm };'));
  assert(webBranch.includes("{ center, radiusKm, families: guestSupers, selectedOnly: false },"));
  assert(webBranch.includes("    location,\n"));
  assert(webBranch.includes('fanoutMode: "popular",'));
  assertEquals(src.includes("resolveAreaLocation"), false);
  assert(webBranch.includes("googleCalls: googleFill ? googleCallsForStop(cfg.map.mapGooglePlaces) : 0"));
  assert(webBranch.includes("selectedOnly: false"));
  // The guest never picks a source.
  assertEquals(src.includes("parsePlacesScope"), false);
  for (const gone of ["selectGooglePlaces", "selectMesitaSelected"]) {
    assertEquals(src.includes(gone), false, gone);
  }
});

Deno.test("list-places: no guest review stop; the operator's map.googleMinReviews is the minimum (MESITA-2417)", () => {
  assertEquals(src.includes("guestReviewFloor"), false);
  assertEquals(src.includes("parseMapMinReviews"), false);
  assertEquals(src.includes("body.minReviews"), false);
});

Deno.test("list-places: the circle is the screen's, else map.radiusKm; no client radius, no constant", () => {
  assertEquals(src.includes("nearbyDecision.radiusKm"), false);
  assertEquals(src.includes("body.radiusKm"), false);
  assertEquals(src.includes("NEARBY_RADIUS_KM"), false);
  assert(webBranch.includes("const radiusKm = screenKm ?? cfg.map.radiusKm;"));
});

Deno.test("list-places: Proximity^a × Popularity^1 × Selected^1, reach = the radius (MESITA-2504)", () => {
  assert(webBranch.includes("const weights = areaWeights(cfg.map);"));
  // The Map's reload throttle is the operator's (MESITA-2444); the dead pair is not sent.
  assert(webBranch.includes("reloadIdleSec: cfg.map.reloadIdleSec,"));
  assertEquals(webBranch.includes("reloadMinKm"), false);
  assert(webBranch.includes("signals: { reachKm: radiusKm, weights },"));
  // The guest picks no mode (MESITA-2499).
  assertEquals(src.includes("readAreaMode("), false);
  assertEquals(src.includes("body.prefer"), false);
});

Deno.test("list-places: the answer carries the radius, the weights and each place's score (MESITA-2504)", () => {
  const answer = webBranch.slice(webBranch.indexOf("return json({\n    ok: true,"));
  assert(answer.includes("    radiusKm,\n"));
  assert(answer.includes("    weights,\n"));
  assert(answer.includes("proximity: a.signals.proximity,"));
  assert(answer.includes("popularity: a.signals.popularity,"));
  assert(answer.includes("final: a.final,"));
});

Deno.test("list-places: the old merge-and-paint branch is gone", () => {
  for (const gone of ["reorderListedLanes", "claimOwnedHits", "googleStub(", "parsePlacesScope"]) {
    assertEquals(src.includes(gone), false, gone);
  }
});

Deno.test("list-places: web Search's POST is the only call it answers (MESITA-2337)", () => {
  assert(src.includes('rejectUnlessMethods(req, "POST")'));
  assertEquals(src.includes('"GET"'), false);
  // No `google: true`, or no centre: refused before any read.
  const refusal = src.slice(src.indexOf("decideNearby("), src.indexOf("loadDiscoveryConfig("));
  assert(refusal.includes("!wantsGoogleFill("));
  assert(refusal.includes('code: "web_search_only"'));
  // The listed lane and the newest-first lane are gone, and the operator
  // filters only they read went with them.
  for (
    const gone of [
      "cfg.filters",
      "applyDiscoveryFilters",
      "listedMapFilters",
      "admitMapCatalog",
      "mergeNearbyCatalog",
      "admitsScopeRow",
      'order("created_at"',
    ]
  ) {
    assertEquals(src.includes(gone), false, gone);
  }
});
