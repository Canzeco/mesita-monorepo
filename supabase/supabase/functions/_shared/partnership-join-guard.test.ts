// MESITA-1889 — the failure this file prevents: an EDITOR at a place that
// never bought a Mesita Membership posts
// `business-web-set-partnership {action:"join"}` and the place comes back
// `plan=pro` — Mesita Partner, the paid entitlement — for nothing.
//
// That was the shape on main. `join` sat behind `requireEditor` and asked
// nothing about entitlement, while the only thing that is supposed to buy
// Partner is the yearly Membership (MESITA-1877).
//
// So `join` carries two gates that `drop` and `strategy` must NOT: the place
// is `partnered`, and the caller owns it. Locking those two would break the
// Capabilities tab, which is every held role except viewer — which is the
// second failure this file prevents, in the other direction.
//
// MESITA-1889 ASKED THE HOLDER ORGANIZATION those two questions. MESITA-1892
// removed the layer, so the place answers them itself — and the gates did not
// weaken in the move: `places.partnered` is the same entitlement fact the
// organization's column held, and `requireOwner` on the place is the same rank
// `requireOrgRole(["owner"])` demanded of the holder.
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

Deno.test("join refuses a place that is not partnered", () => {
  const block = joinBlock(door);
  assert(
    block.includes("row.partnered"),
    "join must read the place's own `partnered` — the entitlement fact itself",
  );
  assert(
    block.includes('code: "place_not_partnered"'),
    "the refusal needs a code the console can branch on",
  );
  // It rides the select the handler already makes, so the gate costs no extra
  // round trip. A second read here would be a second answer waiting to differ.
  assert(
    door.includes("plan_forfeited_at, partnered"),
    "`partnered` must ride the existing place read, not a query of its own",
  );
});

Deno.test("join is owner-only, and says the real reason first", () => {
  const block = joinBlock(door);
  assert(
    /requireOwner\(\s*\n?\s*admin,\s*\n?\s*authRes\.user,\s*\n?\s*placeId/.test(block),
    "join must require OWNER on the place",
  );
  const partneredAt = block.indexOf('code: "place_not_partnered"');
  const roleAt = block.indexOf("requireOwner(");
  assert(partneredAt > 0 && roleAt > 0, "both gates must exist");
  assert(
    partneredAt < roleAt,
    "the partnered check runs BEFORE the role check: a non-owner at a " +
      "place that never bought the Membership must hear what is actually " +
      "missing, not a 403",
  );
});

Deno.test("drop and strategy stay at requireEditor — the Capabilities tab", () => {
  assert(
    door.includes("requireEditor("),
    "the door's own auth gate is still editor-level for everyone",
  );
  const guard = joinBlock(door);
  // Both join gates live INSIDE the join block and nowhere else, so dropping a
  // partnership or switching strategy is unaffected by them.
  assert(
    door.split("requireOwner(").length - 1 === 1,
    "exactly one requireOwner call, and it is the join guard's",
  );
  assert(
    guard.includes("requireOwner("),
    "that one call must be inside the join-only block",
  );
  assert(
    door.split('code: "place_not_partnered"').length - 1 ===
      guard.split('code: "place_not_partnered"').length - 1,
    "place_not_partnered must never be reachable from drop or strategy",
  );
});
