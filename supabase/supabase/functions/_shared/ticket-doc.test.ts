// Guard tests for the ticket aggregate validator + write door (MESITA-1281,
// split off MESITA-1247 — aggregate 4 of 6; consumer-doc.test.ts is
// aggregate 1's reference, same shape).
//
// Run: deno test supabase/functions/_shared/ticket-doc.test.ts
//
// Three groups:
//   1. validateTicketPatch accept/reject — belt 2, exercised directly
//      against the invariants documented in ticket-doc.ts (each one a
//      verbatim mirror of a live Postgres CHECK on visit_tickets).
//   2. writeTicket: gating — proves the write door actually GATES: an
//      invalid patch never reaches the mock DB (it would throw if `.from()`
//      were called).
//   3. writeTicket: the door itself — insert/update/delete reach the mock
//      through exactly the shape each real call site needs, INCLUDING the
//      CAS guard (eq/is/in) and the single-vs-maybeSingle choice — the one
//      extension this aggregate's door carries beyond consumer-doc.ts's.

import { assert, assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  type TicketPatch,
  validateTicketPatch,
  writeTicket,
} from "./ticket-doc.ts";

// ── validateTicketPatch: accept ─────────────────────────────────────────

Deno.test("validateTicketPatch: accepts the identity fields an insert writes", () => {
  const res = validateTicketPatch({
    project_id: "11111111-1111-1111-1111-111111111111",
    consumer_id: "22222222-2222-2222-2222-222222222222",
    opened_by: "22222222-2222-2222-2222-222222222222",
    status: "open",
    story_status: "not_required",
    review_status: "not_required",
    check_code: "abc123",
  });
  assert(res.ok);
});

Deno.test("validateTicketPatch: accepts every live ticket_status label", () => {
  for (
    const s of [
      "open",
      "pending_payment",
      "paid",
      "cancelled",
      "revealed",
      "awaiting_story",
      "awaiting_payment_confirm",
      "scanned",
      "approved",
      "paying",
    ]
  ) {
    assert(validateTicketPatch({ status: s }).ok, s);
  }
});

Deno.test("validateTicketPatch: accepts every live story_status/review_status label", () => {
  for (
    const s of [
      "not_required",
      "pending",
      "submitted",
      "ai_verified",
      "ai_rejected",
      "staff_verified",
      "staff_rejected",
      "self_verified",
    ]
  ) {
    assert(validateTicketPatch({ story_status: s }).ok, s);
    assert(validateTicketPatch({ review_status: s }).ok, s);
  }
});

Deno.test("validateTicketPatch: accepts a zero and a positive money value, rejects nothing at zero", () => {
  assert(validateTicketPatch({ bill_subtotal_cents: 0 }).ok);
  assert(validateTicketPatch({ tip_cents: 15000 }).ok);
  assert(validateTicketPatch({ total_cents: null }).ok);
});

Deno.test("validateTicketPatch: accepts discount_percent and tip_pct at the range edges", () => {
  assert(validateTicketPatch({ discount_percent: 0 }).ok);
  assert(validateTicketPatch({ discount_percent: 100 }).ok);
  assert(validateTicketPatch({ tip_pct: 0 }).ok);
  assert(validateTicketPatch({ tip_pct: 100 }).ok);
});

Deno.test("validateTicketPatch: accepts ojo confidence at the unit-interval edges", () => {
  assert(validateTicketPatch({ story_ojo_confidence: 0 }).ok);
  assert(validateTicketPatch({ story_ojo_confidence: 1 }).ok);
  assert(validateTicketPatch({ review_ojo_confidence: 0.5 }).ok);
});

Deno.test("validateTicketPatch: accepts a fix request within the closed vocabulary and a 200-char note", () => {
  const res = validateTicketPatch({
    fix_requested: "proof",
    fix_note: "x".repeat(200),
  });
  assert(res.ok);
});

Deno.test("validateTicketPatch: accepts clearing a fix (both null) alongside a real status", () => {
  const res = validateTicketPatch({
    fix_requested: null,
    fix_note: null,
    review_status: "self_verified",
  });
  assert(res.ok);
});

Deno.test("validateTicketPatch: accepts approved_at alone, and fix_requested alone (not the same patch)", () => {
  assert(validateTicketPatch({ approved_at: "2026-08-23T00:00:00Z" }).ok);
  assert(validateTicketPatch({ fix_requested: "bill" }).ok);
});

