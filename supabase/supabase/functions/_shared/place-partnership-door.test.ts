// MESITA-1798 — Partner is a NARROW door: a boolean, never a plan field.
// Re-pointed at the place by MESITA-1892; the door itself did not widen.
//
// THE DOOR IS `business-web-set-partner-status`, NOT `-set-place-partnership`.
// This file named the latter and so read a folder that never existed: the
// repo already has `business-web-set-partnership` (plan and rate strategy),
// and two money doors one letter apart is how the wrong one gets edited, so
// the rename landed on the bit it owns. A guard pointed at a missing file
// throws instead of asserting, which is the one failure mode a guard must
// not have.
import { assert, assertStringIncludes } from "jsr:@std/assert@1";

const DOOR = new URL("../business-web-set-partner-status/index.ts", import.meta.url);
const BODY = new URL("./place-partnership.ts", import.meta.url);

const read = async (url: URL) => await Deno.readTextFile(url);

function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

Deno.test("the Partner door does not take a plan field", async () => {
  const door = codeOnly(await read(DOOR));
  assertStringIncludes(door, "requireOwner(");
  assertStringIncludes(door, "setPlacePartnership(");
  assert(
    !door.includes("body.plan"),
    "a client must not pick plan through the Partner door",
  );
});

Deno.test("the Partner body lives once, in _shared", async () => {
  const door = codeOnly(await read(DOOR));
  const body = codeOnly(await Deno.readTextFile(BODY));
  assertStringIncludes(door, '"../_shared/place-partnership.ts"');
  assert(
    !door.includes("mesita_pay_enabled"),
    "the door must not re-declare the cascade — that is how it would drift from claim-place",
  );
  // INVERTED BY MESITA-1892. This asserted `mesita_pay_enabled: partnered` —
  // that turning Partner on is what writes the Mesita Pay package. There were
  // two pay bits then, the organization's and the place's, and this switch
  // owned the org's half. The org layer is gone, the two collapsed into one
  // column on `place_profiles`, and that column has exactly ONE writer,
  // `_shared/place-rails.ts`. So the rule is now the opposite one, and it is
  // the stronger of the two: a second writer for a single bit is how a switch
  // and a page end up disagreeing about what is on. It also finishes
  // MESITA-1867/1868 — being granted a partnership must never start charging
  // a restaurant's guests.
  assert(
    !body.includes("mesita_pay_enabled"),
    "Partner must not write the Mesita Pay bit — _shared/place-rails.ts is its only writer (MESITA-1892)",
  );
  assert(
    body.includes('"stripe_not_ready"'),
    "Stripe Ready is the lock, and the body is the one that names the 409",
  );
});
