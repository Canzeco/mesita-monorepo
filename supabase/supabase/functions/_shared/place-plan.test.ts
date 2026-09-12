// MESITA-1740 — the operator's Partnership door is NARROW, not a twin of
// admin-web-set-plan. A plain twin would let a client grant itself Verified
// (plan=pro). This file pins the shape that refuses that.
import { assert, assertStringIncludes } from "jsr:@std/assert@1";

const ADMIN_DOOR = new URL("../admin-web-set-plan/index.ts", import.meta.url);
const BUSINESS_DOOR = new URL(
  "../business-web-set-partnership/index.ts",
  import.meta.url,
);

const read = async (url: URL) => await Deno.readTextFile(url);

function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

Deno.test("the admin door stays the entitlement door", async () => {
  const admin = codeOnly(await read(ADMIN_DOOR));
  assertStringIncludes(admin, "requireSuperAdmin(");
  assertStringIncludes(admin, "body.plan");
});

Deno.test("the business door does not take a plan field", async () => {
  const business = codeOnly(await read(BUSINESS_DOOR));
  assertStringIncludes(business, "requireEditor(");
  assert(
    !business.includes("requireSuperAdmin("),
    "the business door must not require a super-admin",
  );
  assertStringIncludes(business, '"plan_not_accepted"');
  assertStringIncludes(business, '"join"');
  assertStringIncludes(business, '"drop"');
  assertStringIncludes(business, '"strategy"');
  // Join writes pro internally — that is the free partnership. The client
  // must not be able to pick the value.
  assertStringIncludes(business, 'nextPlan = joining ? "pro" : "free"');
  assert(
    !business.includes('"ultra"'),
    "a business caller must not be able to reach ultra through this door",
  );
});
