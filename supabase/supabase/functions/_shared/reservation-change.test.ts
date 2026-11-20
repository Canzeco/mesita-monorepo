// _shared/reservation-change.test.ts — a place's proposed change (MESITA-4073).
//
// Pinned because it is auth and data loss: a place may only touch its own
// confirmed tables, and a guest's "no" must keep their table and tell the
// place, never release it.

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  acceptChangePatch,
  answerDeadline,
  changeIsOpen,
  closeOpenChangePatch,
  judgeProposal,
  keepOriginalPatch,
} from "./reservation-change.ts";
import { validateReservationPatch } from "./reservation-doc.ts";

const ZONE = "America/Mexico_City";
const NOW = new Date("2026-11-20T18:00:00.000Z"); // Fri 12:00 in Mexico City
const TICKET = {
  id: "t1",
  place_id: "place-a",
  state: "confirmed",
  reserved_at: "2026-11-22T02:30:00.000Z", // Sat 21 Nov 20:30 local
  party_size: 2,
};

Deno.test("judgeProposal: only the calling place's own confirmed table", () => {
  const ask = { new_time: "21:00" };
  const notPlace = judgeProposal(TICKET, null, ask, ZONE, NOW);
  assert(!notPlace.ok && notPlace.status === 403);
  // Another place's code reads as not found, never as "not yours".
  const other = judgeProposal(TICKET, "place-b", ask, ZONE, NOW);
  assert(!other.ok && other.status === 404 && other.code === "not_found");
  const missing = judgeProposal(null, "place-a", ask, ZONE, NOW);
  assert(!missing.ok && missing.status === 404);
  for (const state of ["pending", "cancelled", "declined"]) {
    const v = judgeProposal({ ...TICKET, state }, "place-a", ask, ZONE, NOW);
    assert(!v.ok && v.code === "not_confirmed", state);
  }
});

Deno.test("judgeProposal: a new hour, a new size, or both; nothing else", () => {
  const time = judgeProposal(TICKET, "place-a", { new_time: "21:00" }, ZONE, NOW);
  assert(time.ok);
  assertEquals(time.next?.toISOString(), "2026-11-22T03:00:00.000Z");
  assertEquals(time.partySize, null);
  const size = judgeProposal(TICKET, "place-a", { new_party_size: 4 }, ZONE, NOW);
  assert(size.ok && size.next === null && size.partySize === 4);
  const same = judgeProposal(TICKET, "place-a", { new_time: "20:30", new_party_size: 2 }, ZONE, NOW);
  assert(!same.ok && same.code === "nothing_to_change");
  const bad = judgeProposal(TICKET, "place-a", { new_party_size: 11 }, ZONE, NOW);
  assert(!bad.ok && bad.code === "bad_party_size");
});

Deno.test("judgeProposal: too late to ask the guest is refused", () => {
  const soon = { ...TICKET, reserved_at: new Date(NOW.getTime() + 2 * 3600_000 + 5 * 60_000).toISOString() };
  const v = judgeProposal(soon, "place-a", { new_party_size: 4 }, ZONE, NOW);
  assert(!v.ok && v.code === "too_late");
  // Deadline: 2 h before the earlier time, at most 24 h away.
  const far = answerDeadline(new Date(NOW.getTime() + 5 * 86_400_000), null, NOW);
  assertEquals(far?.getTime(), NOW.getTime() + 24 * 3600_000);
});

Deno.test("decline and expiry keep the original table and owe the place one call", () => {
  for (const how of ["declined", "expired"] as const) {
    const p = keepOriginalPatch(how, "none", NOW);
    assert(validateReservationPatch(p).ok, how);
    assertEquals(p.change_state, how);
    assertEquals(p.notice_kind, "change_declined");
    assertEquals(p.notice_state, "pending");
    // The table itself is untouched: no state, time or size in the patch.
    assertEquals([p.state, p.reserved_at, p.party_size], [undefined, undefined, undefined]);
  }
  // A notice already owed is never overwritten.
  const busy = keepOriginalPatch("declined", "scheduled", NOW);
  assertEquals(busy.notice_kind, undefined);
});

Deno.test("a reschedule closes an open proposal and does not call it a decline notice (MESITA-4140)", () => {
  const open = closeOpenChangePatch("proposed", NOW);
  assert(validateReservationPatch(open).ok);
  assertEquals(open.change_state, "declined");
  assertEquals(open.change_answered_at, NOW.toISOString());
  assertEquals(open.notice_kind, undefined);
  assertEquals(closeOpenChangePatch("accepted", NOW), {});
  assertEquals(closeOpenChangePatch(null, NOW), {});
});

Deno.test("accept moves the table on the spot, only while the proposal is open", () => {
  const open = {
    ...TICKET,
    change_state: "proposed",
    change_reserved_at: "2026-11-22T03:00:00.000Z",
    change_party_size: 4,
    change_expires_at: "2026-11-21T18:00:00.000Z",
  };
  assert(changeIsOpen(open, NOW));
  assert(!changeIsOpen({ ...open, change_expires_at: "2026-11-20T17:00:00.000Z" }, NOW), "expired");
  assert(!changeIsOpen({ ...open, state: "cancelled" }, NOW), "cancelled table");
  const p = acceptChangePatch(open, ZONE, "app", NOW);
  assert(validateReservationPatch(p).ok);
  assertEquals([p.reserved_at, p.party_size, p.state, p.change_state], [
    "2026-11-22T03:00:00.000Z",
    4,
    "confirmed",
    "accepted",
  ]);
});