Deno.test("validateTicketPatch: accepts a paid_method of at_place, and clearing it to null", () => {
  assert(validateTicketPatch({ paid_method: "at_place" }).ok);
  assert(validateTicketPatch({ paid_method: null }).ok);
});

Deno.test("validateTicketPatch: accepts rate columns as plain numbers (no invented range)", () => {
  const res = validateTicketPatch({
    welcome_free_rate: 15,
    welcome_premium_rate: 20,
    free_rate: 10,
    premium_rate: 15,
    rates_snapshotted_at: "2026-08-23T00:00:00Z",
  });
  assert(res.ok);
});

// ── validateTicketPatch: reject ─────────────────────────────────────────

Deno.test("validateTicketPatch: rejects a non-object input", () => {
  assert(!validateTicketPatch(null).ok);
  assert(!validateTicketPatch("nope").ok);
  assert(!validateTicketPatch([1, 2, 3]).ok);
  assert(!validateTicketPatch(42).ok);
});

Deno.test("validateTicketPatch: rejects an unknown field (closed key set)", () => {
  const res = validateTicketPatch({ id: "some-uuid" });
  assert(!res.ok);
  const res2 = validateTicketPatch({ waiter_id: "some-uuid" });
  assert(!res2.ok);
});

Deno.test("validateTicketPatch: rejects a status outside the live ticket_status enum", () => {
  const res = validateTicketPatch({ status: "settled" });
  assert(!res.ok);
});

Deno.test("validateTicketPatch: rejects a story_status/review_status outside the live enum", () => {
  assert(!validateTicketPatch({ story_status: "waiter_verified" }).ok, "retired label");
  assert(!validateTicketPatch({ review_status: "verified" }).ok);
});

Deno.test("validateTicketPatch: rejects a negative money value on every *_cents column", () => {
  for (
    const key of [
      "bill_subtotal_cents",
      "tip_cents",
      "total_cents",
      "redeem_cents",
      "discount_cents",
      "approved_discount_cents",
      "approved_amount_due_cents",
    ]
  ) {
    const res = validateTicketPatch({ [key]: -1 });
    assert(!res.ok, key);
  }
});

Deno.test("validateTicketPatch: rejects discount_percent/tip_pct outside 0-100", () => {
  assert(!validateTicketPatch({ discount_percent: -1 }).ok);
  assert(!validateTicketPatch({ discount_percent: 101 }).ok);
  assert(!validateTicketPatch({ tip_pct: 150 }).ok);
});

Deno.test("validateTicketPatch: rejects ojo confidence outside 0-1", () => {
  assert(!validateTicketPatch({ story_ojo_confidence: 1.5 }).ok);
  assert(!validateTicketPatch({ review_ojo_confidence: -0.1 }).ok);
});

Deno.test("validateTicketPatch: rejects an ojo verdict outside pass/unsure/fail", () => {
  assert(!validateTicketPatch({ story_ojo_verdict: "maybe" }).ok);
});

Deno.test("validateTicketPatch: rejects a bill_source outside business/consumer", () => {
  assert(!validateTicketPatch({ bill_source: "staff" }).ok);
});

Deno.test("validateTicketPatch: rejects a fix_requested outside bill/proof/reward", () => {
  assert(!validateTicketPatch({ fix_requested: "refund" }).ok);
});

Deno.test("validateTicketPatch: rejects a fix_note over 200 characters", () => {
  assert(!validateTicketPatch({ fix_note: "x".repeat(201) }).ok);
});

Deno.test("validateTicketPatch: rejects a paid_method outside at_place/mesita", () => {
  assert(!validateTicketPatch({ paid_method: "card" }).ok);
});

Deno.test("validateTicketPatch: rejects approved_at and fix_requested both set in the same patch", () => {
  const res = validateTicketPatch({
    approved_at: "2026-08-23T00:00:00Z",
    fix_requested: "bill",
  });
  assert(!res.ok);
});

Deno.test("validateTicketPatch: rejects a non-string-array ojo reasons value", () => {
  assert(!validateTicketPatch({ story_ojo_reasons: "not an array" }).ok);
  assert(!validateTicketPatch({ review_ojo_reasons: [1, 2, 3] }).ok);
});

