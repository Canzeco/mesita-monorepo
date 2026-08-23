// Guard tests for the consumer aggregate validator + write door
// (MESITA-1247, aggregate 1 of 6 — picked for the smallest bounded write
// surface; see consumer-doc.ts's header for the count).
//
// Run: deno test supabase/functions/_shared/consumer-doc.test.ts
//
// Two groups:
//   1. validateConsumerPatch accept/reject — belt 2 of the two-belt pattern,
//      exercised directly against the invariants documented in consumer-doc.ts.
//   2. writeConsumer — proves the write door actually GATES: an invalid patch
//      never reaches the mock DB (it would throw if `.from()` were called),
//      and a valid patch reaches it through exactly the insert/update shape
//      each caller needs.

import { assert, assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  type ConsumerPatch,
  validateConsumerPatch,
  writeConsumer,
} from "./consumer-doc.ts";

// ── validateConsumerPatch: accept ──────────────────────────────────────────

Deno.test("validateConsumerPatch: accepts a well-formed profile patch", () => {
  const res = validateConsumerPatch({
    first_name: "Ana",
    last_name: "García",
    full_name: "Ana García",
    sex: "female",
    birthday: "2000-05-14",
    country: "MX",
    phone: "+525512345678",
    avatar_url: null,
  });
  assert(res.ok);
});

Deno.test("validateConsumerPatch: accepts privacy flags alone", () => {
  const res = validateConsumerPatch({
    privacy_public: false,
    privacy_show_saves: true,
  });
  assert(res.ok);
});

Deno.test("validateConsumerPatch: accepts code in canonical 0000-0000 format, and null", () => {
  assert(validateConsumerPatch({ code: "1234-5678" }).ok);
  assert(validateConsumerPatch({ code: null }).ok);
});

Deno.test("validateConsumerPatch: accepts the class slot when origin is 'subscription' with a real expiry", () => {
  const res = validateConsumerPatch({
    class_key: "premium",
    class_origin: "subscription",
    class_expires_at: "2026-09-01T00:00:00Z",
  });
  assert(res.ok);
});

Deno.test("validateConsumerPatch: accepts the class slot when origin is not 'subscription' and expiry is null", () => {
  const res = validateConsumerPatch({
    class_key: "standard",
    class_origin: "default",
    class_expires_at: null,
  });
  assert(res.ok);
});

Deno.test("validateConsumerPatch: accepts a matched invitation grant and a matched revoke", () => {
  const grant = validateConsumerPatch({
    invitation_class_key: "aura",
    invitation_granted_at: "2026-08-23T00:00:00Z",
  });
  const revoke = validateConsumerPatch({
    invitation_class_key: null,
    invitation_granted_at: null,
  });
  assert(grant.ok);
  assert(revoke.ok);
});

Deno.test("validateConsumerPatch: accepts the Instagram door fact (handle + followers)", () => {
  const res = validateConsumerPatch({
    instagram_handle: "cafe.central",
    instagram_followers_count: 5000,
  });
  assert(res.ok);
});

// ── validateConsumerPatch: reject ──────────────────────────────────────────

Deno.test("validateConsumerPatch: rejects a non-object input", () => {
  assert(!validateConsumerPatch(null).ok);
  assert(!validateConsumerPatch("nope").ok);
  assert(!validateConsumerPatch([1, 2, 3]).ok);
  assert(!validateConsumerPatch(42).ok);
});

Deno.test("validateConsumerPatch: rejects an unknown field (closed key set)", () => {
  const res = validateConsumerPatch({ id: "some-uuid" });
  assert(!res.ok);
  const res2 = validateConsumerPatch({ is_admin: true });
  assert(!res2.ok);
});

Deno.test("validateConsumerPatch: rejects a malformed code", () => {
  assert(!validateConsumerPatch({ code: "12345678" }).ok, "no dash");
  assert(!validateConsumerPatch({ code: "123-4567" }).ok, "wrong grouping");
  assert(!validateConsumerPatch({ code: "ABCD-EFGH" }).ok, "non-digits");
});

Deno.test("validateConsumerPatch: rejects sex = 'other' — dropped from the product (MESITA-727)", () => {
  const res = validateConsumerPatch({ sex: "other" });
  assert(!res.ok);
});

Deno.test("validateConsumerPatch: rejects a malformed Instagram handle", () => {
  assert(!validateConsumerPatch({ instagram_handle: "Not_Lower" }).ok, "uppercase");
  assert(!validateConsumerPatch({ instagram_handle: "a".repeat(31) }).ok, "too long");
  assert(!validateConsumerPatch({ instagram_handle: "has space" }).ok, "space");
});

Deno.test("validateConsumerPatch: rejects a negative or fractional follower count", () => {
  assert(!validateConsumerPatch({ instagram_followers_count: -1 }).ok);
  assert(!validateConsumerPatch({ instagram_followers_count: 12.5 }).ok);
});

