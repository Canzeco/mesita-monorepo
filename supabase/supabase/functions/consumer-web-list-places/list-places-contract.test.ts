// consumer-web-list-places on the shared engine (MESITA-2302, one pool since
// MESITA-2379). Source pins for the wiring the engine's own behavioural suite
// (area-pipeline.test) cannot see: the one pool inside the screen radius
// (MESITA-2504), Mesita's sources only (MESITA-2872), the fallback circle, and that web Search's
// call is the only one it answers (MESITA-2337).
import { assert, assertEquals } from "jsr:@std/assert@1";

const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
const anchor = src.indexOf("const center = { lat: nearbyDecision.lat");
const webBranch = anchor >= 0 ? src.slice(anchor) : "";

Deno.test("list-places: the Map is the one Area pool inside the screen radius, no Google call", () => {
  assert(webBranch.length > 0);
  // Every ready place in the box is ranked, then the kept cards are read
  // (MESITA-2950); no capped single read.
  assert(webBranch.includes("selectMapPool<PoolRow>("));
  assertEquals(src.includes("NEARBY_SCAN_LIMIT"), false);
  // A point at the cross inside the screen radius (MESITA-2504): one circle
  // gates the Mesita read.
  assert(webBranch.includes("const screenKm = screenRadiusKm(body.bounds, center);"));
  assert(webBranch.includes("      center,\n      radiusKm,\n      families: guestSupers,\n"));
  assertEquals(src.includes("resolveAreaLocation"), false);
  // The switches decide the sources, the same as Home's (MESITA-2703).
  for (const gone of ["fanoutMode", "googleCalls", "mesitaLimit", "mapGooglePlaces"]) {
    assertEquals(src.includes(gone), false, gone);
  }
  // Selected is read by no one (MESITA-2925).
  assertEquals(src.includes("selectedOnly"), false);
  // The guest never picks a source.
  assertEquals(src.includes("parsePlacesScope"), false);
  for (const gone of ["selectGooglePlaces", "selectMesitaSelected"]) {
    assertEquals(src.includes(gone), false, gone);
  }
  // No Google Nearby Search, no quota, no key (MESITA-2872).
  for (const gone of ["searchNearby", "areaQuota", "consumeQuota", "lookupOwned", "apiKey"]) {
    assertEquals(src.includes(gone), false, gone);
  }
});

Deno.test("list-places: no guest review stop (MESITA-2417), no reviews minimum at all (MESITA-2721)", () => {
  assertEquals(src.includes("guestReviewFloor"), false);
  assertEquals(src.includes("parseMapMinReviews"), false);
  assertEquals(src.includes("body.minReviews"), false);
});

Deno.test("list-places: the circle is the screen's, else the fixed NO_SCREEN_RADIUS_KM; no client radius (MESITA-3086)", () => {
  assertEquals(src.includes("nearbyDecision.radiusKm"), false);
  assertEquals(src.includes("body.radiusKm"), false);
  assertEquals(src.includes("NEARBY_RADIUS_KM"), false);
  assert(webBranch.includes("const radiusKm = screenKm ?? NO_SCREEN_RADIUS_KM;"));
});

Deno.test("list-places: Proximity × Popularity, no exponents; the radius gates, the half-distance scores (MESITA-2722)", () => {
  assertEquals(src.includes("areaWeights"), false);
  // The Map's reload throttle is the operator's (MESITA-2444); the dead pair is not sent.
  assert(webBranch.includes("reloadIdleSec: cfg.map.reloadIdleSec,"));
  assert(webBranch.includes("reloadMinViewportPct: cfg.map.reloadMinViewportPct,"));
  assertEquals(webBranch.includes("reloadMinKm"), false);
  assertEquals(webBranch.includes("signals:"), false);
  // The guest picks no mode (MESITA-2499).
  assertEquals(src.includes("readAreaMode("), false);
  assertEquals(src.includes("body.prefer"), false);
});

Deno.test("list-places: the answer carries the radius and each place's score, no weights (MESITA-2504, MESITA-2722)", () => {
  const answer = webBranch.slice(webBranch.indexOf("return json({\n    ok: true,"));
  assert(answer.includes("    radiusKm,\n"));
  assertEquals(answer.includes("    weights,\n"), false);
  assert(answer.includes("proximity: a.signals.proximity,"));
  assert(answer.includes("popularity: a.signals.popularity,"));
  assert(answer.includes("final: a.final,"));
  // Retired with the source switches and the Distance penalty (MESITA-2909).
  assertEquals(answer.includes("foundBy"), false);
  assertEquals(answer.includes("distancePenalty"), false);
  assert(src.includes("selectMapPool"));
  assertEquals(answer.includes("selected: a.selected"), false);
});

Deno.test("list-places: the old merge-and-paint branch is gone", () => {
  for (const gone of ["reorderListedLanes", "claimOwnedHits", "googleStub(", "parsePlacesScope"]) {
    assertEquals(src.includes(gone), false, gone);
  }
});

Deno.test("list-places: wire photos via stripInternal before JSON (MESITA-2740)", () => {
  assert(src.includes("wireMapPlace"));
  assert(src.includes("stripInternal"));
  const answer = webBranch.slice(webBranch.indexOf("return json({\n    ok: true,"));
  assert(answer.includes("wireMapPlace("));
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