// ── writeTicket: gating ─────────────────────────────────────────────────

/** Throws if the mock's .from() is ever called — proves validation gates
 * before any DB call happens. */
function unreachableAdmin(): SupabaseClient {
  return {
    from() {
      throw new Error("writeTicket must not reach the DB on an invalid patch");
    },
  } as unknown as SupabaseClient;
}

Deno.test("writeTicket: an invalid patch never reaches the DB", async () => {
  const admin = unreachableAdmin();
  // A real caller decodes HTTP JSON as `unknown` and casts to TicketPatch
  // before calling the write door — the same Belt-1 bypass this cast
  // simulates. Belt 2 (validateTicketPatch, run inside writeTicket) is what
  // catches an invalid value once TypeScript can no longer see it.
  const invalidPatch = { status: "settled" } as unknown as TicketPatch;
  const res = await writeTicket(admin, {
    mode: "update",
    id: "11111111-1111-1111-1111-111111111111",
    patch: invalidPatch,
  });
  assert(!res.ok);
  assert(res.error.includes("status must be one of"));
});

Deno.test("writeTicket: a same-patch approved_at + fix_requested violation never reaches the DB", async () => {
  const admin = unreachableAdmin();
  const invalidPatch = {
    approved_at: "2026-08-23T00:00:00Z",
    fix_requested: "bill",
  } as unknown as TicketPatch;
  const res = await writeTicket(admin, {
    mode: "update",
    id: "11111111-1111-1111-1111-111111111111",
    patch: invalidPatch,
  });
  assert(!res.ok);
});

// ── writeTicket: the door itself ────────────────────────────────────────

// Minimal Supabase mock recording the last insert/update/delete call and the
// guard predicates applied — same fakeAdmin() shape stripe-billing.test.ts
// and consumer-doc.test.ts already use for this codebase, extended with
// eq/is/in recording since this door's guard is the one thing consumer-doc's
// door didn't need.
type RecordedCall = {
  op: "insert" | "update" | "delete";
  value?: Record<string, unknown>;
  eq: [string, unknown][];
  is: [string, unknown][];
  in: [string, unknown[]][];
  terminal: "single" | "maybeSingle" | "none";
};

function fakeTicketAdmin(
  opts: { row?: Record<string, unknown>; errorCode?: string } = {},
): { admin: SupabaseClient; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const error = opts.errorCode ? { message: "conflict", code: opts.errorCode } : null;

  function makeBuilder(op: "insert" | "update" | "delete", value?: Record<string, unknown>) {
    const call: RecordedCall = { op, value, eq: [], is: [], in: [], terminal: "none" };
    calls.push(call);
    const builder = {
      eq(column: string, v: unknown) {
        call.eq.push([column, v]);
        return builder;
      },
      is(column: string, v: unknown) {
        call.is.push([column, v]);
        return builder;
      },
      in(column: string, v: unknown[]) {
        call.in.push([column, v]);
        return builder;
      },
      select() {
        return builder;
      },
      single() {
        call.terminal = "single";
        return Promise.resolve({ data: opts.row ?? null, error });
      },
      maybeSingle() {
        call.terminal = "maybeSingle";
        return Promise.resolve({ data: opts.row ?? null, error });
      },
      then(resolve: (v: unknown) => void) {
        resolve({ data: null, error });
      },
    };
    return builder;
  }

  const admin = {
    from: () => ({
      insert: (value: Record<string, unknown>) => makeBuilder("insert", value),
      update: (value: Record<string, unknown>) => makeBuilder("update", value),
      delete: () => makeBuilder("delete"),
    }),
  } as unknown as SupabaseClient;
  return { admin, calls };
}

Deno.test("writeTicket: update mode writes exactly the validated patch, no guard, no select", async () => {
  const { admin, calls } = fakeTicketAdmin();
  const res = await writeTicket(admin, {
    mode: "update",
    id: "ticket-1",
    patch: { first_scanned_at: "2026-08-23T00:00:00Z" },
  });
  assert(res.ok);
  assertEquals(res.row, null);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].value, { first_scanned_at: "2026-08-23T00:00:00Z" });
  assertEquals(calls[0].eq, [["id", "ticket-1"]]);
});

