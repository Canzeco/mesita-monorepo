// Run: deno test supabase/functions/_shared/reservation-negotiation.test.ts
//
// MESITA-3630: a second round dials, an offer nobody takes releases the
// place, and nothing from an older round lands on a newer one.

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  freshPlaceRound,
  MAX_NEGOTIATION_ROUNDS,
  negotiationRoundPatch,
  offerDeadline,
  offerOpen,
  OPEN_OFFER_MATCH,
  releaseUnansweredOffer,
} from "./reservation-negotiation.ts";
import {
  applyCallResult,
  decideLegOutcome,
  INITIATION_FAILURE,
  type OutcomeStore,
  type OutcomeTicket,
  readConversation,
} from "./reservation-call-outcome.ts";
import { validateReservationPatch } from "./reservation-doc.ts";
import { ATTEMPTS } from "./reservations-config.ts";
import { staleRunReply } from "./agent-tools.ts";
import type { ReservationOutcome } from "./reservation-notification.ts";

const ZONE = "America/Mexico_City"; // UTC-6, no DST
const NOW = new Date("2026-11-10T18:00:00Z"); // 12:00 local
// Requested 20:00 local; the place offered 21:30 and 22:00 the same day.
const RESERVED = "2026-11-11T02:00:00.000Z";

/** Round 1 is over: two place calls spent, the second got a counter-offer,
 *  and a2 is on the phone with the guest (callback ringing). */
function afterRound1(over: Partial<OutcomeTicket> & { alternatives?: unknown } = {}) {
  return {
    id: "t1",
    consumer_id: "c1",
    reference_code: "12345678",
    reserved_at: RESERVED,
    state: "pending",
    place_id: "p1",
    run_id: "run-1",
    claimed_at: NOW.toISOString(),
    attempts: [
      { n: 1, started_at: NOW.toISOString(), conversation_id: "conv_1a", result: "no_answer" },
      { n: 2, started_at: NOW.toISOString(), conversation_id: "conv_1b", result: "counter_offer" },
    ],
    call_attempts: 2,
    attempts_planned: 2,
    attempts_state: "answered",
    last_conversation_id: "conv_1b",
    callback_state: "ringing",
    callback_conversation_id: "cb_1",
    callback_attempts: 0,
    notice_kind: null,
    notice_state: "none",
    notice_attempts: 0,
    notice_conversation_id: null,
    reminder_state: "idle",
    reminder_conversation_id: null,
    outage_retries: 1,
    modification_of: null,
    consumer_notify: "call",
    reported_verdict: "counter_offer",
    outcome_note: null,
    alternatives: [{ time: "21:30" }, { time: "22:00", note: "en la barra" }],
    ...over,
  } as OutcomeTicket & { alternatives: unknown };
}

// ── Round 2 dials ──────────────────────────────────────────────────────────

Deno.test("round 2 starts fresh place attempts, so the engine dials instead of ending unreachable", () => {
  const next = new Date("2026-11-11T03:00:00Z");
  const patch = negotiationRoundPatch({ next, roundsDone: 1, now: NOW });
  assertEquals(validateReservationPatch(patch).ok, true);
  assertEquals(patch.call_attempts, 0);
  assertEquals(patch.outage_retries, 0);
  assertEquals(patch.next_attempt_at, null);
  assertEquals(patch.reported_verdict, null);
  assertEquals(patch.alternatives, []);
  assertEquals(patch.state, "pending");
  assertEquals(patch.reserved_at, next.toISOString());
  assertEquals(patch.negotiation_rounds, 2);
  // The engine's loop runs intents attemptsDone+1 … ATTEMPTS: round 1 left
  // 2 of 2, so without the reset round 2 placed no call at all.
  const t = { ...afterRound1(), ...patch } as OutcomeTicket;
  assert(Number(t.call_attempts) < ATTEMPTS, "round 2 has attempts left");

  // Round 2's first call rings out → the ticket is retried, not ended.
  const placed: OutcomeTicket = {
    ...t,
    run_id: "run-2",
    call_attempts: 1,
    attempts_state: "running",
    last_conversation_id: "conv_2a",
    attempts: [...(t.attempts as unknown[]), {
      n: 1,
      started_at: NOW.toISOString(),
      conversation_id: "conv_2a",
      result: "ringing",
    }],
  };
  const d = decideLegOutcome("book", placed, INITIATION_FAILURE, { hours: null, timezone: ZONE }, NOW);
  assertEquals(d.patch.attempts_state, "scheduled");
  assertEquals(d.patch.state, undefined);
  assertEquals(d.notify, undefined);
});

