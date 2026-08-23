import { assert, assertEquals } from "jsr:@std/assert@1";
import { AttemptEntrySchema, updateReservation } from "./reservation-attempts.ts";

Deno.test("AttemptEntrySchema: accepts a valid entry, conversation_id null or set", () => {
  assert(AttemptEntrySchema.parse({ n: 1, started_at: "2026-08-23T00:00:00Z", conversation_id: null, result: "dialing" }).ok);
  assert(AttemptEntrySchema.parse({ n: 1, started_at: "2026-08-23T00:00:00Z", conversation_id: "conv_abc", result: "answered" }).ok);
});

Deno.test("AttemptEntrySchema: rejects an unknown key", () => {
  const r = AttemptEntrySchema.parse({ n: 1, started_at: "x", conversation_id: null, result: "dialing", extra: true });
  assert(!r.ok);
});

Deno.test("AttemptEntrySchema: rejects a wrong-typed n", () => {
  assert(!AttemptEntrySchema.parse({ n: "1", started_at: "x", conversation_id: null, result: "dialing" }).ok);
});

// ── updateReservation itself — review finding (MESITA-1247): the function's
// own docstring promises a malformed `attempts` is REFUSED, not silently
// dropped. AttemptEntrySchema-only coverage above never called the door, so
// this promise was never actually red→green tested. Fixed in this same
// commit; these tests pin the fix.

// deno-lint-ignore no-explicit-any
function makeFakeAdmin(lastUpdate: { value?: Record<string, unknown> }): any {
  return {
    from(table: string) {
      if (table !== "reservation_tickets") throw new Error(`unexpected table ${table}`);
      return {
        update(patch: Record<string, unknown>) {
          lastUpdate.value = patch;
          return { eq: () => Promise.resolve({ error: null }) };
        },
      };
    },
  };
}

Deno.test("updateReservation: attempts present but not an array is REFUSED, not silently dropped to []", async () => {
  const lastUpdate: { value?: Record<string, unknown> } = {};
  const admin = makeFakeAdmin(lastUpdate);
  const r = await updateReservation(admin, "res-1", { attempts: "garbage" });
  assert(!r.ok, "a non-array attempts value must be refused");
  assertEquals(lastUpdate.value, undefined, "no write should have been attempted");
});

Deno.test("updateReservation: one malformed entry inside a real array refuses the whole write", async () => {
  const lastUpdate: { value?: Record<string, unknown> } = {};
  const admin = makeFakeAdmin(lastUpdate);
  const r = await updateReservation(admin, "res-1", {
    attempts: [{ n: 1, started_at: "x", conversation_id: null, result: "dialing" }, { n: "bad" }],
  });
  assert(!r.ok);
  assertEquals(lastUpdate.value, undefined);
});

Deno.test("updateReservation: a well-formed attempts array writes through", async () => {
  const lastUpdate: { value?: Record<string, unknown> } = {};
  const admin = makeFakeAdmin(lastUpdate);
  const entry = { n: 1, started_at: "2026-08-23T00:00:00Z", conversation_id: null, result: "dialing" };
  const r = await updateReservation(admin, "res-1", { attempts: [entry] });
  assert(r.ok);
  assertEquals(lastUpdate.value?.attempts, [entry]);
});
