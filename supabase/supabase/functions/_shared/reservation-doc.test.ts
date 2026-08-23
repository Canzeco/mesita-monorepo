// Guard tests for the reservation aggregate validator + write door
// (MESITA-1280, child of MESITA-1247 — aggregate 2 of 6 to route; see
// reservation-doc.ts's header for the write-surface research this scoped
// from).
//
// Run: deno test supabase/functions/_shared/reservation-doc.test.ts
//
// Two groups, mirroring consumer-doc.test.ts's shape:
//   1. validateReservationPatch accept/reject — belt 2 of the two-belt
//      pattern, exercised directly against the invariants documented in
//      reservation-doc.ts.
//   2. writeReservation — proves the write door actually GATES: an invalid
//      patch never reaches the mock DB (it would throw if `.from()` were
//      called), and a valid patch reaches it through exactly the
//      insert/update shape each caller needs, including the `match` guard
//      cancel/confirm call sites rely on.

import { assert, assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  type ReservationPatch,
  validateReservationPatch,
  writeReservation,
} from "./reservation-doc.ts";

// ── validateReservationPatch: accept ───────────────────────────────────────

Deno.test("validateReservationPatch: accepts a well-formed booking-lifecycle patch", () => {
  const res = validateReservationPatch({
    reserved_at: "2026-09-01T20:00:00.000Z",
    party_size: 4,
    status: "pending",
    notes: "window table please",
    consumer_notify: "call",
  });
  assert(res.ok);
});

Deno.test("validateReservationPatch: accepts every reservation_status enum value", () => {
  for (
    const s of [
      "pending",
      "confirmed",
      "declined",
      "no_show",
      "cancelled",
      "unreachable",
      "unresolved",
    ]
  ) {
    assert(validateReservationPatch({ status: s }).ok, s);
  }
});

Deno.test("validateReservationPatch: accepts party_size = 1 (the CHECK boundary)", () => {
  assert(validateReservationPatch({ party_size: 1 }).ok);
});

Deno.test("validateReservationPatch: accepts consumer_notify 'call' and 'app'", () => {
  assert(validateReservationPatch({ consumer_notify: "call" }).ok);
  assert(validateReservationPatch({ consumer_notify: "app" }).ok);
});

Deno.test("validateReservationPatch: accepts an 8-digit reference_code, and null", () => {
  assert(validateReservationPatch({ reference_code: "12345678" }).ok);
  assert(validateReservationPatch({ reference_code: null }).ok);
});

Deno.test("validateReservationPatch: accepts every reported_verdict value, and null", () => {
  for (const v of ["confirmed", "counter_offer", "declined", "unreachable", "wrong_number"]) {
    assert(validateReservationPatch({ reported_verdict: v }).ok, v);
  }
  assert(validateReservationPatch({ reported_verdict: null }).ok);
});

Deno.test("validateReservationPatch: accepts the a1-report-outcome write shape (verdict + alternatives + note, no status)", () => {
  // This is the exact shape eleven-a1-report-outcome writes — proof the
  // validator does NOT force status to travel alongside these fields.
  const res = validateReservationPatch({
    reported_verdict: "counter_offer",
    alternatives: [{ time: "21:30", note: "en la terraza" }],
    outcome_note: "mesa de terraza libre a las 21:30",
  });
  assert(res.ok);
});

Deno.test("validateReservationPatch: accepts status and reported_verdict set together", () => {
  // The OTHER legitimate truth: business-web-confirm-reservation and
  // eleven-a2-confirm-reservation DO set both in one patch. No invariant
  // should forbid this combination either.
  const res = validateReservationPatch({
    status: "confirmed",
    reported_verdict: "confirmed",
    confirmed_at: "2026-08-23T22:00:00.000Z",
  });
  assert(res.ok);
});

Deno.test("validateReservationPatch: accepts every attempts_state / callback_state / notice_state value", () => {
  for (const v of ["idle", "running", "scheduled", "answered", "error", "exhausted", "cancelled"]) {
    assert(validateReservationPatch({ attempts_state: v }).ok, v);
  }
  for (const v of ["none", "scheduled", "ringing", "calling", "answered", "failed", "skipped"]) {
    assert(validateReservationPatch({ callback_state: v }).ok, v);
  }
  for (const v of ["none", "pending", "scheduled", "running", "done", "failed", "skipped"]) {
    assert(validateReservationPatch({ notice_state: v }).ok, v);
  }
});