Deno.test("a reschedule and a round share one reset; the round cap stays 2", () => {
  assertEquals(MAX_NEGOTIATION_ROUNDS, 2);
  const fresh = freshPlaceRound();
  assertEquals(validateReservationPatch(fresh).ok, true);
  assertEquals(fresh.call_attempts, 0);
  // run_id is the booking claim's to rotate: a2's later tool calls in the
  // same guest call must not read as stale.
  assertEquals("run_id" in fresh, false);
});

// ── An offer nobody took ───────────────────────────────────────────────────

Deno.test("offer deadline: 30 min before the latest offer, capped by the expiry; prose falls back to the slot", () => {
  // 22:00 local = 04:00Z next day → 03:30Z.
  assertEquals(offerDeadline(afterRound1(), ZONE).toISOString(), "2026-11-11T03:30:00.000Z");
  // An offer for the next evening is capped at reserved_at + 4 h − 30 min.
  const nextDay = afterRound1({ alternatives: [{ date: "2026-11-11", time: "21:00" }] } as never);
  assertEquals(offerDeadline(nextDay, ZONE).toISOString(), "2026-11-11T05:30:00.000Z");
  // Nothing readable: 30 min before the slot asked for.
  const prose = afterRound1({ alternatives: ["más tarde, en la terraza"] } as never);
  assertEquals(offerDeadline(prose, ZONE).toISOString(), "2026-11-11T01:30:00.000Z");
});

function fakeIo() {
  const writes: Record<string, unknown>[] = [];
  const told: ReservationOutcome[] = [];
  return {
    writes,
    told,
    io: (landed = true) => ({
      write: (p: Record<string, unknown>) => (writes.push(p), Promise.resolve(landed)),
      notify: (o: ReservationOutcome) => (told.push(o), Promise.resolve()),
    }),
  };
}

Deno.test("unanswered counter-offer → place release notice + terminal ticket + one notification", async () => {
  const t = afterRound1();
  assert(offerOpen(t));

  // Before the deadline nothing happens.
  const early = fakeIo();
  assertEquals(await releaseUnansweredOffer(early.io(), t, ZONE, new Date("2026-11-11T03:00:00Z")), false);
  assertEquals(early.writes.length, 0);

  const f = fakeIo();
  assertEquals(await releaseUnansweredOffer(f.io(), t, ZONE, new Date("2026-11-11T03:31:00Z")), true);
  assertEquals(f.writes.length, 1);
  const p = f.writes[0];
  assertEquals(validateReservationPatch(p).ok, true);
  assertEquals(p.state, "unresolved");
  assertEquals(p.attempts_state, "exhausted");
  assertEquals(p.callback_state, "skipped");
  assertEquals(p.notice_kind, "place_cancel");
  assertEquals(p.notice_state, "pending");
  assertEquals(p.notice_attempts, 0);
  assertEquals(f.told, ["unresolved"]);
});

Deno.test("a pick that lands first wins: the release writes nothing and tells nobody", async () => {
  const f = fakeIo();
  const late = new Date("2026-11-12T00:00:00Z");
  assertEquals(await releaseUnansweredOffer(f.io(false), afterRound1(), ZONE, late), false);
  assertEquals(f.told, []);
  // A ticket that is no longer an open offer is never touched.
  const g = fakeIo();
  for (const over of [{ state: "confirmed" }, { attempts_state: "running" }, { reported_verdict: null }]) {
    assertEquals(await releaseUnansweredOffer(g.io(), afterRound1(over as never), ZONE, late), false);
  }
  assertEquals(g.writes.length, 0);
  assertEquals(OPEN_OFFER_MATCH, { state: "pending", attempts_state: "answered", reported_verdict: "counter_offer" });
});

