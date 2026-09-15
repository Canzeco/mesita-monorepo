// MESITA-1889 — the failure this file prevents: an EDITOR at an organization
// that never bought a Mesita Membership posts
// `business-web-set-partnership {action:"join"}` and its place comes back
// `plan=pro` — Mesita Partner, the paid entitlement — for nothing.
//
// That was the shape on main. `join` sat behind `requireEditor` and asked
// nothing about the holder organization, while the only thing that is
// supposed to buy Partner is the org's yearly Membership (MESITA-1877).
//
// So `join` carries two gates that `drop` and `strategy` must NOT: the org is
// `partnered`, and the caller owns it. Locking those two would break the
// Capabilities tab, which is every held role except viewer — which is the
// second failure this file prevents, in the other direction.
//
// A source scan, not a request test: the EF's auth chain needs a live
// Supabase project to exercise, and what matters here is which checks exist
// and IN WHICH ORDER.

import { assert } from "jsr:@std/assert@1";

const DOOR = new URL("../business-web-set-partnership/index.ts", import.meta.url);

/** The comments in that file describe these very gates, so the scan reads
 *  code only — otherwise the docblock alone would satisfy every assertion. */
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const door = codeOnly(await Deno.readTextFile(DOOR));

/** The `if (action === "join") { … }` block, brace-matched from its header. */
function joinBlock(src: string): string {
  const head = src.indexOf('if (action === "join")');
  assert(head > 0, "the join-only guard block must exist");
  const open = src.indexOf("{", head);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth += 1;
    if (src[i] === "}") {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  throw new Error("unbalanced braces in the join guard");
}

Deno.test("join refuses a place whose organization is not partnered", () => {
  const block = joinBlock(door);
  assert(
    block.includes("orgIdForPlace(admin, placeId)"),
    "join must resolve the HOLDER organization — a pool place has none",
  );
  assert(
    block.includes('.from("organizations")') && block.includes('"partnered"'),
    "join must read organizations.partnered — the entitlement fact itself",
  );
  assert(
    block.includes('code: "org_not_partnered"'),
    "the refusal needs a code the console can branch on",
  );
});

Deno.test("join is owner-only, and says the real reason first", () => {
  const block = joinBlock(door);
  assert(
    /requireOrgRole\(\s*admin,\s*authRes\.user,\s*orgId,\s*\[\s*\n?\s*"owner",?\s*\n?\s*\]/
      .test(block),
    "join must require OWNER on the holder organization",
  );
  const partneredAt = block.indexOf('code: "org_not_partnered"');
  const roleAt = block.indexOf("requireOrgRole(");
  assert(partneredAt > 0 && roleAt > 0, "both gates must exist");
  assert(
    partneredAt < roleAt,
    "the partnered check runs BEFORE the role check: a non-owner at a " +
      "non-partnered org must hear what is actually missing, not a 403",
  );
});

Deno.test("drop and strategy stay at requireEditor — the Capabilities tab", () => {
  assert(
    door.includes("requireEditor("),
    "the door's own auth gate is still editor-level for everyone",
  );
  const guard = joinBlock(door);
  // The two org gates live INSIDE the join block and nowhere else, so
  // dropping a partnership or switching strategy is unaffected by them.
  assert(
    door.split("requireOrgRole(").length - 1 === 1,
    "exactly one requireOrgRole call, and it is the join guard's",
  );
  assert(
    guard.includes("requireOrgRole("),
    "that one call must be inside the join-only block",
  );
  assert(
    door.split('code: "org_not_partnered"').length - 1 ===
      guard.split('code: "org_not_partnered"').length - 1,
    "org_not_partnered must never be reachable from drop or strategy",
  );
});
