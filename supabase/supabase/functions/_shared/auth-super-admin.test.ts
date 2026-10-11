// The super-admin guard is what stands between an admin-web-* EF and the
// operator data it serves. These pin requireSuperAdmin's three answers
// — 401 with no identity on the session, 403 for a caller not in
// super_admins, ok for one who is — and the lookup order (email first, phone
// only when the email misses).
//
// The client is faked (no network, no DB) and records every lookup, so the
// order is asserted against the queries, not inferred from the answer.

import { assert, assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { AuthedUser } from "./auth.ts";
import { checkSuperAdmin, requireSuperAdmin } from "./auth-super-admin.ts";

const USER_ID = "00000000-0000-4000-8000-000000000001";

function user(overrides: Partial<AuthedUser> = {}): AuthedUser {
  return {
    id: USER_ID,
    email: "ops@example.com",
    emailLower: "ops@example.com",
    phone: null,
    appRole: null,
    ...overrides,
  } as AuthedUser;
}

/** super_admins stub: answers a row when the filter matches `match`. */
function fakeAdmin(match: { email?: string; phone?: string } = {}) {
  const lookups: [string, unknown][] = [];
  const admin = {
    from(table: string) {
      assertEquals(table, "super_admins");
      let filter: [string, unknown] | null = null;
      const chain = {
        select: () => chain,
        update: () => chain,
        is: () => chain,
        eq: (column: string, value: unknown) => {
          filter = [column, value];
          return chain;
        },
        maybeSingle: () => {
          if (filter) lookups.push(filter);
          const hit = filter !== null &&
            ((filter[0] === "email" && filter[1] === match.email) ||
              (filter[0] === "phone" && filter[1] === match.phone));
          return Promise.resolve({
            data: hit
              ? { email: match.email ?? "ops@example.com", phone: match.phone ?? null, user_id: USER_ID }
              : null,
            error: null,
          });
        },
      };
      return chain;
    },
  } as unknown as SupabaseClient;
  return { admin, lookups };
}

Deno.test("requireSuperAdmin: no email and no phone on the session is a 401, with no lookup", async () => {
  const { admin, lookups } = fakeAdmin();
  const res = await requireSuperAdmin(admin, user({ email: null, emailLower: null, phone: null }));
  assert(!res.ok);
  assertEquals(res.response.status, 401);
  assertEquals(lookups, []);
});

Deno.test("requireSuperAdmin: a caller not in super_admins is a 403 with the caller's message", async () => {
  const res = await requireSuperAdmin(fakeAdmin().admin, user(), "Only admins can create places.");
  assert(!res.ok);
  assertEquals(res.response.status, 403);
  assertEquals((await res.response.json()).error, "Only admins can create places.");
});

Deno.test("requireSuperAdmin: a listed email passes", async () => {
  const res = await requireSuperAdmin(fakeAdmin({ email: "ops@example.com" }).admin, user());
  assert(res.ok);
});

Deno.test("checkSuperAdmin: email first, phone only when the email misses", async () => {
  const byPhone = fakeAdmin({ phone: "+525500000000" });
  assertEquals(await checkSuperAdmin(byPhone.admin, user({ phone: "+525500000000" })), true);
  assertEquals(byPhone.lookups, [["email", "ops@example.com"], ["phone", "+525500000000"]]);

  const byEmail = fakeAdmin({ email: "ops@example.com" });
  assertEquals(await checkSuperAdmin(byEmail.admin, user({ phone: "+525500000000" })), true);
  assertEquals(byEmail.lookups, [["email", "ops@example.com"]]);
});
