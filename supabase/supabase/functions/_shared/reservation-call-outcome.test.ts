// MESITA-3618: calls end by message. Pins the three things that keep a
// booking from being lost or a place from being rung twice: the webhook's
// signature gate, an outcome that applies exactly once, and a placed call the
// cron never redials.

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  applyCallResult,
  GIVE_UP,
  INITIATION_FAILURE,
  type OutcomeStore,
  type OutcomeTicket,
  owedCallStep,
  readConversation,
  reaperTakes,
  signElevenPayload,
  verifyElevenSignature,
} from "./reservation-call-outcome.ts";
import type { ReservationOutcome } from "./reservation-notification.ts";
import { validateReservationPatch } from "./reservation-doc.ts";

// ── Signature ──────────────────────────────────────────────────────────────

const SECRET = "wsec_test_only";
const BODY = JSON.stringify({ type: "post_call_transcription", data: { conversation_id: "conv_1" } });
const NOW = 1_800_000_000;

Deno.test("signature: a body ElevenLabs signed passes", async () => {
  const header = await signElevenPayload(SECRET, BODY, NOW - 5);
  assertEquals(await verifyElevenSignature(BODY, header, SECRET, NOW), { ok: true });
});

Deno.test("signature: a wrong secret, a changed body or a malformed header is bad_signature", async () => {
  const header = await signElevenPayload("other_secret", BODY, NOW);
  assertEquals(await verifyElevenSignature(BODY, header, SECRET, NOW), { ok: false, code: "bad_signature" });
  const good = await signElevenPayload(SECRET, BODY, NOW);
  assertEquals(await verifyElevenSignature(BODY + " ", good, SECRET, NOW), { ok: false, code: "bad_signature" });
  assertEquals(await verifyElevenSignature(BODY, null, SECRET, NOW), { ok: false, code: "bad_signature" });
  assertEquals(await verifyElevenSignature(BODY, "t=abc,v0=zz", SECRET, NOW), { ok: false, code: "bad_signature" });
});

Deno.test("signature: a good signature older than 30 minutes is stale_event", async () => {
  const header = await signElevenPayload(SECRET, BODY, NOW - 31 * 60);
  assertEquals(await verifyElevenSignature(BODY, header, SECRET, NOW), { ok: false, code: "stale_event" });
  const edge = await signElevenPayload(SECRET, BODY, NOW - 29 * 60);
  assertEquals(await verifyElevenSignature(BODY, edge, SECRET, NOW), { ok: true });
});

// ── An in-memory ticket table ──────────────────────────────────────────────

function placedBooking(over: Partial<OutcomeTicket> = {}): OutcomeTicket {
  return {
    id: "t1",
    consumer_id: "c1",
    reference_code: "12345678",
    reserved_at: new Date(Date.now() + 2 * 86400_000).toISOString(),
    state: "pending",
    place_id: "p1",
    run_id: "run-a",
    claimed_at: new Date(Date.now() - 2 * 60_000).toISOString(),
    attempts: [{ n: 1, started_at: new Date().toISOString(), conversation_id: "conv_1", result: "ringing" }],
    call_attempts: 1,
    attempts_planned: 2,
    attempts_state: "running",
    last_conversation_id: "conv_1",
    callback_state: "none",
    callback_conversation_id: null,
    callback_attempts: 0,
    notice_kind: null,
    notice_state: "none",
    notice_attempts: 0,
    notice_conversation_id: null,
    reminder_state: "idle",
    reminder_conversation_id: null,
    outage_retries: 0,
    modification_of: null,
    consumer_notify: "call",
    reported_verdict: null,
    outcome_note: null,
    ...over,
  };
}

function memoryStore(row: OutcomeTicket) {
  const table = { row: { ...row } as Record<string, unknown> };
  const notified: ReservationOutcome[] = [];
  const kicked: string[] = [];
  const store: OutcomeStore = {
    findByConversation(id) {
      const r = table.row;
      const hit = [r.last_conversation_id, r.callback_conversation_id, r.notice_conversation_id, r
        .reminder_conversation_id].includes(id);
      return Promise.resolve(hit ? (structuredClone(r) as OutcomeTicket) : null);
    },
    place: () => Promise.resolve({ name: "Lugar", hours: null, lng: -99.1 }),
    write(id, patch, match) {
      // The production store goes through writeReservation: every patch the
      // door decides must pass the same validator.
      const v = validateReservationPatch(patch);
      if (!v.ok) throw new Error(`invalid patch: ${v.error}`);
      if (table.row.id !== id) return Promise.resolve(false);
      for (const [k, v] of Object.entries(match)) if (table.row[k] !== v) return Promise.resolve(false);
      table.row = { ...table.row, ...structuredClone(patch) };
      return Promise.resolve(true);
    },
    notify: (_t, _p, outcome) => {
      notified.push(outcome);
      return Promise.resolve();
    },
    kickCallback: (id) => {
      kicked.push(id);
      return Promise.resolve();
    },
  };
  return { store, table, notified, kicked };
}

const DONE_SUCCESS = readConversation({
  status: "done",
  transcript: [{ role: "agent", message: "Hola" }, { role: "user", message: "Sí, claro" }],
  analysis: { call_successful: "success" },
  metadata: { call_duration_secs: 70 },
});

// ── Idempotent apply ───────────────────────────────────────────────────────