Deno.test("validateReservationPatch: accepts notice_kind 'venue_cancel' / 'guest_cancel', and null", () => {
  assert(validateReservationPatch({ notice_kind: "venue_cancel" }).ok);
  assert(validateReservationPatch({ notice_kind: "guest_cancel" }).ok);
  assert(validateReservationPatch({ notice_kind: null }).ok);
});

Deno.test("validateReservationPatch: accepts cancelled_by 'consumer' / 'business' / 'agent', and null", () => {
  assert(validateReservationPatch({ cancelled_by: "consumer" }).ok);
  assert(validateReservationPatch({ cancelled_by: "business" }).ok);
  assert(validateReservationPatch({ cancelled_by: "agent" }).ok);
  assert(validateReservationPatch({ cancelled_by: null }).ok);
});

Deno.test("validateReservationPatch: accepts the cancelTicket write shape", () => {
  // _shared/agent-tools.ts's cancelTicket — the shared door 4 callers use.
  const res = validateReservationPatch({
    status: "cancelled",
    cancelled_at: "2026-08-23T22:00:00.000Z",
    cancelled_by: "consumer",
    outcome_note: null,
    attempts_state: "cancelled",
    next_attempt_at: null,
    callback_state: "skipped",
    callback_next_attempt_at: null,
    run_id: "22222222-2222-2222-2222-222222222222",
    claimed_at: null,
    notice_kind: "venue_cancel",
    notice_state: "pending",
    notice_attempts: 0,
    notice_next_at: null,
  });
  assert(res.ok);
});

Deno.test("validateReservationPatch: accepts a structured alternatives array (time+date+note, time-only, note-only)", () => {
  const res = validateReservationPatch({
    alternatives: [
      { time: "21:00", date: "2026-09-02", note: "sin ventana" },
      { time: "22:15" },
      { time: "", note: "afuera cuando quiera" },
    ],
  });
  assert(res.ok);
});

Deno.test("validateReservationPatch: accepts an empty alternatives array (cleared on reschedule)", () => {
  assert(validateReservationPatch({ alternatives: [] }).ok);
});

Deno.test("validateReservationPatch: accepts a structured attempts array", () => {
  const res = validateReservationPatch({
    attempts: [
      { n: 1, started_at: "2026-08-23T20:00:00.000Z", conversation_id: "conv_1", result: "no_answer" },
      { n: 2, started_at: "2026-08-23T20:10:00.000Z", conversation_id: null, result: "error" },
    ],
  });
  assert(res.ok);
});

Deno.test("validateReservationPatch: accepts non-negative counters at zero", () => {
  const res = validateReservationPatch({
    call_attempts: 0,
    callback_attempts: 0,
    notice_attempts: 0,
    negotiation_rounds: 0,
    outage_retries: 0,
    reschedules_today: 0,
    attempts_planned: 2,
  });
  assert(res.ok);
});

Deno.test("validateReservationPatch: accepts the full reschedule-reset patch (many fields, one write)", () => {
  // consumer-web-update-reservation's actual reset shape — proves the closed
  // key set covers a real multi-field lifecycle write, not just toy patches.
  const res = validateReservationPatch({
    run_id: "33333333-3333-3333-3333-333333333333",
    claimed_at: null,
    outage_retries: 0,
    reschedules_today: 1,
    reschedules_day: "2026-08-23",
    modification_of: null,
    status: "pending",
    reported_verdict: null,
    alternatives: [],
    consumer_confirmed_at: null,
    confirmed_at: null,
    negotiation_rounds: 0,
    attempts: [],
    call_attempts: 0,
    attempts_state: "idle",
    callback_state: "none",
    callback_attempts: 0,
    callback_next_attempt_at: null,
    callback_conversation_id: null,
    callback_at: null,
    next_attempt_at: null,
    last_conversation_id: null,
    last_called_at: null,
    last_call_status: "rescheduled by the guest — calling the place again",
    reserved_at: "2026-09-05T19:00:00.000Z",
    party_size: 2,
    notes: null,
  });
  assert(res.ok);
});

// ── validateReservationPatch: reject ───────────────────────────────────────

Deno.test("validateReservationPatch: rejects a non-object input", () => {
  assert(!validateReservationPatch(null).ok);
  assert(!validateReservationPatch("nope").ok);
  assert(!validateReservationPatch([1, 2, 3]).ok);
  assert(!validateReservationPatch(42).ok);
});