Deno.test("writeTicket: update mode applies an is-null guard alongside the id (validate-web-get-ticket's stamp)", async () => {
  const { admin, calls } = fakeTicketAdmin();
  await writeTicket(admin, {
    mode: "update",
    id: "ticket-1",
    patch: { first_scanned_at: "2026-08-23T00:00:00Z" },
    guard: { is: { first_scanned_at: null } },
  });
  assertEquals(calls[0].eq, [["id", "ticket-1"]]);
  assertEquals(calls[0].is, [["first_scanned_at", null]]);
});

Deno.test("writeTicket: update mode applies an eq CAS guard and returns the re-read row via maybeSingle (validate-web-scan-ticket's shape)", async () => {
  const { admin, calls } = fakeTicketAdmin({ row: { id: "ticket-1", status: "scanned" } });
  const res = await writeTicket(admin, {
    mode: "update",
    id: "ticket-1",
    patch: { status: "scanned" },
    guard: { eq: { status: "open" } },
    select: "id, status",
  });
  assert(res.ok);
  assertEquals(res.row, { id: "ticket-1", status: "scanned" });
  assertEquals(calls[0].eq, [["id", "ticket-1"], ["status", "open"]]);
  assertEquals(calls[0].terminal, "maybeSingle");
});

Deno.test("writeTicket: update mode's lost CAS surfaces as row:null under maybeSingle, not an error", async () => {
  const { admin } = fakeTicketAdmin({ row: undefined });
  const res = await writeTicket(admin, {
    mode: "update",
    id: "ticket-1",
    patch: { status: "cancelled" },
    guard: { eq: { status: "open" } },
    select: "id, status",
  });
  assert(res.ok);
  assertEquals(res.row, null);
});

Deno.test("writeTicket: update mode combines eq + is + in guards, single() terminal (validate-web-approve-ticket's shape)", async () => {
  const { admin, calls } = fakeTicketAdmin({ row: { id: "ticket-1" } });
  await writeTicket(admin, {
    mode: "update",
    id: "ticket-1",
    patch: { status: "approved", approved_at: "2026-08-23T00:00:00Z" },
    guard: {
      eq: { status: "scanned" },
      is: { fix_requested: null },
      in: { currency: ["MXN", "USD"] },
    },
    select: "id",
    single: true,
  });
  assertEquals(calls[0].eq, [["id", "ticket-1"], ["status", "scanned"]]);
  assertEquals(calls[0].is, [["fix_requested", null]]);
  assertEquals(calls[0].in, [["currency", ["MXN", "USD"]]]);
  assertEquals(calls[0].terminal, "single");
});

Deno.test("writeTicket: insert mode with select returns the re-read row", async () => {
  const { admin, calls } = fakeTicketAdmin({
    row: { id: "ticket-1", check_code: "abc123", status: "open" },
  });
  const res = await writeTicket(admin, {
    mode: "insert",
    patch: {
      project_id: "11111111-1111-1111-1111-111111111111",
      consumer_id: "22222222-2222-2222-2222-222222222222",
      opened_by: "22222222-2222-2222-2222-222222222222",
      status: "open",
      check_code: "abc123",
    },
    select: "id, check_code, status",
  });
  assert(res.ok);
  assertEquals(res.row, { id: "ticket-1", check_code: "abc123", status: "open" });
  assertEquals(calls[0].op, "insert");
});

Deno.test("writeTicket: surfaces the Postgres error code for a check_code collision retry", async () => {
  const { admin } = fakeTicketAdmin({ errorCode: "23505" });
  const res = await writeTicket(admin, {
    mode: "insert",
    patch: {
      project_id: "11111111-1111-1111-1111-111111111111",
      consumer_id: "22222222-2222-2222-2222-222222222222",
      opened_by: "22222222-2222-2222-2222-222222222222",
      check_code: "abc123",
    },
  });
  assert(!res.ok);
  assertEquals(res.code, "23505");
});

Deno.test("writeTicket: delete mode matches on the given columns verbatim (consumer-web-delete-account's cascade)", async () => {
  const { admin, calls } = fakeTicketAdmin();
  const res = await writeTicket(admin, {
    mode: "delete",
    match: { consumer_id: "22222222-2222-2222-2222-222222222222" },
  });
  assert(res.ok);
  assertEquals(calls[0].op, "delete");
  assertEquals(calls[0].eq, [["consumer_id", "22222222-2222-2222-2222-222222222222"]]);
});