// ── Nothing from round 1 lands on round 2 ──────────────────────────────────

function memoryStore(row: OutcomeTicket) {
  const table = { row: { ...row } as Record<string, unknown> };
  const notified: ReservationOutcome[] = [];
  const store: OutcomeStore = {
    findByConversation(id) {
      const r = table.row;
      const hit = [r.last_conversation_id, r.callback_conversation_id, r.notice_conversation_id, r
        .reminder_conversation_id].includes(id);
      return Promise.resolve(hit ? (structuredClone(r) as OutcomeTicket) : null);
    },
    place: () => Promise.resolve({ name: "Lugar", hours: null, timezone: ZONE }),
    write(id, patch, match) {
      if (table.row.id !== id) return Promise.resolve(false);
      for (const [k, v] of Object.entries(match)) if (table.row[k] !== v) return Promise.resolve(false);
      table.row = { ...table.row, ...structuredClone(patch) };
      return Promise.resolve(true);
    },
    notify: (_t, _p, outcome) => (notified.push(outcome), Promise.resolve()),
    kickCallback: () => Promise.resolve(),
  };
  return { store, table, notified };
}

const DONE_SUCCESS = readConversation({
  status: "done",
  transcript: [{ role: "user", message: "Sí" }],
  analysis: { call_successful: "success" },
});

Deno.test("late result from round 1 is ignored once round 2 is claimed", async () => {
  // a2's round write, then the booking claim (launchBook): run_id rotated,
  // conversation ids cleared, round 2's call placed.
  const round2 = {
    ...afterRound1(),
    ...negotiationRoundPatch({ next: new Date("2026-11-11T03:00:00Z"), roundsDone: 0, now: NOW }),
    run_id: "run-2",
    attempts_state: "running",
    call_attempts: 1,
    last_conversation_id: "conv_2a",
    callback_state: "none",
    callback_conversation_id: null,
  } as OutcomeTicket;
  const m = memoryStore(round2);
  const before = structuredClone(m.table.row);

  // Round 1's place call and guest call report in late.
  assertEquals(await applyCallResult(m.store, "conv_1b", DONE_SUCCESS), {
    applied: false,
    reason: "unknown_conversation",
  });
  assertEquals(await applyCallResult(m.store, "cb_1", DONE_SUCCESS), {
    applied: false,
    reason: "unknown_conversation",
  });
  assertEquals(m.table.row, before);
  assertEquals(m.notified, []);

  // Round 1's a1 reporting a verdict late carries round 1's run_id.
  const stale = staleRunReply({ run_id: "run-1" }, { run_id: "run-2" });
  assert(stale);
  assertEquals((await stale.json()).stale_run, true);

  // Round 2's own call still lands.
  const own = await applyCallResult(m.store, "conv_2a", DONE_SUCCESS);
  assertEquals(own.applied, true);
  assertEquals(m.table.row.state, "confirmed");
});

Deno.test("round 1's place call can't land between a2's write and the claim", async () => {
  // a2 wrote round 2 but the engine hasn't claimed yet: the old place leg is
  // 'answered', so its conversation is no longer awaited.
  const between = { ...afterRound1(), ...negotiationRoundPatch({ next: new Date(RESERVED), roundsDone: 0, now: NOW }) };
  const m = memoryStore(between as OutcomeTicket);
  assertEquals(await applyCallResult(m.store, "conv_1b", DONE_SUCCESS), { applied: false, reason: "not_awaiting" });
  assertEquals(m.table.row.state, "pending");
  assertEquals(m.notified, []);
});
