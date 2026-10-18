// consumer-web-list-places on the shared engine (MESITA-2302). Source pins
// for the wiring the engine's own behavioural suite (area-pipeline.test)
// cannot see: which function each scope calls, the one circle, and that no
// review floor can reach the Selected path.
import { assert, assertEquals } from "jsr:@std/assert@1";

const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
const webBranch = src.slice(
  src.indexOf("if (clientGoogle && nearbyDecision.mode === \"ok\")"),
  src.indexOf("// The Mesita lane is Mesita Selected"),
);

Deno.test("list-places: the Google scope is selectGooglePlaces, Selected is the pool query + selectMesitaSelected", () => {
  assert(webBranch.length > 0);
  const google = webBranch.slice(0, webBranch.indexOf("} else {"));
  const selected = webBranch.slice(webBranch.indexOf("} else {"));
  assert(google.includes("selectGooglePlaces<OwnedRow>("));
  assert(selected.includes("selectedPoolQuery("));
  assert(selected.includes("selectMesitaSelected("));
  assertEquals(selected.includes("selectGooglePlaces"), false);
});

Deno.test("list-places: the review floor comes from guestReviewFloor alone, never on Selected", () => {
  const selected = webBranch.slice(webBranch.indexOf("} else {"));
  assertEquals(/minReviews|ReviewFloor|google_review_count/.test(selected), false);
  assert(webBranch.includes("guestReviewFloor(placesScope, rawMinReviews)"));
  assertEquals(src.includes("parseMapMinReviews"), false);
});

Deno.test("list-places: the one circle is map.radiusKm; no client radius, no constant", () => {
  assertEquals(src.includes("nearbyDecision.radiusKm"), false);
  assertEquals(src.includes("NEARBY_RADIUS_KM"), false);
  assert(webBranch.includes("const radiusKm = cfg.map.radiusKm;"));
});

Deno.test("list-places: the old merge-and-paint branch is gone", () => {
  for (const gone of ["reorderListedLanes", "claimOwnedHits", "googleStub("]) {
    assertEquals(src.includes(gone), false, gone);
  }
});
