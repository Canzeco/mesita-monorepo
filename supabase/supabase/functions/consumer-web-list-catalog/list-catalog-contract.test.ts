// consumer-web-list-catalog on the shared engine (MESITA-2302): rails Google
// Places · Mesita Selected · families. Right Now, Universal, the guest
// predicates and the old ranker are gone; the engine draws both lists.
import { assert, assertEquals } from "jsr:@std/assert@1";

const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

Deno.test("list-catalog: both lists come from the shared engine", () => {
  assert(src.includes("selectGooglePlaces<OwnedRow>("));
  assert(src.includes("selectedPoolQuery("));
  assert(src.includes("selectMesitaSelected("));
  assert(src.includes("buildCatalogRails(google.places, selected, cfg.catalog.railCap)"));
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

Deno.test("list-catalog: one circle, and only rail 1 takes the reviews floor", () => {
  assert(src.includes("const radiusKm = cfg.map.radiusKm;"));
  assertEquals(src.includes("nearbyDecision.radiusKm"), false);
  assertEquals(src.includes("NEARBY_RADIUS_KM"), false);
  assertEquals(src.match(/guestReviewFloor\(/g)?.length, 1);
  assert(src.includes('guestReviewFloor("google", body.minReviews)'));
});
