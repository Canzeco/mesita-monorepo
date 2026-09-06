// The org-role guard is the wall in front of every organization surface —
// legal identity writes, Stripe onboarding, the members list, member adds.
// These tests pin its two behaviors against a stubbed client: role
// resolution, and the opaque 403 (a foreign org and a nonexistent org must
// be indistinguishable — membership checks never become an existence oracle).

import { assert, assertEquals } from "jsr:@std/assert@1";
import { orgRoleFor, requireOrgRole } from "./org-membership.ts";
import type { AuthedUser } from "./auth.ts";

type Row = { role?: string } | null;

/** Minimal PostgREST chain stub: .from().select().eq().eq().maybeSingle(). */
function stubAdmin(row: Row) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: () => Promise.resolve({ data: row, error: null }),
  };
  // deno-lint-ignore no-explicit-any
  return { from: () => chain } as any;
}

const USER = { id: "00000000-0000-4000-8000-000000000001" } as AuthedUser;
const ORG = "00000000-0000-4000-8000-0000000000aa";

Deno.test("orgRoleFor: returns the membership role", async () => {
  assertEquals(await orgRoleFor(stubAdmin({ role: "owner" }), USER, ORG), "owner");
  assertEquals(await orgRoleFor(stubAdmin({ role: "viewer" }), USER, ORG), "viewer");
});

Deno.test("orgRoleFor: no membership row resolves to null", async () => {
  assertEquals(await orgRoleFor(stubAdmin(null), USER, ORG), null);
});

Deno.test("requireOrgRole: allows a listed role and reports it", async () => {
  const res = await requireOrgRole(stubAdmin({ role: "editor" }), USER, ORG, [
    "owner",
    "editor",
  ]);
  assert(res.ok);
  assertEquals(res.role, "editor");
});

Deno.test("requireOrgRole: refuses a role outside the allowed set", async () => {
  const res = await requireOrgRole(stubAdmin({ role: "viewer" }), USER, ORG, [
    "owner",
  ]);
  assert(!res.ok);
  assertEquals(res.response.status, 403);
});

Deno.test("requireOrgRole: non-member and nonexistent org answer the SAME 403 body (opacity)", async () => {
  const nonMember = await requireOrgRole(stubAdmin(null), USER, ORG, ["owner"]);
  const noSuchOrg = await requireOrgRole(stubAdmin(null), USER, "no-such-org", [
    "owner",
  ]);
  assert(!nonMember.ok && !noSuchOrg.ok);
  assertEquals(nonMember.response.status, 403);
  assertEquals(
    await nonMember.response.clone().text(),
    await noSuchOrg.response.clone().text(),
  );
});
