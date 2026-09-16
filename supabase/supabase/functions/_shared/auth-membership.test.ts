// The place-membership guard is the WHOLE tenant boundary since MESITA-1892
// removed the organization layer: `place_members` is the only grant, and every
// business/admin EF reaches it through checkMembership / requireMembership /
// requireEditor / requireOwner. Nothing else stands between a caller and
// another place's data, so these tests pin the four properties that make
// "users cannot access another place's data without the appropriate place
// membership" a fact rather than a reading of the source:
//
//   1. THE ROLE LADDER. viewer < editor < owner, each guard refusing exactly
//      the roles beneath it, and no row at all refusing all three.
//   2. THE BYPASS IS A FLAG, NEVER A ROLE. A super-admin with no membership
//      row passes all three guards with `role` still null — because
//      place-ownership.ts `isLastOwnerOfPlace` counts place_members rows with
//      role='owner', and business-web-get-overview attaches the Staff Check
//      PIN on the owner branch. A fabricated 'owner' would corrupt both.
//   3. THE SCOPE IS BOTH HALVES. The read filters on place_id AND manager_id.
//      A guard that filtered on only one would pass every role test above
//      while handing one place's members every other place's data — which is
//      precisely the criterion, so it is asserted against the recorded
//      filters, not inferred from a passing role test.
//   4. THERE IS NO SECOND PATH. The tables the client is asked for are
//      exactly {place_members, super_admins}. Until MESITA-1892 a caller
//      could also arrive via organization_members joined on
//      places.organization_id; this assertion is what keeps that path from
//      quietly growing back, since a re-added join would still satisfy 1-3.
//
// Plus the opacity property inherited from the deleted requireOrgRole: a
// foreign place and a nonexistent place answer the SAME 403 body, so the
// guard never becomes an existence oracle for the catalog.
//
// The client is faked (no network, no DB): the fake records every table it
// is asked for and every .eq() filter, which is what makes 3 and 4 testable
// at all — they are claims about the QUERY, not about the answer.

