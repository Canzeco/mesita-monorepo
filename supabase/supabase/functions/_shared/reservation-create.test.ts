// Run: deno test supabase/functions/_shared/reservation-create.test.ts
//
// One tap, one reservation (MESITA-3619): a retried request returns the
// ticket it made, a second live ticket for the same place and time is
// refused, and every new ticket is born due so the cron can move it.

import { assertEquals } from "jsr:@std/assert@1";
import {
  type CreateGuardStore,
  type CreateTicket,
  createdTicketSchedule,
  guardCreate,
  readRequestId,
} from "./reservation-create.ts";
import { validateReservationPatch } from "./reservation-doc.ts";

type Row = CreateTicket & {
  consumer_id: string;
  place_id: string;
  reserved_at: string;
  state: string;
  request_id: string | null;
};

function memoryStore(rows: Row[]): CreateGuardStore {
  return {
    byRequest: (cid, rid) =>
      Promise.resolve(rows.find((r) => r.consumer_id === cid && r.request_id === rid) ?? null),
    liveHere: (cid, pid, since) =>
      Promise.resolve(
        rows.find((r) =>
          r.consumer_id === cid && r.place_id === pid && r.reserved_at >= since &&
          (r.state === "pending" || r.state === "confirmed")
        ) ?? null,
      ),
  };
}

const RID = "0b0e7a52-6f1e-4c55-9a43-5b8d6a1f2c3d";
const AT = "2026-11-20T02:00:00.000Z";
const ticket: Row = {
  id: "t1",
  consumer_id: "c1",
  place_id: "p1",
  reserved_at: AT,
  state: "pending",
  request_id: RID,
};

Deno.test("idempotent: the same request_id returns the ticket it already made", async () => {
  const g = await guardCreate(memoryStore([ticket]), {
    consumerId: "c1",
    placeId: "p1",
    reservedAtIso: AT,
    requestId: RID,
  });
  assertEquals(g, { kind: "replay", ticket });
});

Deno.test("idempotent: another guest's request_id is not this guest's ticket", async () => {
  const g = await guardCreate(memoryStore([ticket]), {
    consumerId: "c2",
    placeId: "p1",
    reservedAtIso: AT,
    requestId: RID,
  });
  assertEquals(g, { kind: "new" });
});

const NOW = new Date("2026-11-19T00:00:00.000Z");

Deno.test("duplicate: a second live ticket at the same place and time is refused", async () => {
  const g = await guardCreate(memoryStore([ticket]), {
    consumerId: "c1",
    placeId: "p1",
    reservedAtIso: AT,
    requestId: "11111111-2222-4333-8444-555555555555",
  });
  assertEquals(g, { kind: "duplicate", ticket });
  // Old clients send no request id: still refused.
  const old = await guardCreate(memoryStore([ticket]), {
    consumerId: "c1",
    placeId: "p1",
    reservedAtIso: AT,
    requestId: null,
  });
  assertEquals(old.kind, "duplicate");
});

Deno.test("duplicate: one live ticket per place, at any time (MESITA-3640)", async () => {
  // A live table here on another day still blocks a new one here.
  const other = { ...ticket, reserved_at: "2026-11-25T03:00:00.000Z", request_id: null };
  const g = await guardCreate(memoryStore([other]), {
    consumerId: "c1",
    placeId: "p1",
    reservedAtIso: AT,
    requestId: RID,
  }, NOW);
  assertEquals(g, { kind: "duplicate", ticket: other });
});

Deno.test("duplicate: an ended ticket, another place or a passed slot is no duplicate", async () => {
  for (const row of [
    { ...ticket, state: "unreachable" },
    { ...ticket, state: "cancelled" },
    { ...ticket, place_id: "p2" },
    // Slot more than 4h before now: passed, in History.
    { ...ticket, reserved_at: "2026-11-18T19:00:00.000Z" },
  ]) {
    const g = await guardCreate(memoryStore([{ ...row, request_id: null }]), {
      consumerId: "c1",
      placeId: "p1",
      reservedAtIso: AT,
      requestId: RID,
    }, NOW);
    assertEquals(g, { kind: "new" });
  }
});

Deno.test("readRequestId keeps a uuid and drops anything else", () => {
  assertEquals(readRequestId(RID.toUpperCase()), RID);
  assertEquals(readRequestId("not-a-uuid"), null);
  assertEquals(readRequestId(undefined), null);
  assertEquals(readRequestId(42), null);
});

Deno.test("a new ticket is born scheduled and due now, and the write door accepts it", () => {
  const now = new Date("2026-11-10T04:00:00.000Z");
  const sched = createdTicketSchedule(now);
  assertEquals(sched, { attempts_state: "scheduled", next_attempt_at: now.toISOString() });
  const v = validateReservationPatch({ ...sched, request_id: RID, state: "pending" });
  assertEquals(v.ok, true);
  assertEquals(validateReservationPatch({ request_id: "nope" }).ok, false);
});