Deno.test("validateConsumerPatch: rejects a class_origin outside the closed set", () => {
  const res = validateConsumerPatch({ class_origin: "gifted" });
  assert(!res.ok);
});

Deno.test("validateConsumerPatch: rejects a non-subscription origin carrying a real expiry", () => {
  const res = validateConsumerPatch({
    class_origin: "instagram",
    class_expires_at: "2026-09-01T00:00:00Z",
  });
  assert(!res.ok);
});

Deno.test("validateConsumerPatch: rejects an invitation pair that's half-set", () => {
  const halfGrant = validateConsumerPatch({
    invitation_class_key: "aura",
    invitation_granted_at: null,
  });
  const halfRevoke = validateConsumerPatch({
    invitation_class_key: null,
    invitation_granted_at: "2026-08-23T00:00:00Z",
  });
  assert(!halfGrant.ok);
  assert(!halfRevoke.ok);
});

Deno.test("validateConsumerPatch: rejects a malformed birthday", () => {
  assert(!validateConsumerPatch({ birthday: "05/14/2000" }).ok);
  assert(!validateConsumerPatch({ birthday: "not-a-date" }).ok);
});

// ── writeConsumer: the write door itself ───────────────────────────────────

/** Throws if the mock's .from() is ever called — proves validation gates
 * before any DB call happens. */
function unreachableAdmin(): SupabaseClient {
  return {
    from() {
      throw new Error("writeConsumer must not reach the DB on an invalid patch");
    },
  } as unknown as SupabaseClient;
}

Deno.test("writeConsumer: an invalid patch never reaches the DB", async () => {
  const admin = unreachableAdmin();
  // A real caller decodes HTTP JSON as `unknown` and casts to ConsumerPatch
  // before calling the write door — the same bypass of Belt 1 (the compiler)
  // this cast simulates. Belt 2 (validateConsumerPatch, run inside
  // writeConsumer below) is what catches an invalid value once TypeScript
  // can no longer see it.
  const invalidPatch = { sex: "other" } as unknown as ConsumerPatch;
  const res = await writeConsumer(admin, {
    mode: "update",
    id: "11111111-1111-1111-1111-111111111111",
    patch: invalidPatch,
  });
  assert(!res.ok);
  assertEquals(res.error, "sex must be 'male', 'female', or null");
});

// Minimal Supabase mock recording the last insert/update call, matching the
// fakeAdmin() shape stripe-billing.test.ts already uses for this codebase.
function fakeConsumerAdmin(opts: { row?: Record<string, unknown>; errorCode?: string } = {}): {
  admin: SupabaseClient;
  calls: { op: "insert" | "update"; value: Record<string, unknown> }[];
} {
  const calls: { op: "insert" | "update"; value: Record<string, unknown> }[] = [];
  const error = opts.errorCode ? { message: "conflict", code: opts.errorCode } : null;
  const builder = {
    insert(value: Record<string, unknown>) {
      calls.push({ op: "insert", value });
      return {
        select: () => ({ single: () => Promise.resolve({ data: opts.row ?? null, error }) }),
        then: (resolve: (v: unknown) => void) => resolve({ data: null, error }),
      };
    },
    update(value: Record<string, unknown>) {
      calls.push({ op: "update", value });
      return {
        eq: () => ({
          select: () => ({ single: () => Promise.resolve({ data: opts.row ?? null, error }) }),
          then: (resolve: (v: unknown) => void) => resolve({ data: null, error }),
        }),
      };
    },
  };
  const admin = {
    from: () => builder,
  } as unknown as SupabaseClient;
  return { admin, calls };
}

Deno.test("writeConsumer: update mode writes exactly the validated patch, no select", async () => {
  const { admin, calls } = fakeConsumerAdmin();
  const res = await writeConsumer(admin, {
    mode: "update",
    id: "consumer-1",
    patch: { instagram_followers_count: 3000 },
  });
  assert(res.ok);
  assertEquals(res.row, null);
  assertEquals(calls, [{ op: "update", value: { instagram_followers_count: 3000 } }]);
});

Deno.test("writeConsumer: insert mode with select returns the re-read row", async () => {
  const { admin } = fakeConsumerAdmin({ row: { id: "consumer-1", code: "1234-5678" } });
  const res = await writeConsumer(admin, {
    mode: "insert",
    id: "consumer-1",
    patch: { code: "1234-5678" },
    select: "id, code",
  });
  assert(res.ok);
  assertEquals(res.row, { id: "consumer-1", code: "1234-5678" });
});

Deno.test("writeConsumer: surfaces the Postgres error code for a unique-violation retry", async () => {
  const { admin } = fakeConsumerAdmin({ errorCode: "23505" });
  const res = await writeConsumer(admin, {
    mode: "insert",
    id: "consumer-1",
    patch: { code: "1234-5678" },
  });
  assert(!res.ok);
  assertEquals(res.code, "23505");
});
