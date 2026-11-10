// Run: deno test supabase/functions/_shared/reservation-dead-end.test.ts
//
// A reservation always moves (MESITA-3619): every booking dead end ends the
// ticket in a terminal state and tells the guest — and a run whose ticket
// moved on tells nobody.

import { assertEquals } from "jsr:@std/assert@1";
import {
  type DeadEnd,
  deadEndOutcome,
  deadEndPatch,
  endAtDeadEnd,
} from "./reservation-dead-end.ts";
import { validateReservationPatch } from "./reservation-doc.ts";
import type { ReservationOutcome } from "./reservation-notification.ts";

const ALL: DeadEnd[] = ["no_number", "no_line", "outage", "no_key", "crash", "expired", "no_answer"];

Deno.test("every dead end is terminal: nothing scheduled, no guest call owed", () => {
  for (const d of ALL) {
    const p = deadEndPatch(d, "why");
    assertEquals(["unreachable", "unresolved"].includes(p.state as string), true, d);
    assertEquals(p.attempts_state, "exhausted", d);
    assertEquals(p.next_attempt_at, null, d);
    assertEquals(p.callback_state, "skipped", d);
    assertEquals(p.callback_next_attempt_at, null, d);
    assertEquals(validateReservationPatch(p).ok, true, d);
  }
  assertEquals(deadEndOutcome("no_answer"), "unreachable");
  assertEquals(deadEndOutcome("no_number"), "unresolved");
});

Deno.test("dead end → terminal state + one notification", async () => {
  const writes: Record<string, unknown>[] = [];
  const told: ReservationOutcome[] = [];
  const ended = await endAtDeadEnd(
    {
      write: (p) => (writes.push(p), Promise.resolve(true)),
      notify: (o) => (told.push(o), Promise.resolve()),
    },
    "outage",
    "intent 1: platform outage persisted — ended",
    { call_attempts: 0 },
  );
  assertEquals(ended, true);
  assertEquals(writes.length, 1);
  assertEquals(writes[0].state, "unresolved");
  assertEquals(writes[0].call_attempts, 0);
  assertEquals(told, ["unresolved"]);
});

Deno.test("a ticket that moved on is not ended and the guest is not told", async () => {
  const told: ReservationOutcome[] = [];
  const ended = await endAtDeadEnd(
    { write: () => Promise.resolve(false), notify: (o) => (told.push(o), Promise.resolve()) },
    "no_answer",
    "no answer after 2 intents",
  );
  assertEquals(ended, false);
  assertEquals(told, []);
});
