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

Deno.test("validateConsumerPatch: accepts the class slot when origin is 'invitation' with null expiry", () => {
  const res = validateConsumerPatch({
    class_key: "diamond",
    class_origin: "invitation",
    class_expires_at: null,
  });
  assert(res.ok);
});

Deno.test("validateConsumerPatch: accepts the class slot when origin is default and expiry is null", () => {
  const res = validateConsumerPatch({
    class_key: "bronze",
    class_origin: "default",
    class_expires_at: null,
    plan: "free",
  });
  assert(res.ok);
});

// Guard test 2's class leg (MESITA-1282, split from MESITA-1247's guard
// test 2 "closed-key-sets: class, function, channel"). class_key is FK-
// enforced by Postgres (consumers_tier_key_fkey -> classes(key)) against the
// LEGACY v11 bridge keys — verified live: public.classes holds exactly
// standard/influencer/premium/aura today. Mirrors ChannelSet/
// FUNCTION_STATE_KEYS's accept-every-legal-reject-one-unknown pattern.
Deno.test("validateConsumerPatch: class_key accepts every metal, rejects an unknown one", () => {
  for (const key of ["bronze", "silver", "gold", "diamond"]) {
    assert(validateConsumerPatch({ class_key: key }).ok, `${key} should be legal`);
  }
  const res = validateConsumerPatch({ class_key: "standard" });
  assert(!res.ok, "legacy keys are no longer stored");
});

Deno.test("invitation_class_key: same closed set as class_key, plus null to clear", () => {
  for (const key of ["bronze", "silver", "gold", "diamond"]) {
    assert(
      validateConsumerPatch({ invitation_class_key: key, invitation_granted_at: "2026-08-23T00:00:00Z" }).ok,
      `${key} should be legal`,
    );
  }
  assert(validateConsumerPatch({ invitation_class_key: null, invitation_granted_at: null }).ok);
  const res = validateConsumerPatch({
    invitation_class_key: "aura",
    invitation_granted_at: "2026-08-23T00:00:00Z",
  });
  assert(!res.ok, "aura is a retired class_key");
});

Deno.test("validateConsumerPatch: accepts a matched invitation grant and a matched revoke", () => {
  const grant = validateConsumerPatch({
    invitation_class_key: "diamond",
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

Deno.test("validateConsumerPatch: accepts deleted_at ISO or null", () => {
  assert(validateConsumerPatch({ deleted_at: "2026-08-25T02:45:00.000Z" }).ok);
  assert(validateConsumerPatch({ deleted_at: null }).ok);
});

Deno.test("validateConsumerPatch: rejects a non-string deleted_at", () => {
  const res = validateConsumerPatch({ deleted_at: 1 });
  assert(!res.ok);
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
  const sub = validateConsumerPatch({ class_origin: "subscription" });
  assert(!sub.ok, "subscription is a plan, not a class origin");
});

Deno.test("validateConsumerPatch: rejects a non-null class_expires_at", () => {
  const res = validateConsumerPatch({
    class_origin: "instagram",
    class_expires_at: "2026-09-01T00:00:00Z",
  });
  assert(!res.ok);
});

Deno.test("validateConsumerPatch: rejects an invitation pair that's half-set", () => {
  const halfGrant = validateConsumerPatch({
    invitation_class_key: "diamond",
    invitation_granted_at: null,
  });
  const halfRevoke = validateConsumerPatch({
    invitation_class_key: null,
    invitation_granted_at: "2026-08-23T00:00:00Z",
  });
  assert(!halfGrant.ok);
  assert(!halfRevoke.ok);
});

Deno.test("validateConsumerPatch: accepts plan free|premium", () => {
  assert(validateConsumerPatch({ plan: "free" }).ok);
  assert(validateConsumerPatch({ plan: "premium" }).ok);
  assert(!validateConsumerPatch({ plan: "pro" }).ok);
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