Deno.test("validateReservationPatch: rejects an unknown field (closed key set)", () => {
  assert(!validateReservationPatch({ id: "some-uuid" }).ok);
  assert(!validateReservationPatch({ created_at: "2026-08-23T00:00:00Z" }).ok);
  assert(!validateReservationPatch({ discount_cents: 500 }).ok);
});

Deno.test("validateReservationPatch: rejects a status outside the enum", () => {
  assert(!validateReservationPatch({ status: "booked" }).ok);
  assert(!validateReservationPatch({ status: "" }).ok);
});

Deno.test("validateReservationPatch: rejects party_size <= 0 and non-integers", () => {
  assert(!validateReservationPatch({ party_size: 0 }).ok, "zero fails the DB CHECK");
  assert(!validateReservationPatch({ party_size: -2 }).ok);
  assert(!validateReservationPatch({ party_size: 2.5 }).ok);
});

Deno.test("validateReservationPatch: rejects consumer_notify outside {call, app}", () => {
  assert(!validateReservationPatch({ consumer_notify: "sms" }).ok);
  assert(!validateReservationPatch({ consumer_notify: null }).ok, "column is NOT NULL");
});

Deno.test("validateReservationPatch: rejects a malformed reference_code", () => {
  assert(!validateReservationPatch({ reference_code: "1234567" }).ok, "7 digits");
  assert(!validateReservationPatch({ reference_code: "123456789" }).ok, "9 digits");
  assert(!validateReservationPatch({ reference_code: "ABCD5678" }).ok, "non-digits");
});

Deno.test("validateReservationPatch: rejects a reported_verdict outside the a1 VERDICTS set", () => {
  const res = validateReservationPatch({ reported_verdict: "maybe" });
  assert(!res.ok);
});

Deno.test("validateReservationPatch: rejects attempts_state / callback_state / notice_state outside their closed sets", () => {
  assert(!validateReservationPatch({ attempts_state: "booking" }).ok);
  assert(!validateReservationPatch({ callback_state: "pending" }).ok, "pending is a notice_state value, not callback_state");
  assert(!validateReservationPatch({ notice_state: "answered" }).ok, "answered is an attempts/callback value, not notice_state");
});

Deno.test("validateReservationPatch: rejects a notice_kind outside {venue_cancel, guest_cancel}", () => {
  assert(!validateReservationPatch({ notice_kind: "reminder" }).ok);
});

Deno.test("validateReservationPatch: rejects a cancelled_by outside {consumer, business, agent}", () => {
  assert(!validateReservationPatch({ cancelled_by: "system" }).ok);
});

Deno.test("validateReservationPatch: rejects a malformed alternatives entry", () => {
  assert(!validateReservationPatch({ alternatives: "21:30" }).ok, "not an array");
  assert(!validateReservationPatch({ alternatives: [{ note: 5 }] }).ok, "note must be a string");
  assert(!validateReservationPatch({ alternatives: [{ time: "25:99" }] }).ok, "not a real HH:mm");
  assert(!validateReservationPatch({ alternatives: [{}] }).ok, "no time and no note");
});

Deno.test("validateReservationPatch: rejects a malformed attempts entry", () => {
  assert(!validateReservationPatch({ attempts: [{ n: "1", started_at: "x", conversation_id: null, result: "ok" }] }).ok);
  assert(!validateReservationPatch({ attempts: [{ n: 1, started_at: "x", result: "ok" }] }).ok, "missing conversation_id");
});

Deno.test("validateReservationPatch: rejects negative or fractional counters", () => {
  assert(!validateReservationPatch({ call_attempts: -1 }).ok);
  assert(!validateReservationPatch({ negotiation_rounds: 1.5 }).ok);
});

Deno.test("validateReservationPatch: rejects a malformed reschedules_day", () => {
  assert(!validateReservationPatch({ reschedules_day: "08/23/2026" }).ok);
});

// ── writeReservation: the write door itself ────────────────────────────────

/** Throws if the mock's .from() is ever called — proves validation gates
 * before any DB call happens. */
function unreachableAdmin(): SupabaseClient {
  return {
    from() {
      throw new Error("writeReservation must not reach the DB on an invalid patch");
    },
  } as unknown as SupabaseClient;
}

