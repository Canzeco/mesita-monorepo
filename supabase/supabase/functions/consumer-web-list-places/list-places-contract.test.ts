// consumer-web-list-places on the shared engine (MESITA-2302, one pool since
// MESITA-2379). Source pins for the wiring the engine's own behavioural suite
// (area-pipeline.test) cannot see: the one pool on the visible map
// (MESITA-2499), one Google call, the fallback circle, and that web Search's
// call is the only one it answers (MESITA-2337).
import { assert, assertEquals } from "jsr:@std/assert@1";

const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
const anchor = src.indexOf("const center = { lat: nearbyDecision.lat");
const webBranch = anchor >= 0 ? src.slice(anchor) : "";

Deno.test("list-places: the Map is the visible map's view of the one Area pool, one Google call", () => {
  assert(webBranch.length > 0);
  assert(webBranch.includes("selectAreaPool<OwnedRow>("));
  // The visible map (MESITA-2499); no bounds falls back to the point.
  assert(webBranch.includes("const location = resolveAreaLocation(body.bounds, center, radiusKm);"));
  assert(webBranch.includes('bounds: location.kind === "area" ? location.bounds : null,'));
  assert(webBranch.includes("    location,\n"));
  assert(webBranch.includes("googleCalls: googleFill ? 1 : 0"));
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

Deno.test("list-places: the one circle is map.radiusKm; no client radius, no constant", () => {
  assertEquals(src.includes("nearbyDecision.radiusKm"), false);
  assertEquals(src.includes("NEARBY_RADIUS_KM"), false);
  assert(webBranch.includes("const radiusKm = cfg.map.radiusKm;"));
});

Deno.test("list-places: best first; the guest's Nearby / Popular is gone (MESITA-2499)", () => {
  assert(webBranch.includes('const mode: AreaMode = "popular";'));
  assertEquals(src.includes("readAreaMode("), false);
  assertEquals(src.includes("body.prefer"), false);
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