Deno.test("apply: a place's yes confirms once; a second delivery changes nothing", async () => {
  const { store, table, notified, kicked } = memoryStore(placedBooking({ reported_verdict: "confirmed" }));
  const first = await applyCallResult(store, "conv_1", DONE_SUCCESS);
  assertEquals(first.applied, true);
  assertEquals(table.row.state, "confirmed");
  assertEquals(table.row.attempts_state, "answered");
  assertEquals(table.row.callback_state, "scheduled"); // the guest call is due now
  assertEquals(notified, ["confirmed"]);
  assertEquals(kicked, ["t1"]);

  const snapshot = structuredClone(table.row);
  const second = await applyCallResult(store, "conv_1", DONE_SUCCESS);
  assertEquals(second, { applied: false, reason: "not_awaiting" });
  assertEquals(table.row, snapshot);
  assertEquals(notified, ["confirmed"]);
  assertEquals(kicked, ["t1"]);
});

Deno.test("apply: a1's reported verdict wins over the analysis", async () => {
  const { store, table, notified } = memoryStore(placedBooking({ reported_verdict: "declined" }));
  await applyCallResult(store, "conv_1", DONE_SUCCESS);
  assertEquals(table.row.state, "declined");
  assertEquals(notified, ["declined"]);
});

Deno.test("apply: a run that moved on (rotated run_id) is not overwritten", async () => {
  const m = memoryStore(placedBooking());
  // The guest rescheduled mid-call: a new claim rotated run_id.
  const originalFind = m.store.findByConversation;
  m.store.findByConversation = async (id) => {
    const t = await originalFind(id);
    m.table.row.run_id = "run-b";
    return t;
  };
  const res = await applyCallResult(m.store, "conv_1", DONE_SUCCESS);
  assertEquals(res, { applied: false, reason: "lost_race" });
  assertEquals(m.table.row.attempts_state, "running");
});

Deno.test("apply: an unknown conversation (an inbound a3/a4 call) is ignored", async () => {
  const { store } = memoryStore(placedBooking());
  assertEquals(await applyCallResult(store, "conv_other", DONE_SUCCESS), {
    applied: false,
    reason: "unknown_conversation",
  });
});

Deno.test("apply: no answer on intent 1 of 2 parks the ticket; on 2 of 2 it is unreachable", async () => {
  const one = memoryStore(placedBooking());
  await applyCallResult(one.store, "conv_1", INITIATION_FAILURE);
  assertEquals(one.table.row.attempts_state, "scheduled");
  assertEquals(one.table.row.state, "pending");

  const two = memoryStore(placedBooking({ call_attempts: 2 }));
  await applyCallResult(two.store, "conv_1", INITIATION_FAILURE);
  assertEquals(two.table.row.state, "unreachable");
  assertEquals(two.notified, ["unreachable"]);
});

Deno.test("apply: a guest call that was answered closes the callback leg", async () => {
  const { store, table } = memoryStore(placedBooking({
    state: "confirmed",
    attempts_state: "answered",
    callback_state: "ringing",
    callback_conversation_id: "conv_g",
  }));
  const res = await applyCallResult(store, "conv_g", DONE_SUCCESS);
  assertEquals(res.applied && res.leg, "callback");
  assertEquals(table.row.callback_state, "answered");
});

// ── No redial after a placed call ──────────────────────────────────────────

Deno.test("no redial: the reaper never takes a placed call, only one that never dialed", () => {
  const placed = placedBooking() as unknown as Record<string, unknown>;
  assertEquals(reaperTakes(placed), false);
  assertEquals(reaperTakes({ ...placed, last_conversation_id: null }), true);
  assertEquals(reaperTakes({ attempts_state: "answered", callback_state: "ringing", callback_conversation_id: "x" }), false);
  assertEquals(reaperTakes({ callback_state: "calling" }), true);
  assertEquals(reaperTakes({ notice_state: "running", notice_conversation_id: "x" }), false);
  assertEquals(reaperTakes({ reminder_state: "ringing", reminder_conversation_id: "x" }), false);
});

Deno.test("no redial: giving up on a placed call never schedules another and keeps the verdict", async () => {
  const silent = memoryStore(placedBooking());
  await applyCallResult(silent.store, "conv_1", GIVE_UP);
  assertEquals(silent.table.row.attempts_state, "exhausted");
  assertEquals(silent.table.row.state, "unresolved");

  const said = memoryStore(placedBooking({ reported_verdict: "confirmed" }));
  await applyCallResult(said.store, "conv_1", GIVE_UP);
  assertEquals(said.table.row.state, "confirmed");
  assertEquals(said.table.row.reported_verdict, "confirmed");
});

Deno.test("no redial: the cron reads a fresh owed call and gives up only after 30 min", () => {
  const now = Date.now();
  assertEquals(owedCallStep(new Date(now - 12 * 60_000).toISOString(), now), "read");
  assertEquals(owedCallStep(new Date(now - 31 * 60_000).toISOString(), now), "read_or_give_up");
});

// ── Reading a conversation ─────────────────────────────────────────────────

Deno.test("readConversation: failed with nobody speaking is no answer; live is not final", () => {
  const failed = readConversation({ status: "failed", transcript: [{ role: "agent", message: "Hola" }] });
  assert(failed.final && !failed.answered);
  const live = readConversation({ status: "in-progress" });
  assert(!live.final);
  const killed = readConversation({ status: "failed", metadata: { error: { code: 1002 } } });
  assertEquals(killed.errorCode, 1002);
});
