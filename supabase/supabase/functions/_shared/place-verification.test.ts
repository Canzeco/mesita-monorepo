// MESITA-1690: three callers (business-web-verify-place,
// admin-web-set-place-verified, business-web-claim-place) now share this one
// writer instead of hand-rolling the insert. The bug this replaces was a
// copy-paste that wrote `method`'s value into `decided_via` — these pin the
// two columns apart so that can't happen again silently.

import { assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { writeApprovedVerification } from "./place-verification.ts";

type Fixture = {
  existing?: { id: string }[];
  existingError?: string;
  insertError?: string;
};

function fakeAdmin(
  fx: Fixture,
  calls: { inserted?: Record<string, unknown> },
): SupabaseClient {
  const chain = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    limit: () =>
      Promise.resolve(
        fx.existingError
          ? { data: null, error: { message: fx.existingError } }
          : { data: fx.existing ?? [], error: null },
      ),
    insert(row: Record<string, unknown>) {
      calls.inserted = row;
      return Promise.resolve(
        fx.insertError
          ? { error: { message: fx.insertError } }
          : { error: null },
      );
    },
  };
  return {
    from() {
      return chain;
    },
  } as unknown as SupabaseClient;
}

const ARGS = {
  placeId: "place_1",
  userId: "user_1",
  userEmail: "owner@example.com",
  method: "mock_code",
  decidedVia: "auto" as const,
};

Deno.test("writes decided_via exactly as passed, never the method value", async () => {
  const calls: { inserted?: Record<string, unknown> } = {};
  const admin = fakeAdmin({ existing: [] }, calls);
  const res = await writeApprovedVerification(admin, ARGS);
  assertEquals(res, { ok: true, verified: true, alreadyVerified: false });
  assertEquals(calls.inserted?.decided_via, "auto");
  assertEquals(calls.inserted?.method, "mock_code");
  assertEquals(calls.inserted?.state, "approved");
});

Deno.test("admin's decidedVia is 'admin', still distinct from method", async () => {
  const calls: { inserted?: Record<string, unknown> } = {};
  const admin = fakeAdmin({ existing: [] }, calls);
  const res = await writeApprovedVerification(admin, {
    ...ARGS,
    method: "manual_contact",
    decidedVia: "admin",
  });
  assertEquals(res, { ok: true, verified: true, alreadyVerified: false });
  assertEquals(calls.inserted?.decided_via, "admin");
  assertEquals(calls.inserted?.method, "manual_contact");
});

Deno.test("an existing approved row short-circuits — no insert, no duplicate", async () => {
  const calls: { inserted?: Record<string, unknown> } = {};
  const admin = fakeAdmin({ existing: [{ id: "v1" }] }, calls);
  const res = await writeApprovedVerification(admin, ARGS);
  assertEquals(res, { ok: true, verified: true, alreadyVerified: true });
  assertEquals(calls.inserted, undefined);
});

Deno.test("a failed lookup surfaces its error, never silently inserts", async () => {
  const calls: { inserted?: Record<string, unknown> } = {};
  const admin = fakeAdmin({ existingError: "boom" }, calls);
  const res = await writeApprovedVerification(admin, ARGS);
  assertEquals(res, { ok: false, error: "boom" });
  assertEquals(calls.inserted, undefined);
});

Deno.test("a failed insert surfaces its error", async () => {
  const calls: { inserted?: Record<string, unknown> } = {};
  const admin = fakeAdmin(
    { existing: [], insertError: "constraint violated" },
    calls,
  );
  const res = await writeApprovedVerification(admin, ARGS);
  assertEquals(res, { ok: false, error: "constraint violated" });
});
