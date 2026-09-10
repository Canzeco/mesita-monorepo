// MESITA-1736 — the four acceptance intent bits have TWO doors and ONE body.
//
// `admin-web-set-place-rails` was the only writer, and it is
// `requireSuperAdmin`. The Capabilities tab that drives it renders for every
// held role but viewer, so every switch on it 403'd for anyone outside
// `public.super_admins` — which, on the live database of 2026-09-10, meant
// everyone except the one person who is both the only super-admin and the
// only organization member. It worked for the only account that had ever
// opened the page.
//
// The EF NAME IS THE ACL (root CLAUDE.md), so the fix is a second door rather
// than a widened one: `business-web-set-place-rails` with `requireEditor`.
// What these assertions protect is that the SPLIT stayed a split — two
// guards, one body. A rail contract copied into the second door is a contract
// that will drift, and the failure mode is silent: a key one door knows and
// the other does not returns 200 OK and writes nothing.

import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { RAIL_COLUMNS } from "./place-rails.ts";

const ADMIN_DOOR = new URL("../admin-web-set-place-rails/index.ts", import.meta.url);
const BUSINESS_DOOR = new URL("../business-web-set-place-rails/index.ts", import.meta.url);

const read = async (url: URL) => await Deno.readTextFile(url);

/** Comments here explain the guards and therefore name them; the assertions
 *  read code only, so an honest explanation never reads as a regression. */
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

Deno.test("the rail contract is stated once", () => {
  assertEquals(Object.keys(RAIL_COLUMNS), ["mesita_pay", "credits", "pickup", "delivery"]);
  assertEquals(Object.values(RAIL_COLUMNS), [
    "mesita_pay_enabled",
    "credits_enabled",
    "pickup_orders_enabled",
    "delivery_orders_enabled",
  ]);
});

Deno.test("neither door re-declares the rail contract", async () => {
  for (const [name, url] of [["admin", ADMIN_DOOR], ["business", BUSINESS_DOOR]] as const) {
    const code = codeOnly(await read(url));
    assert(
      !code.includes("RAIL_COLUMNS ="),
      `${name}-web-set-place-rails declares its own RAIL_COLUMNS — the two doors would drift`,
    );
    assertStringIncludes(
      code,
      '"../_shared/place-rails.ts"',
      `${name}-web-set-place-rails does not share the body`,
    );
  }
});

Deno.test("the two doors differ in exactly one thing: who may open them", async () => {
  const admin = codeOnly(await read(ADMIN_DOOR));
  const business = codeOnly(await read(BUSINESS_DOOR));

  assertStringIncludes(admin, "requireSuperAdmin(");
  assert(!admin.includes("requireEditor("), "the admin door must stay super-admin only");

  // requireEditor is the server-side mirror of `visibleTabs()`: Capabilities
  // renders for every held role except viewer, and requireEditor passes
  // owner + editor (super-admins too, so the split locks nobody out).
  assertStringIncludes(business, "requireEditor(");
  assert(
    !business.includes("requireSuperAdmin("),
    "the business door must not require a super-admin — that is the bug this split fixed",
  );
  // A place-scoped guard needs the place before it can run. Reading the body
  // after the guard is how a door ends up guarding nothing.
  assert(
    business.indexOf("readRailPlaceId(") < business.indexOf("requireEditor("),
    "the business door must resolve the place before it checks the role on it",
  );
});