Deno.test("writeReservation: an invalid patch never reaches the DB", async () => {
  const admin = unreachableAdmin();
  // A real caller decodes agent-tool / HTTP JSON as `unknown` and casts to
  // ReservationPatch before calling the write door — the same bypass of
  // Belt 1 (the compiler) this cast simulates.
  const invalidPatch = { status: "booked" } as unknown as ReservationPatch;
  const res = await writeReservation(admin, {
    mode: "update",
    id: "11111111-1111-1111-1111-111111111111",
    patch: invalidPatch,
  });
  assert(!res.ok);
  assert(res.error.startsWith("status must be one of"));
});

// Minimal Supabase mock recording every insert/update call and every .eq()
// guard chained onto it, matching consumer-doc.test.ts's fakeConsumerAdmin
// shape but generalized for writeReservation's `match` guards.
function fakeReservationAdmin(opts: { row?: Record<string, unknown>; errorCode?: string } = {}): {
  admin: SupabaseClient;
  calls: { op: "insert" | "update"; value: Record<string, unknown>; eqs: [string, unknown][] }[];
} {
  const calls: { op: "insert" | "update"; value: Record<string, unknown>; eqs: [string, unknown][] }[] = [];
  const error = opts.errorCode ? { message: "conflict", code: opts.errorCode } : null;
  function chain(record: { op: "insert" | "update"; value: Record<string, unknown>; eqs: [string, unknown][] }) {
    const builder = {
      eq(col: string, val: unknown) {
        record.eqs.push([col, val]);
        return builder;
      },
      select: () => ({ single: () => Promise.resolve({ data: opts.row ?? null, error }) }),
      then: (resolve: (v: unknown) => void) => resolve({ data: null, error }),
    };
    return builder;
  }
  const builder = {
    insert(value: Record<string, unknown>) {
      const record = { op: "insert" as const, value, eqs: [] as [string, unknown][] };
      calls.push(record);
      return chain(record);
    },
    update(value: Record<string, unknown>) {
      const record = { op: "update" as const, value, eqs: [] as [string, unknown][] };
      calls.push(record);
      return chain(record);
    },
  };
  const admin = { from: () => builder } as unknown as SupabaseClient;
  return { admin, calls };
}

Deno.test("writeReservation: update mode writes exactly the validated patch against `id`, no select", async () => {
  const { admin, calls } = fakeReservationAdmin();
  const res = await writeReservation(admin, {
    mode: "update",
    id: "res-1",
    patch: { outcome_note: "voicemail" },
  });
  assert(res.ok);
  assertEquals(res.row, null);
  assertEquals(calls.length, 1);
  assertEquals(calls[0], {
    op: "update",
    value: { outcome_note: "voicemail" },
    eqs: [["id", "res-1"]],
  });
});

Deno.test("writeReservation: update mode chains `match` guards after `id` — the consumer-web-confirm-reservation shape", async () => {
  const { admin, calls } = fakeReservationAdmin();
  const res = await writeReservation(admin, {
    mode: "update",
    id: "res-1",
    patch: { consumer_confirmed_at: "2026-08-23T22:00:00.000Z" },
    match: { consumer_id: "consumer-9", status: "pending" },
  });
  assert(res.ok);
  assertEquals(calls[0].eqs, [
    ["id", "res-1"],
    ["consumer_id", "consumer-9"],
    ["status", "pending"],
  ]);
});

Deno.test("writeReservation: insert mode with select returns the re-read row", async () => {
  const { admin } = fakeReservationAdmin({
    row: { id: "res-1", reference_code: "12345678", status: "pending" },
  });
  const res = await writeReservation(admin, {
    mode: "insert",
    patch: {
      consumer_id: "consumer-1",
      project_id: "place-1",
      reserved_at: "2026-09-01T20:00:00.000Z",
      party_size: 2,
      reference_code: "12345678",
      status: "pending",
      consumer_notify: "call",
    },
    select: "id, reference_code, status",
  });
  assert(res.ok);
  assertEquals(res.row, { id: "res-1", reference_code: "12345678", status: "pending" });
});

Deno.test("writeReservation: surfaces the Postgres error code for a reference_code collision retry", async () => {
  const { admin } = fakeReservationAdmin({ errorCode: "23505" });
  const res = await writeReservation(admin, {
    mode: "insert",
    patch: {
      consumer_id: "consumer-1",
      project_id: "place-1",
      reserved_at: "2026-09-01T20:00:00.000Z",
      party_size: 2,
      reference_code: "12345678",
    },
  });
  assert(!res.ok);
  assertEquals(res.code, "23505");
});
