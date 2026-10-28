// admin-web-get-overview is the business overview's super-admin branch and
// NOTHING ELSE (MESITA-2090).
//
// It was business-web-get-overview, which served the business console's
// sidebar, its Place screen and — through one branch — admin's Single Place.
// The business console is deleted in the MVP First Stage cut, so the rename
// kept the admin branch alone.
//
// A SOURCE TEST, deliberately: these are shape claims about one handler, and
// the shape is what a later reader would undo.
import { assertEquals } from "jsr:@std/assert@1";

const SRC = await Deno.readTextFile(
  new URL("../admin-web-get-overview/index.ts", import.meta.url),
);

/** Comments name what they deleted, so a "not present" assertion must never
 *  pass or fail on somebody explaining themselves. */
const CODE = SRC.split("\n")
  .filter((l) => !l.trimStart().startsWith("//") && !l.trimStart().startsWith("*") && !l.trimStart().startsWith("/*"))
  .join("\n");

Deno.test("admin-web-get-overview is super-admin only", () => {
  assertEquals(CODE.includes('requireAdminRequest(req, "POST")'), true);
  // The guard runs before the body is even read.
  assertEquals(
    CODE.indexOf("requireAdminRequest(") < CODE.indexOf("readJsonOr<"),
    true,
  );
  for (const memberGate of ["requireMembership(", "requireEditor(", "requireOwner("]) {
    assertEquals(CODE.includes(memberGate), false, `${memberGate} is a business gate`);
  }
});

Deno.test("families resolve inside the one read, from the stored keys", () => {
  assertEquals(CODE.includes("resolveStoredFamily("), true);
  // The category↔family dictionary is gone (MESITA-2891): no per-category families.
  assertEquals(CODE.includes("categoriesWithFamilyDisplay("), false);
  assertEquals(CODE.includes("admin-web-get-atlas-fields"), false);
});

Deno.test("overview returns the vote threshold", () => {
  assertEquals(CODE.includes("loadRequestThreshold("), true);
  assertEquals(CODE.includes("request_threshold: requestThreshold"), true);
});

Deno.test("overview carries Profile Stats from place_activity", () => {
  assertEquals(CODE.includes("fetchPlaceProfileStats("), true);
  assertEquals(CODE.includes("profile_stats: profileStats"), true);
});

Deno.test("the place row and its enrichment map are read together", () => {
  // One round trip for both (MESITA-1249): the State box's `enriched`
  // high-water must come from the same request as the row it sits on.
  assertEquals(CODE.includes("await Promise.all(["), true);
  assertEquals((CODE.match(/from\("profiles"\)/g) ?? []).length, 1);
  assertEquals((CODE.match(/from\("place_profiles"\)/g) ?? []).length, 1);
});
