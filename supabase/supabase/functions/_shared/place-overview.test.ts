// The place page's one read (MESITA-2180): `_shared/place-overview.ts`,
// served by business-web-get-place since the whole place page moved to the
// Business app (MESITA-3104; admin-web-get-overview retired). The door lets
// in whoever runs the place and Mesita staff, and only staff get the
// internal fields.
//
// A SOURCE TEST, deliberately: these are shape claims about one handler, and
// the shape is what a later reader would undo.
import { assertEquals } from "jsr:@std/assert@1";

const SRC = await Deno.readTextFile(
  new URL("../business-web-get-place/index.ts", import.meta.url),
);
// The read moved to a shared module (MESITA-3103); its shape claims follow it.
const READ_SRC = await Deno.readTextFile(new URL("./place-overview.ts", import.meta.url));

/** Comments name what they deleted, so a "not present" assertion must never
 *  pass or fail on somebody explaining themselves. */
const strip = (src: string) =>
  src.split("\n")
    .filter((l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("*") && !l.trimStart().startsWith("/*"))
    .join("\n");
const CODE = strip(SRC);
const READ = strip(READ_SRC);

Deno.test("the place read asks who the caller is before it reads", () => {
  assertEquals(CODE.includes("requirePlaceAccess(admin, user, placeId)"), true);
  assertEquals(CODE.indexOf("requirePlaceAccess(") < CODE.indexOf("buildPlaceOverview("), true);
  // Only Mesita staff get the internal fields.
  assertEquals(CODE.includes('internal: access.role === "superadmin"'), true);
  for (const memberGate of ["requireMembership(", "requireEditor(", "requireOwner("]) {
    assertEquals(CODE.includes(memberGate), false, `${memberGate} is a business gate`);
  }
});

Deno.test("families resolve inside the one read, from the stored keys", () => {
  assertEquals(READ.includes("resolveStoredFamily("), true);
  // The category↔family dictionary is gone (MESITA-2891): no per-category families.
  assertEquals(READ.includes("categoriesWithFamilyDisplay("), false);
});

Deno.test("overview returns the vote threshold", () => {
  assertEquals(READ.includes("loadRequestThreshold("), true);
  assertEquals(READ.includes("request_threshold: requestThreshold"), true);
});

Deno.test("overview carries Profile Stats from place_activity", () => {
  assertEquals(READ.includes("fetchPlaceProfileStats("), true);
  assertEquals(READ.includes("place.profile_stats = profileStats"), true);
});

Deno.test("the place row and its enrichment map are read together", () => {
  // One round trip for both (MESITA-1249): the State box's `enriched`
  // high-water must come from the same request as the row it sits on.
  assertEquals(READ.includes("await Promise.all(["), true);
  assertEquals((READ.match(/from\("profiles"\)/g) ?? []).length, 1);
  assertEquals((READ.match(/from\("place_profiles"\)/g) ?? []).length, 1);
});