import { assert, assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { AuthedUser } from "./auth.ts";
import {
  checkMembership,
  requireEditor,
  requireMembership,
  requireOwner,
} from "./auth-membership.ts";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const PLACE = "00000000-0000-4000-8000-0000000000aa";
const OTHER_PLACE = "00000000-0000-4000-8000-0000000000bb";

// A caller WITH an identity, so checkSuperAdmin actually issues its
// super_admins read — the table-set assertion below is only meaningful when
// the super-admin path runs.
const USER = {
  id: USER_ID,
  email: "manager@example.com",
  emailLower: "manager@example.com",
  phone: null,
  appRole: null,
} as AuthedUser;

type Query = { table: string; filters: [string, unknown][] };

/** PostgREST chain stub that RECORDS what was asked, not just what it answers. */
function fakeAdmin(opts: {
  role?: "owner" | "editor" | "viewer" | null;
  superAdmin?: boolean;
}) {
  const queries: Query[] = [];
  const admin = {
    from(table: string) {
      const q: Query = { table, filters: [] };
      queries.push(q);
      const chain = {
        select: () => chain,
        update: () => chain,
        eq: (column: string, value: unknown) => {
          q.filters.push([column, value]);
          return chain;
        },
        is: () => chain,
        maybeSingle: () => {
          if (table === "place_members") {
            return Promise.resolve({
              data: opts.role ? { role: opts.role } : null,
              error: null,
            });
          }
          if (table === "super_admins") {
            return Promise.resolve({
              data: opts.superAdmin
                ? {
                  email: USER.emailLower,
                  phone: null,
                  // Non-null so the backfill write stays out of the way;
                  // it is not what this file is about.
                  user_id: USER_ID,
                }
                : null,
              error: null,
            });
          }
          // Any other table answers empty rather than throwing, so a
          // resurrected second path fails the table-set test with a readable
          // diff naming it — instead of every test in the file exploding on
          // an exception that says nothing about the boundary.
          return Promise.resolve({ data: null, error: null });
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient;
  return { admin, queries };
}

Deno.test("no place_members row and no super-admin flag: role null, all three guards 403", async () => {
  const { admin } = fakeAdmin({});
  const m = await checkMembership(admin, USER, PLACE);
  assertEquals(m.role, null);
  assertEquals(m.isSuperAdmin, false);

  for (
    const guard of [requireMembership, requireEditor, requireOwner]
  ) {
    const res = await guard(fakeAdmin({}).admin, USER, PLACE);
    assert(!res.ok, "a stranger must not pass any guard");
    assertEquals(res.response.status, 403);
  }
});

Deno.test("viewer: requireMembership passes, requireEditor and requireOwner 403", async () => {
  const role = "viewer" as const;
  assertEquals((await checkMembership(fakeAdmin({ role }).admin, USER, PLACE)).role, role);

  const read = await requireMembership(fakeAdmin({ role }).admin, USER, PLACE);
  assert(read.ok);
  assertEquals(read.membership.role, role);

  const write = await requireEditor(fakeAdmin({ role }).admin, USER, PLACE);
  assert(!write.ok, "viewers are read-only on the Team surface");
  assertEquals(write.response.status, 403);

  const own = await requireOwner(fakeAdmin({ role }).admin, USER, PLACE);
  assert(!own.ok);
  assertEquals(own.response.status, 403);
});

Deno.test("editor: requireMembership and requireEditor pass, requireOwner 403", async () => {
  const role = "editor" as const;
  const read = await requireMembership(fakeAdmin({ role }).admin, USER, PLACE);
  assert(read.ok);

  const write = await requireEditor(fakeAdmin({ role }).admin, USER, PLACE);
  assert(write.ok);
  assertEquals(write.membership.role, role);

  // The editor ceiling is what the org path used to be capped at, and it is
  // still the ceiling for everything short of a real place_members owner row.
  const own = await requireOwner(fakeAdmin({ role }).admin, USER, PLACE);
  assert(!own.ok);
  assertEquals(own.response.status, 403);
});

Deno.test("owner: all three guards pass", async () => {
  const role = "owner" as const;
  for (const guard of [requireMembership, requireEditor, requireOwner]) {
    const res = await guard(fakeAdmin({ role }).admin, USER, PLACE);
    assert(res.ok, "an owner passes every guard");
    assertEquals(res.membership.role, role);
    assertEquals(res.membership.isSuperAdmin, false);
  }
});

Deno.test("super-admin with NO membership row: every guard passes, role stays null", async () => {
  const sa = { superAdmin: true };
  const m = await checkMembership(fakeAdmin(sa).admin, USER, PLACE);
  assertEquals(m.isSuperAdmin, true);
  // The bypass is a separate flag. It must NEVER fabricate a role: the
  // one-owner-per-place invariant, ownership transfer, member removal and the
  // Staff Check PIN all count real place_members rows.
  assertEquals(m.role, null);

  for (const guard of [requireMembership, requireEditor, requireOwner]) {
    const res = await guard(fakeAdmin(sa).admin, USER, PLACE);
    assert(res.ok, "the super-admin bypass opens every guard");
    assertEquals(res.membership.role, null);
    assertEquals(res.membership.isSuperAdmin, true);
  }
});

Deno.test("checkMembership scopes the read to BOTH the place AND the caller", async () => {
  const { admin, queries } = fakeAdmin({ role: "owner" });
  await checkMembership(admin, USER, PLACE);

  const reads = queries.filter((q) => q.table === "place_members");
  assertEquals(reads.length, 1, "one read of the grant table, not a fan-out");
  // Dropping either half turns the guard into a cross-place grant: place_id
  // alone answers for anyone at that place, manager_id alone answers for
  // every place the caller belongs to ANYWHERE. Both, or the tenant boundary
  // is not a boundary.
  assertEquals(reads[0].filters, [
    ["place_id", PLACE],
    ["manager_id", USER_ID],
  ]);
});

Deno.test("checkMembership asks for place_members and super_admins — and nothing else", async () => {
  const { admin, queries } = fakeAdmin({ role: "viewer" });
  await checkMembership(admin, USER, PLACE);

  // The whole point of MESITA-1892: one grant table plus the bypass. Any
  // organizations / organization_members / places-join read reappearing here
  // is a second path to another tenant's data, and would pass every other
  // test in this file.
  assertEquals(
    [...new Set(queries.map((q) => q.table))].sort(),
    ["place_members", "super_admins"],
  );
});

Deno.test("a foreign place and a nonexistent place answer the SAME 403 body (opacity)", async () => {
  // Neither read finds a row, so neither answer may reveal WHICH reason —
  // otherwise the guard is a membership oracle over the whole place catalog.
  const foreign = await requireMembership(fakeAdmin({}).admin, USER, OTHER_PLACE);
  const missing = await requireMembership(fakeAdmin({}).admin, USER, "no-such-place");
  assert(!foreign.ok && !missing.ok);
  assertEquals(foreign.response.status, missing.response.status);
  assertEquals(
    await foreign.response.clone().text(),
    await missing.response.clone().text(),
  );

  // Same for the two stricter doors, whose messages are caller-supplied and
  // must not leak the reason either.
  const foreignOwner = await requireOwner(fakeAdmin({ role: "viewer" }).admin, USER, OTHER_PLACE);
  const missingOwner = await requireOwner(fakeAdmin({}).admin, USER, "no-such-place");
  assert(!foreignOwner.ok && !missingOwner.ok);
  assertEquals(
    await foreignOwner.response.clone().text(),
    await missingOwner.response.clone().text(),
  );
});
