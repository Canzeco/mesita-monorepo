// Supabase Edge Function — supabase-edgefunc-reservation-call (internal)
//
// THE Reservationist call engine — the sandbox AND the admin Playground are
// retired (2026-07-27): every ticket is a real public.reservation_tickets row and
// testing happens through the consumer app with config testCall mode ON (the
// venue leg dials the test line instead of a real place). Invoked with
// { reservation_id } by:
//   · consumer-web-create-reservation  (guest tapped Reserve)
//   · consumer-mcp                     (assistant-created reservation)
//   · eleven-a2-confirm-reservation    (negotiation re-fire: the guest picked
//     an alternative or proposed a new datetime → fresh Booker call)
//
// ACK-EARLY: validates + marks attempts_state='running', then the legs run in
// an EdgeRuntime background task and the response returns immediately — the
// creator EFs never block on a phone call.
//
//   Leg 1 · consumer → business  up to ATTEMPTS (fixed 2) call intents — the
//     agent calls the venue ON BEHALF OF the guest; no answer → next intent.
//     Once answered, the verdict: what a1 RECORDED via a1_report_outcome
//     (confirmed / counter_offer + alternatives / declined) outranks the
//     post-call analysis heuristic (call_successful=success → CONFIRMED).
//   Leg 2 · business → consumer  after a confirmation (call_context
//     "confirmation") OR a counter-offer (call_context "counter_offer", the
//     alternatives ride venue_alternatives) the agent calls the human guest
//     (callback_* columns). Skipped when the ticket has no guest number. On a
//     counter-offer the ticket STAYS pending — the guest's pick lands through
//     eleven-a2-confirm-reservation, which re-fires this engine (≤2 rounds).
//
// RETRIES ARE OPEN-HOURS AWARE (no longer seconds apart): a no-answer parks
// the ticket with attempts_state='scheduled' + next_attempt_at — +5 min if the
// venue is open right now, else ~30 min after it next opens — and
// supabase-cron-reservation-retries wakes it. A run therefore places ONE call
// and returns; the run that resumes reads call_attempts and continues the
// sequence. See _shared/reservation-retry.ts.
//
// Number resolution, per side:
//   business — reservations.place_phone when pre-resolved (test tickets),
//     else config testCall (test mode defaults ON → never rings a real venue
//     by accident), else places.reservation_target when the channel is phone (MESITA-842 —
//     voice-only; whatsapp/instagram picks ignored → places.phone fallback).
//   consumer — reservations.consumer_phone when pre-resolved, else the
//     consumer's own phone; empty → leg 2 is skipped.
//
// And per LINE: leg 1 dials FROM the venue-facing line, leg 2 FROM the
// guest-facing one, so each side saves a different caller ID and a callback
// reaches the right inbound agent (a4 for venues, a3 for guests) without a
// caller-ID lookup. An unresolvable consumer line degrades to the business
// line rather than dropping a reservation that may already be confirmed.
//
// Status transitions (reservation_status enum): pending → confirmed |
// declined | unreachable | unresolved. Engine crashes leave status alone and
// park attempts_state='error' with the reason in last_call_status.
//
// Auth: verify_jwt = true + requireInternalCaller — internal callers only.
//
// Deploy: supabase functions deploy supabase-edgefunc-reservation-call

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { requireInternalCaller } from "../_shared/internal.ts";
import { coerceReservationsCallConfig } from "../_shared/reservations-config.ts";
import { type AttemptEntry } from "../_shared/reservation-attempts.ts";
import {
  consumerFromNumber,
  resolveElevenLabsKey,
  getConversationStatus,
  placeOutboundCall,
  reservationAgentId,
  reservationFromNumber,
  resolvePhoneNumberId,
} from "../_shared/elevenlabs.ts";
import { nextAttemptAt } from "../_shared/reservation-retry.ts";
import { nextGuestCallAt } from "../_shared/reservation-callback.ts";
import { reminderParkPatch, REMINDER_MAX_ATTEMPTS } from "../_shared/reservation-reminder.ts";
import {
  classifyFailedConversation,
  classifyPlacementFailure,
  noticeNextAt,
  outageRetryAt,
} from "../_shared/reservation-run.ts";
import {
  alternativesToSpeech,
  normalizeAlternatives,
} from "../_shared/reservation-alternatives.ts";
import {
  businessLegFirstMessage,
  businessLegPrompt,
  guestCancelNoticeFirstMessage,
  guestCancelNoticePrompt,
  guestLegFirstMessage,
  guestLegPrompt,
  guestReminderFirstMessage,
  guestReminderPrompt,
  legDynamicVariables,
  type ReservationLegVars,
  placeCancelNoticeFirstMessage,
  placeCancelNoticePrompt,
} from "../_shared/reservation-legs.ts";
import {
  type ReservationPatch,
  validateReservationPatch,
  writeReservation,
} from "../_shared/reservation-doc.ts";
import { rowPlaceId } from "../_shared/place-id.ts";

// intent: "book" (default) = the two-leg booking run · "callback_retry" =
// re-ring the guest on a still-live verdict (leg 3) · "cancel_notice" = tell
// the side that DIDN'T cancel (legs 5/6, notice_kind picks a1-venue/a2-guest).
type Body = { reservation_id?: string; intent?: string };

// ── Run pacing — one background task under the edge-runtime ~400s wall ───────
const WATCH_POLL_MS = 8_000;
const ANSWER_BUDGET_MS = 60_000;
const VERDICT_BUDGET_MS = 130_000;
const CALLBACK_BUDGET_MS = 60_000;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Ack-early background task — mirror of runInBackground in
// _shared/enrich-pipeline.ts (not imported: it drags the enrichment stages in).
function runInBackground(task: Promise<unknown>): void {
  const edgeRuntime = (globalThis as unknown as {
    EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void };
  }).EdgeRuntime;
  if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(task);
  else void task;
}

type ConsumerName = {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
};

function guestName(c: ConsumerName | null): string {
  if (!c) return "el cliente";
  const full = c.full_name?.trim();
  if (full) return full;
  const joined = [c.first_name, c.last_name]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return joined || "el cliente";
}

// Spanish, Mexico-City local — the agent reads these back on the call.
function esDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-MX", {
      timeZone: "America/Mexico_City",
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
function esTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-MX", {
      timeZone: "America/Mexico_City",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// AttemptEntry: promoted to _shared/reservation-attempts.ts (MESITA-1247) —
// was a local, unexported type here, read back with a bare `as` cast at its
// hydration site below. Import only; do not re-declare it.

// Watch one placed call until we can tell whether it was answered. On failed,
// errorCode (metadata.error.code) lets the caller separate a platform kill
// (quota — OUR outage, don't charge the ticket) from a genuine no-answer.
type AnswerWatch = { outcome: "answered" | "no_answer" | "unknown"; errorCode: number | null };
async function watchUntilAnswered(
  key: string,
  conversationId: string,
  budgetMs: number,
): Promise<AnswerWatch> {
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    await delay(WATCH_POLL_MS);
    const s = await getConversationStatus(key, conversationId);
    if (!s.ok) continue; // transient fetch trouble — keep watching until budget
    if (s.status === "failed") return { outcome: "no_answer", errorCode: s.errorCode };
    if (s.status === "in-progress" || s.status === "processing" || s.status === "done") {
      return { outcome: "answered", errorCode: null };
    }
  }
  return { outcome: "unknown", errorCode: null };
}

// Thrown by a guarded write whose run was orphaned (reschedule / cancel /
// console action rotated run_id). The runner must STOP — its ticket moved on,
// and a placed call can't be recalled, so the check happens before dialing.
class OrphanedRunError extends Error {
  constructor() {
    super("run orphaned — run_id rotated");
  }
}

// Guarded ticket write: lands only while `runId` still owns the row. Zero
// rows affected = another actor rotated run_id → abort the whole runner.
// Routed through the reservation write door (MESITA-1280) — id + a single
// `.eq()` match is exactly the shape `writeReservation` models, so this is
// the door itself, not a hand-built query. Any failure — a rejected patch,
// a zero-row match, or a genuine DB error — throws OrphanedRunError, same as
// the pre-door code (it read only `data?.length` and never inspected
// `error`); this refactor validates what leaves the runner, not when it
// decides to stop.
async function guardedRecord(
  admin: SupabaseClient,
  reservationId: string,
  runId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const result = await writeReservation(admin, {
    mode: "update",
    id: reservationId,
    patch: patch as ReservationPatch,
    match: { run_id: runId },
    select: "id",
  });
  if (!result.ok || !result.row) throw new OrphanedRunError();
}

// Per-place daily venue-call meter (abuse guard): atomic bump, returns the
// count AFTER this call. Failure to count must never block a call — the
// meter is a guard, not a ledger.
async function bumpVenueCalls(admin: SupabaseClient, projectId: string): Promise<number | null> {
  const { data, error } = await admin.rpc("bump_reservation_call_counter", { pid: projectId });
  if (error) {
    console.error(`[reservation-call] venue-call counter failed: ${error.message}`);
    return null;
  }
  return typeof data === "number" ? data : null;
}

// What the Booker explicitly recorded mid-call via a1_report_outcome — the
// authoritative verdict; the analysis heuristic is only the fallback.
async function readReportedVerdict(
  admin: SupabaseClient,
  id: string,
): Promise<{ verdict: string | null; alternativesText: string; note: string }> {
  const { data } = await admin
    .from("reservation_tickets")
    .select("reported_verdict, alternatives, outcome_note")
    .eq("id", id)
    .maybeSingle();
  // Structured now ({time,date?,note?}); the helper still reads legacy strings.
  return {
    verdict: (data?.reported_verdict as string | null) ?? null,
    alternativesText: alternativesToSpeech(normalizeAlternatives(data?.alternatives)),
    // a1 puts the human-readable reason here — e.g. which farmacia answered.
    note: typeof data?.outcome_note === "string" ? data.outcome_note : "",
  };
}

// After the venue answered, wait for the post-call verdict.
async function watchVerdict(
  key: string,
  conversationId: string,
): Promise<"confirmed" | "declined" | "unknown"> {
  const deadline = Date.now() + VERDICT_BUDGET_MS;
  while (Date.now() < deadline) {
    await delay(WATCH_POLL_MS);
    const s = await getConversationStatus(key, conversationId);
    if (!s.ok) continue;
    if (s.status === "done") {
      if (s.callSuccessful === "success") return "confirmed";
      if (s.callSuccessful === "failure") return "declined";
      return "unknown";
    }
    if (s.status === "failed") return "unknown"; // dropped mid-call — no verdict
  }
  return "unknown";
}

// One line per audience: the venue leg dials from the business line, the guest
// leg from the consumer line. The business line is required; the consumer line
// degrades to the business one rather than dropping a call that may matter.
async function resolveLines(
  key: string,
): Promise<{ ok: true; placeLineId: string; guestLineId: string } | { ok: false; error: string }> {
  const phoneRes = await resolvePhoneNumberId(key, reservationFromNumber());
  if (!phoneRes.ok) return { ok: false, error: phoneRes.error };
  let guestLineId = phoneRes.id;
  const consumerLine = consumerFromNumber();
  if (consumerLine !== reservationFromNumber()) {
    const consumerRes = await resolvePhoneNumberId(key, consumerLine);
    if (consumerRes.ok) {
      guestLineId = consumerRes.id;
    } else {
      console.error(
        `[reservation-call] consumer line ${consumerLine} unresolved, ` +
          `falling back to the business line: ${consumerRes.error}`,
      );
    }
  }
  return { ok: true, placeLineId: phoneRes.id, guestLineId };
}

// Leg 2/3 · business → consumer — ONE Confirmer call to the human, plus the
// retry ladder (Docs › Reservations §B leg 3): a missed call parks
// callback_state='scheduled' + callback_next_attempt_at per nextGuestCallAt
// (+10 min, then +1 h, cap 3, quiet hours 09:00–22:00 venue-local, nothing
// within 30 min of the slot) and the retry cron re-fires this engine with
// intent "callback_retry". Past the ladder the app is the fallback — never a
// fourth ring.
async function callGuest(input: {
  admin: SupabaseClient;
  reservationId: string;
  runId: string;
  key: string;
  phoneNumberId: string;
  context: "confirmation" | "counter_offer";
  alternativesText: string;
  consumerNumber: string;
  confirmerAgentId: string;
  legVars: ReservationLegVars;
  /** Guest calls already placed for this errand (ladder position). */
  attemptsDone: number;
  outageRetries: number;
  placeLng: number | null;
  reservedAtIso: string;
  /** MESITA-787 — app = skip a2; ticket is the notification. */
  guestNotify: "call" | "app";
}): Promise<void> {
  const { admin, reservationId } = input;
  const record = (patch: Record<string, unknown>) =>
    guardedRecord(admin, reservationId, input.runId, patch);
  const label = input.context === "confirmation" ? "confirmed" : "counter-offer";
  if (input.guestNotify === "app") {
    await record({
      callback_state: "skipped",
      callback_next_attempt_at: null,
      // Plain venue confirm: in-app status IS the ack. Counter-offers stay
      // open for the guest to pick an alternative in the app.
      ...(input.context === "confirmation"
        ? { consumer_confirmed_at: new Date().toISOString() }
        : {}),
      last_call_status: `${label} — guest prefers app-only; no call`,
    });
    return;
  }
  if (!input.consumerNumber) {
    await record({
      callback_state: "skipped",
      callback_next_attempt_at: null,
      last_call_status: `${label} — no guest number for the callback`,
    });
    return;
  }
  const n = input.attemptsDone + 1;
  // Park the next ladder rung, or go quiet for good once the ladder is spent.
  const parkOrGiveUp = async (state: string, failNote: string) => {
    const next = nextGuestCallAt(
      n,
      input.placeLng,
      input.reservedAtIso ? new Date(input.reservedAtIso) : null,
    );
    if (next) {
      await record({
        callback_attempts: n,
        callback_state: "scheduled",
        callback_next_attempt_at: next.at.toISOString(),
        last_call_status: `${label} — ${failNote} — ${next.reason}`.slice(0, 200),
      });
    } else {
      await record({
        callback_attempts: n,
        callback_state: state,
        callback_next_attempt_at: null,
        last_call_status:
          `${label} — ${failNote} — guest unreached after ${n} call${n === 1 ? "" : "s"}; in-app only`
            .slice(0, 200),
      });
    }
  };
  // A platform failure (quota, 5xx) parks on the OUTAGE clock and does NOT
  // consume a ladder rung — the guest never even heard a ring.
  const outagePark = async (why: string) => {
    const next = outageRetryAt(input.outageRetries);
    if (next) {
      await record({
        outage_retries: input.outageRetries + 1,
        callback_state: "scheduled",
        callback_next_attempt_at: next.at.toISOString(),
        last_call_status: `${label} — ${why} — ${next.reason}`.slice(0, 200),
      });
    } else {
      await record({
        callback_state: "failed",
        callback_next_attempt_at: null,
        last_call_status: `${label} — ${why} — platform outage persisted; needs attention`
          .slice(0, 200),
      });
    }
  };
  const call = await placeOutboundCall(input.key, {
    agentId: input.confirmerAgentId,
    agentPhoneNumberId: input.phoneNumberId,
    toNumber: input.consumerNumber,
    dynamicVariables: legDynamicVariables("guest_confirmation", input.legVars, {
      callContext: input.context,
      placeAlternatives: input.alternativesText,
    }),
    overrides: {
      prompt: guestLegPrompt(input.legVars),
      firstMessage: guestLegFirstMessage(input.legVars),
      language: "es",
    },
  });
  if (!call.ok) {
    if (classifyPlacementFailure(call.httpStatus) === "platform") {
      await outagePark(`guest call not placed (HTTP ${call.httpStatus ?? "network"})`);
    } else {
      await parkOrGiveUp("failed", `guest call failed: ${call.error}`);
    }
    return;
  }
  await record({
    callback_state: "ringing",
    callback_conversation_id: call.conversationId,
    last_call_status: `${label} — calling the guest`,
  });
  const watch: AnswerWatch = call.conversationId
    ? await watchUntilAnswered(input.key, call.conversationId, CALLBACK_BUDGET_MS)
    : { outcome: "unknown", errorCode: null };
  if (watch.outcome === "answered") {
    await record({
      callback_attempts: n,
      callback_state: "answered",
      callback_next_attempt_at: null,
      outage_retries: 0,
      last_call_status: `${label} — guest notified`,
    });
    return;
  }
  if (watch.outcome === "no_answer" && classifyFailedConversation(watch.errorCode) === "platform") {
    await outagePark(`platform killed the call (code ${watch.errorCode})`);
    return;
  }
  await parkOrGiveUp(
    watch.outcome,
    watch.outcome === "no_answer" ? "guest didn't answer" : "guest call outcome unknown",
  );
}

// Leg 3 resume — the cron woke a parked callback; same call, next rung.
async function runCallbackRetry(input: {
  admin: SupabaseClient;
  reservationId: string;
  runId: string;
  key: string;
  context: "confirmation" | "counter_offer";
  alternativesText: string;
  consumerNumber: string;
  confirmerAgentId: string;
  legVars: ReservationLegVars;
  attemptsDone: number;
  outageRetries: number;
  placeLng: number | null;
  reservedAtIso: string;
  guestNotify: "call" | "app";
}): Promise<void> {
  try {
    const lines = await resolveLines(input.key);
    if (!lines.ok) {
      await guardedRecord(input.admin, input.reservationId, input.runId, {
        callback_state: "failed",
        callback_next_attempt_at: null,
        last_call_status: `callback retry — line resolution failed: ${lines.error}`.slice(0, 200),
      });
      return;
    }
    await callGuest({ ...input, phoneNumberId: lines.guestLineId });
  } catch (e) {
    if (e instanceof OrphanedRunError) return; // ticket moved on — stop quietly
    console.error(`[reservation-call] callback retry crashed: ${e}`);
  }
}

// Leg 7 · reminder — a2, ~3 h before a confirmed slot. Cap 1, never retried
// (Docs › Reservations). Quiet hours are NEVER waived. Platform outages
// still park on the outage clock without charging the one attempt.
async function runReminder(input: {
  admin: SupabaseClient;
  reservationId: string;
  runId: string;
  key: string;
  consumerNumber: string;
  confirmerAgentId: string;
  legVars: ReservationLegVars;
  outageRetries: number;
  reservedAtIso: string;
  placeLng: number | null;
  guestNotify: "call" | "app";
  reminderEnabled: boolean;
}): Promise<void> {
  const { admin, reservationId } = input;
  const record = (patch: Record<string, unknown>) =>
    guardedRecord(admin, reservationId, input.runId, patch);
  try {
    if (input.guestNotify === "app") {
      await record({
        reminder_state: "skipped",
        reminder_at: null,
        last_call_status: "reminder — guest prefers app-only; no call",
      });
      return;
    }
    // Knob-off after a race with cron: restore the park. Never skip-then-lose
    // the timestamp — flipping ON must still cover this held table.
    if (!input.reminderEnabled) {
      const reservedAt = input.reservedAtIso ? new Date(input.reservedAtIso) : null;
      await record({
        ...reminderParkPatch(input.placeLng, reservedAt, input.guestNotify),
        last_call_status: "reminder — operator knob off; park kept",
      });
      return;
    }
    const reservedAt = input.reservedAtIso ? new Date(input.reservedAtIso) : null;
    const cutoff = reservedAt ? reservedAt.getTime() - 30 * 60_000 : 0;
    if (!reservedAt || Date.now() > cutoff) {
      await record({
        reminder_state: "skipped",
        reminder_at: null,
        last_call_status: "reminder skipped — past the 30 min cutoff (or no slot)",
      });
      return;
    }
    const lines = await resolveLines(input.key);
    if (!lines.ok) {
      await record({
        reminder_state: "failed",
        reminder_at: null,
        last_call_status: `reminder — line resolution failed: ${lines.error}`.slice(0, 200),
      });
      return;
    }
    if (!input.consumerNumber) {
      await record({
        reminder_state: "skipped",
        reminder_at: null,
        last_call_status: "reminder — no guest number",
      });
      return;
    }
    const outagePark = async (why: string) => {
      const next = outageRetryAt(input.outageRetries);
      if (next) {
        await record({
          outage_retries: input.outageRetries + 1,
          reminder_state: "scheduled",
          reminder_at: next.at.toISOString(),
          last_call_status: `reminder — ${why} — ${next.reason}`.slice(0, 200),
        });
      } else {
        await record({
          reminder_state: "failed",
          reminder_at: null,
          last_call_status: `reminder — ${why} — platform outage persisted; needs attention`
            .slice(0, 200),
        });
      }
    };
    const call = await placeOutboundCall(input.key, {
      agentId: input.confirmerAgentId,
      agentPhoneNumberId: lines.guestLineId,
      toNumber: input.consumerNumber,
      dynamicVariables: legDynamicVariables("guest_confirmation", input.legVars, {
        callContext: "reminder",
      }),
      overrides: {
        prompt: guestReminderPrompt(input.legVars),
        firstMessage: guestReminderFirstMessage(input.legVars),
        language: "es",
      },
    });
    if (!call.ok) {
      if (classifyPlacementFailure(call.httpStatus) === "platform") {
        await outagePark(`not placed (HTTP ${call.httpStatus ?? "network"})`);
      } else {
        await record({
          reminder_attempts: REMINDER_MAX_ATTEMPTS,
          reminder_state: "skipped",
          reminder_at: null,
          last_call_status: `reminder failed: ${call.error} — app is the fallback`.slice(0, 200),
        });
      }
      return;
    }
    await record({
      reminder_state: "ringing",
      reminder_conversation_id: call.conversationId,
      last_call_status: "reminder — calling the guest",
    });
    const watch: AnswerWatch = call.conversationId
      ? await watchUntilAnswered(input.key, call.conversationId, CALLBACK_BUDGET_MS)
      : { outcome: "unknown", errorCode: null };
    if (watch.outcome === "answered") {
      await record({
        reminder_attempts: REMINDER_MAX_ATTEMPTS,
        reminder_state: "answered",
        reminder_at: null,
        outage_retries: 0,
        last_call_status: "reminder — guest reached",
      });
      return;
    }
    if (watch.outcome === "no_answer" && classifyFailedConversation(watch.errorCode) === "platform") {
      await outagePark(`platform killed the call (code ${watch.errorCode})`);
      return;
    }
    // Cap 1: voicemail / no-answer is NOT retried. The app is the fallback.
    await record({
      reminder_attempts: REMINDER_MAX_ATTEMPTS,
      reminder_state: "skipped",
      reminder_at: null,
      last_call_status: "reminder — guest didn't answer; app is the fallback",
    });
  } catch (e) {
    if (e instanceof OrphanedRunError) return;
    console.error(`[reservation-call] reminder crashed: ${e}`);
  }
}

// Legs 5/6 · the cancellation notice — tell the side that DIDN'T cancel.
// venue_cancel → a1 rings the venue to release the held table (paced by the
// venue's own hours, cap 2); guest_cancel → a2 rings the guest (guest ladder,
// cap 3). Delivery: a venue-side voicemail counts (it's the venue's own line);
// a GUEST voicemail does NOT — one more ladder rung fires before we claim the
// guest was told (eng-review 2026-08-04). Platform failures park on the
// outage clock without consuming notice attempts. Exhausted → 'failed',
// visible in the admin needs-attention filter.
async function runCancelNotice(input: {
  admin: SupabaseClient;
  reservationId: string;
  runId: string;
  key: string;
  kind: "venue_cancel" | "guest_cancel";
  attemptsDone: number;
  outageRetries: number;
  toNumber: string;
  agentId: string;
  legVars: ReservationLegVars;
  placeHours: unknown;
  placeLng: number | null;
  reservedAtIso: string;
  projectId: string;
  venueCallCap: number;
  guestNotify: "call" | "app";
}): Promise<void> {
  const { admin, reservationId } = input;
  const record = (patch: Record<string, unknown>) =>
    guardedRecord(admin, reservationId, input.runId, patch);
  const isPlaceSide = input.kind === "venue_cancel"; // wire kind keeps venue_cancel
  const who = isPlaceSide ? "place" : "guest";
  // guest_cancel wire kind = tell the GUEST the venue cancelled (leg 6).
  if (!isPlaceSide && input.guestNotify === "app") {
    await record({
      notice_state: "skipped",
      notice_next_at: null,
      last_call_status: "cancel notice (guest) — guest prefers app-only; no call",
    });
    return;
  }
  const n = input.attemptsDone + 1;
  const reservedAt = input.reservedAtIso ? new Date(input.reservedAtIso) : null;
  const park = async (failNote: string) => {
    const next = noticeNextAt(input.kind, n, input.placeHours, input.placeLng, reservedAt);
    if (next) {
      await record({
        notice_attempts: n,
        notice_state: "scheduled",
        notice_next_at: next.at.toISOString(),
        last_call_status: `cancel notice (${who}) — ${failNote} — ${next.reason}`.slice(0, 200),
      });
    } else {
      await record({
        notice_attempts: n,
        notice_state: "failed",
        notice_next_at: null,
        last_call_status:
          `cancel notice (${who}) NOT delivered after ${n} call${n === 1 ? "" : "s"} — needs attention`
            .slice(0, 200),
      });
    }
  };
  // Platform outage: the other side never heard a ring — retry on the outage
  // clock, attempt NOT charged. Budget spent → failed (badge-visible); a
  // cancelled ticket has no natural expiry, so the outage cap is the bound.
  const outagePark = async (why: string) => {
    const next = outageRetryAt(input.outageRetries);
    if (next) {
      await record({
        outage_retries: input.outageRetries + 1,
        notice_state: "scheduled",
        notice_next_at: next.at.toISOString(),
        last_call_status: `cancel notice (${who}) — ${why} — ${next.reason}`.slice(0, 200),
      });
    } else {
      await record({
        notice_state: "failed",
        notice_next_at: null,
        last_call_status: `cancel notice (${who}) — ${why} — outage persisted; needs attention`
          .slice(0, 200),
      });
    }
  };
  try {
    if (isPlaceSide) {
      const calls = await bumpVenueCalls(admin, input.projectId);
      if (calls !== null && calls > input.venueCallCap) {
        await record({
          notice_state: "scheduled",
          notice_next_at: new Date(Date.now() + 6 * 3600_000).toISOString(),
          last_call_status:
            `cancel notice (venue) — daily venue-call cap (${input.venueCallCap}) reached — deferred`
              .slice(0, 200),
        });
        return;
      }
    }
    const lines = await resolveLines(input.key);
    if (!lines.ok) {
      await park(`line resolution failed: ${lines.error}`);
      return;
    }
    const call = await placeOutboundCall(input.key, {
      agentId: input.agentId,
      agentPhoneNumberId: isPlaceSide ? lines.placeLineId : lines.guestLineId,
      toNumber: input.toNumber,
      dynamicVariables: legDynamicVariables(
        isPlaceSide ? "business_booking" : "guest_confirmation",
        input.legVars,
        { callContext: isPlaceSide ? "cancellation" : "cancelled_by_venue", placeAlternatives: "" },
      ),
      overrides: {
        prompt: isPlaceSide
          ? placeCancelNoticePrompt(input.legVars)
          : guestCancelNoticePrompt(input.legVars),
        firstMessage: isPlaceSide
          ? placeCancelNoticeFirstMessage(input.legVars)
          : guestCancelNoticeFirstMessage(input.legVars),
        language: "es",
      },
    });
    if (!call.ok) {
      if (classifyPlacementFailure(call.httpStatus) === "platform") {
        await outagePark(`not placed (HTTP ${call.httpStatus ?? "network"})`);
      } else {
        await park(`call failed: ${call.error}`);
      }
      return;
    }
    await record({
      notice_conversation_id: call.conversationId,
      last_call_status: `cancel notice (${who}) — ringing`,
    });
    const watch: AnswerWatch = call.conversationId
      ? await watchUntilAnswered(input.key, call.conversationId, ANSWER_BUDGET_MS)
      : { outcome: "unknown", errorCode: null };
    if (watch.outcome === "answered") {
      // Guest side: wait for the call to END and check whether a VOICEMAIL
      // answered — a message on a machine is not a told guest. One more rung
      // (if the ladder allows) before delivery is claimed.
      if (!isPlaceSide && call.conversationId) {
        const finalState = await waitForVoicemailVerdict(input.key, call.conversationId);
        if (finalState === "voicemail") {
          const next = noticeNextAt(
            input.kind,
            n,
            input.placeHours,
            input.placeLng,
            reservedAt,
          );
          if (next) {
            await record({
              notice_attempts: n,
              notice_state: "scheduled",
              notice_next_at: next.at.toISOString(),
              outage_retries: 0,
              last_call_status:
                `cancel notice (guest) — voicemail answered; message left, retrying live — ${next.reason}`
                  .slice(0, 200),
            });
            return;
          }
          await record({
            notice_attempts: n,
            notice_state: "done",
            notice_next_at: null,
            outage_retries: 0,
            last_call_status: "cancel notice (guest) delivered — voicemail only",
          });
          return;
        }
      }
      await record({
        notice_attempts: n,
        notice_state: "done",
        notice_next_at: null,
        outage_retries: 0,
        last_call_status: `cancel notice (${who}) delivered`,
      });
      return;
    }
    if (
      watch.outcome === "no_answer" &&
      classifyFailedConversation(watch.errorCode) === "platform"
    ) {
      await outagePark(`platform killed the call (code ${watch.errorCode})`);
      return;
    }
    await park(watch.outcome === "no_answer" ? "no answer" : "outcome unknown");
  } catch (e) {
    if (e instanceof OrphanedRunError) return; // ticket moved on — stop quietly
    await writeReservation(admin, {
      mode: "update",
      id: reservationId,
      patch: {
        notice_state: "failed",
        notice_next_at: null,
        last_call_status: `cancel notice (${who}) crashed: ${
          e instanceof Error ? e.message : "run crashed"
        }`.slice(0, 200),
      },
      match: { run_id: input.runId },
    });
  }
}

// After an answered guest call ends, was it a human or a machine? Polls the
// conversation to terminal, then reads the voicemail signal. "human" on any
// doubt — an extra ring for a heard guest is worse than none for an unheard
// one, and the voicemail branch already left the message either way.
async function waitForVoicemailVerdict(
  key: string,
  conversationId: string,
): Promise<"human" | "voicemail"> {
  const deadline = Date.now() + VERDICT_BUDGET_MS;
  while (Date.now() < deadline) {
    await delay(WATCH_POLL_MS);
    const s = await getConversationStatus(key, conversationId);
    if (!s.ok) continue;
    if (s.status === "done" || s.status === "failed") {
      return s.voicemailDetected ? "voicemail" : "human";
    }
  }
  return "human";
}

// The two-leg run — fires AFTER the HTTP response, updating the ticket as it
// goes so every surface (admin tickets list, consumer app) shows live progress.
async function runIntents(input: {
  admin: SupabaseClient;
  reservationId: string;
  attemptsPlanned: number;
  /** Attempts already burned by earlier runs — this run resumes after them. */
  attemptsDone: number;
  /** Log carried across runs so the ticket keeps its full history. */
  priorAttempts: AttemptEntry[];
  /** The venue's weekly hours + lng — when the next try is allowed to fire. */
  placeHours: unknown;
  placeLng: number | null;
  businessNumber: string;
  consumerNumber: string; // "" = no guest number → leg 2 skipped
  bookerAgentId: string; // eleven-a1 (fallback: the original agent)
  confirmerAgentId: string; // eleven-a2 (fallback: the original agent)
  legVars: ReservationLegVars;
  /** Guest calls already placed this errand — the leg-2 ladder resumes here. */
  callbackAttemptsDone: number;
  reservedAtIso: string;
  runId: string;
  projectId: string;
  outageRetries: number;
  venueCallCap: number;
  /** Old reserved_at when this run MODIFIES a confirmed booking (T3/eng-review). */
  modificationOfIso: string | null;
  guestNotify: "call" | "app";
}): Promise<void> {
  const { admin, reservationId, attemptsPlanned, legVars } = input;
  // Prior runs' entries stay in the log; this run appends to them.
  const attempts: AttemptEntry[] = [...input.priorAttempts];
  const record = (patch: Record<string, unknown>) =>
    guardedRecord(admin, reservationId, input.runId, patch);
  // Failed to book new terms while the venue still HOLDS the old slot → the
  // old hold must be released (leg 5 through the reschedule door). The cron
  // sweeps the owed notice within a minute.
  const releaseOldHold = input.modificationOfIso
    ? { notice_kind: "venue_cancel", notice_state: "pending", notice_attempts: 0, notice_next_at: null }
    : {};
  // Leg 2 with everything threaded — outcomes and the ladder live in callGuest.
  const guestCall = (
    key: string,
    phoneNumberId: string,
    context: "confirmation" | "counter_offer",
    alternativesText: string,
  ) =>
    callGuest({
      admin,
      reservationId,
      runId: input.runId,
      key,
      phoneNumberId,
      context,
      alternativesText,
      consumerNumber: input.consumerNumber,
      confirmerAgentId: input.confirmerAgentId,
      legVars,
      attemptsDone: input.callbackAttemptsDone,
      outageRetries: 0,
      placeLng: input.placeLng,
      reservedAtIso: input.reservedAtIso,
      guestNotify: input.guestNotify,
    });

  try {
    const key = await resolveElevenLabsKey();
    if (!key?.startsWith("sk_")) {
      await record({
        attempts_state: "error",
        callback_state: "skipped",
        last_call_status: "no ELEVENLABS_KEY",
      });
      return;
    }
    const lines = await resolveLines(key);
    if (!lines.ok) {
      await record({
        attempts_state: "error",
        callback_state: "skipped",
        last_call_status: `failed: ${lines.error}`.slice(0, 200),
      });
      return;
    }

    // Leg 1 · consumer → business — the booking intents.
    for (let n = input.attemptsDone + 1; n <= attemptsPlanned; n++) {
      const entry: AttemptEntry = {
        n,
        started_at: new Date().toISOString(),
        conversation_id: null,
        result: "dialing",
      };
      attempts.push(entry);
      await record({
        attempts,
        call_attempts: n,
        last_called_at: entry.started_at,
        last_call_status: `intent ${n}: dialing`,
      });

      // Per-place daily meter — booking calls and venue notices share it.
      const meter = await bumpVenueCalls(admin, input.projectId);
      if (meter !== null && meter > input.venueCallCap) {
        attempts.pop(); // never rang — the entry must not count
        await record({
          attempts,
          call_attempts: n - 1,
          attempts_state: "scheduled",
          next_attempt_at: new Date(Date.now() + 6 * 3600_000).toISOString(),
          last_call_status:
            `intent ${n}: daily venue-call cap (${input.venueCallCap}) reached — deferred`
              .slice(0, 200),
        });
        return;
      }

      const call = await placeOutboundCall(key, {
        agentId: input.bookerAgentId,
        agentPhoneNumberId: lines.placeLineId,
        toNumber: input.businessNumber,
        dynamicVariables: legDynamicVariables("business_booking", legVars, {
          callContext: input.modificationOfIso ? "modification" : "booking",
        }),
        overrides: {
          prompt: businessLegPrompt(legVars),
          firstMessage: businessLegFirstMessage(legVars),
          language: "es",
        },
      });

      if (!call.ok) {
        // OUR outage (quota, 5xx, network) is not the venue's silence: the
        // attempt is uncharged and the ticket parks on the outage clock.
        if (classifyPlacementFailure(call.httpStatus) === "platform") {
          attempts.pop();
          const next = outageRetryAt(input.outageRetries);
          if (next) {
            await record({
              attempts,
              call_attempts: n - 1,
              outage_retries: input.outageRetries + 1,
              attempts_state: "scheduled",
              next_attempt_at: next.at.toISOString(),
              last_call_status:
                `intent ${n}: not placed (HTTP ${call.httpStatus ?? "network"}) — ${next.reason}`
                  .slice(0, 200),
            });
          } else {
            await record({
              attempts,
              call_attempts: n - 1,
              attempts_state: "error",
              next_attempt_at: null,
              last_call_status:
                `intent ${n}: platform outage persisted — needs attention`.slice(0, 200),
            });
          }
          return;
        }
        entry.result = `placement failed: ${call.error}`.slice(0, 160);
        if (n < attemptsPlanned) {
          const next = nextAttemptAt(input.placeHours, input.placeLng);
          await record({
            attempts,
            attempts_state: "scheduled",
            next_attempt_at: next.at.toISOString(),
            last_call_status: `intent ${n} failed: ${call.error}`.slice(0, 200),
          });
          return;
        }
        await record({
          attempts,
          last_call_status: `intent ${n} failed: ${call.error}`.slice(0, 200),
        });
        continue;
      }

      entry.conversation_id = call.conversationId;
      entry.result = "ringing";
      await record({
        attempts,
        last_conversation_id: call.conversationId,
        last_call_status: `intent ${n}: ringing`,
      });

      const watch: AnswerWatch = call.conversationId
        ? await watchUntilAnswered(key, call.conversationId, ANSWER_BUDGET_MS)
        : { outcome: "unknown", errorCode: null };
      const outcome = watch.outcome;

      if (outcome === "no_answer" && classifyFailedConversation(watch.errorCode) === "platform") {
        // The platform killed a placed call (quota mid-evening). Same rule:
        // park on the outage clock, attempt NOT charged.
        attempts.pop();
        const next = outageRetryAt(input.outageRetries);
        if (next) {
          await record({
            attempts,
            call_attempts: n - 1,
            outage_retries: input.outageRetries + 1,
            attempts_state: "scheduled",
            next_attempt_at: next.at.toISOString(),
            last_call_status:
              `intent ${n}: platform killed the call (code ${watch.errorCode}) — ${next.reason}`
                .slice(0, 200),
          });
        } else {
          await record({
            attempts,
            call_attempts: n - 1,
            attempts_state: "error",
            next_attempt_at: null,
            last_call_status: `intent ${n}: platform outage persisted — needs attention`
              .slice(0, 200),
          });
        }
        return;
      }

      if (outcome === "no_answer") {
        entry.result = "no_answer";
        if (n < attemptsPlanned) {
          // Park it: the venue's own hours decide when we try again, and a run
          // can't sleep 30 minutes. supabase-cron-reservation-retries wakes it.
          const next = nextAttemptAt(input.placeHours, input.placeLng);
          await record({
            attempts,
            attempts_state: "scheduled",
            next_attempt_at: next.at.toISOString(),
            last_call_status: `intent ${n}: no answer — ${next.reason}`.slice(0, 200),
          });
          return;
        }
        await record({ attempts, last_call_status: `intent ${n}: no answer` });
        continue;
      }
      if (outcome === "unknown") {
        // Can't tell — the line may be mid-conversation. Stop rather than risk
        // ringing it again on top of a live call.
        entry.result = "unknown";
        await record({
          attempts,
          attempts_state: "exhausted",
          next_attempt_at: null,
          status: "unresolved",
          callback_state: "skipped",
          ...releaseOldHold,
          last_call_status: `intent ${n}: outcome unknown — not retrying`,
        });
        return;
      }

      // Answered — wait for the venue's VERDICT before anything else.
      entry.result = "answered";
      await record({
        attempts,
        last_call_status: `intent ${n}: answered — awaiting verdict`,
      });
      const analyzed = call.conversationId
        ? await watchVerdict(key, call.conversationId)
        : "unknown";
      // a1's explicit report (a1_report_outcome) outranks the analysis.
      const reported = await readReportedVerdict(admin, reservationId);
      const REPORTABLE = [
        "confirmed",
        "declined",
        "counter_offer",
        "unreachable",
        "wrong_number",
      ];
      const verdict = reported.verdict && REPORTABLE.includes(reported.verdict)
        ? reported.verdict
        : analyzed;

      // The line is not this venue. Terminal on the spot: redialling would just
      // ring the same stranger, so this must NOT consume the retry path.
      if (verdict === "wrong_number") {
        entry.result = "wrong_number";
        await record({
          attempts,
          attempts_state: "exhausted",
          next_attempt_at: null,
          status: "unresolved",
          callback_state: "skipped",
          last_call_status:
            `intent ${n}: wrong number — the line isn't the venue${
              reported.note ? ` (${reported.note})` : ""
            }`.slice(0, 200),
        });
        return;
      }

      // Answered, but we never got to anyone who could book (voicemail, IVR
      // dead-end, "call back later"). Unlike `declined` this is not an answer —
      // it's the absence of one, so it retries exactly like a no-answer.
      if (verdict === "unreachable") {
        entry.result = "unreachable";
        if (n < attemptsPlanned) {
          const next = nextAttemptAt(input.placeHours, input.placeLng);
          await record({
            attempts,
            attempts_state: "scheduled",
            next_attempt_at: next.at.toISOString(),
            // Clear it so the next attempt starts from a blank verdict.
            reported_verdict: null,
            last_call_status: `intent ${n}: no one who books was reached — ${next.reason}`
              .slice(0, 200),
          });
          return;
        }
        await record({
          attempts,
          attempts_state: "exhausted",
          next_attempt_at: null,
          status: "unreachable",
          callback_state: "skipped",
          ...releaseOldHold,
          last_call_status: `intent ${n}: no one who books was reached — giving up`,
        });
        return;
      }

      if (verdict === "confirmed") {
        entry.result = "confirmed";
        await record({
          attempts,
          attempts_state: "answered",
          next_attempt_at: null,
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
          callback_state: "calling",
          callback_at: new Date().toISOString(),
          outage_retries: 0,
          // A confirmed MODIFICATION means the venue moved the booking on
          // this very call — the old hold is gone conversationally.
          modification_of: null,
          ...reminderParkPatch(
            input.placeLng,
            input.reservedAtIso ? new Date(input.reservedAtIso) : null,
            input.guestNotify,
          ),
          last_call_status: `intent ${n}: venue confirmed — calling the guest`,
        });
        await guestCall(key, lines.guestLineId, "confirmation", "");
        return;
      }
      if (verdict === "counter_offer") {
        // Venue offered options — the ticket STAYS pending; the guest hears
        // them on the Confirmer leg and their pick (via
        // eleven-a2-confirm-reservation) re-fires this engine.
        entry.result = "counter_offer";
        await record({
          attempts,
          attempts_state: "answered",
          next_attempt_at: null,
          callback_state: "calling",
          callback_at: new Date().toISOString(),
          last_call_status: `intent ${n}: venue counter-offer — calling the guest`,
        });
        await guestCall(key, lines.guestLineId, "counter_offer", reported.alternativesText);
        return;
      }
      if (verdict === "declined") {
        // The venue ANSWERED and said no — terminal.
        entry.result = "declined";
        await record({
          attempts,
          attempts_state: "answered",
          next_attempt_at: null,
          status: "declined",
          callback_state: "skipped",
          // Modification declined: a1's brief asks the venue to drop the old
          // booking too, so the decline settles both slots — no notice owed.
          modification_of: null,
          last_call_status: `intent ${n}: venue declined — no guest call`,
        });
        return;
      }
      entry.result = "unresolved";
      await record({
        attempts,
        attempts_state: "answered",
        status: "unresolved",
        callback_state: "skipped",
        last_call_status: `intent ${n}: answered, verdict unknown — no guest call`,
      });
      return;
    }

    await record({
      attempts_state: "exhausted",
      next_attempt_at: null,
      status: "unreachable",
      callback_state: "skipped",
      ...releaseOldHold,
      last_call_status: `no answer after ${attemptsPlanned} intent${
        attemptsPlanned === 1 ? "" : "s"
      }`,
    });
  } catch (e) {
    if (e instanceof OrphanedRunError) return; // ticket moved on — stop quietly
    // Guarded by run_id directly: if the run was orphaned between the throw
    // and here, this error write must not clobber the ticket's new life.
    await writeReservation(admin, {
      mode: "update",
      id: reservationId,
      patch: {
        attempts_state: "error",
        callback_state: "skipped",
        last_call_status: `failed: ${e instanceof Error ? e.message : "run crashed"}`.slice(0, 200),
      },
      match: { run_id: input.runId },
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = requireInternalCaller(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const reservationId = bodyRes.body.reservation_id;
  if (!reservationId || typeof reservationId !== "string") {
    return json({ ok: false, error: "reservation_id required" }, 400);
  }
  const intent = bodyRes.body.intent === "callback_retry" ||
      bodyRes.body.intent === "cancel_notice" ||
      bodyRes.body.intent === "reminder"
    ? bodyRes.body.intent
    : "book";

  const elevenKey = await resolveElevenLabsKey();
  if (!elevenKey?.startsWith("sk_")) {
    return json({ ok: false, error: "ELEVENLABS_KEY not configured" }, 503);
  }

  const admin = adminClient(envRes.env);

  // Fetch place by project_id separately — reservations.project_id has no
  // PostgREST FK hint to places, so an embed 500s. places.id == project_id.
  const { data: r, error: rErr } = await admin
    .from("reservation_tickets")
    .select(
      "id, reference_code, reserved_at, party_size, notes, status, place_id, is_test, place_phone, consumer_phone, attempts_state, attempts, call_attempts, callback_attempts, consumer_confirmed_at, consumer_notify, alternatives, notice_kind, notice_state, notice_attempts, reminder_state, reminder_attempts, outage_retries, modification_of, consumer:consumers(full_name, first_name, last_name, phone)",
    )
    .eq("id", reservationId)
    .maybeSingle();
  if (rErr) return json({ ok: false, error: rErr.message }, 500);
  if (!r) return json({ ok: false, error: "reservation not found" }, 404);
  const placeId = rowPlaceId(r);
  if (!placeId) return json({ ok: false, error: "reservation has no place" }, 400);
  const guestNotify: "call" | "app" = r.consumer_notify === "app" ? "app" : "call";
  // Per-intent gates — each errand has its own idea of a live ticket.
  if (intent === "book") {
    if (r.status !== "pending") {
      return json({ ok: true, skipped: `reservation is ${r.status}, not pending` });
    }
    if (r.attempts_state === "running") {
      return json({ ok: true, skipped: "intents already running" });
    }
  } else if (intent === "cancel_notice") {
    // A notice is owed by its columns, not by one status: 'cancelled' is the
    // normal case, and a failed MODIFICATION leaves the ticket unreachable/
    // unresolved while the venue still holds the OLD slot. A live ticket
    // never owes one.
    if (r.status === "pending" || r.status === "confirmed") {
      return json({ ok: true, skipped: `reservation is ${r.status} — no notice while live` });
    }
    if (r.notice_kind !== "venue_cancel" && r.notice_kind !== "guest_cancel") {
      return json({ ok: true, skipped: "no cancellation notice owed" });
    }
  } else if (intent === "reminder") {
    if (r.status !== "confirmed") {
      return json({ ok: true, skipped: `reservation is ${r.status}, not confirmed` });
    }
    if (r.reminder_state !== "scheduled") {
      return json({ ok: true, skipped: "reminder not scheduled" });
    }
  } else {
    // callback_retry: only a still-live verdict warrants re-ringing the guest.
    const confirmationDue = r.status === "confirmed" && !r.consumer_confirmed_at;
    const counterDue = r.status === "pending" &&
      normalizeAlternatives(r.alternatives).length > 0;
    if (!confirmationDue && !counterDue) {
      return json({ ok: true, skipped: "callback no longer applicable" });
    }
  }

  const { data: settings } = await admin
    .from("app_config")
    .select("reservations_config, agents_config")
    .eq("id", 1)
    .maybeSingle();
  const cfg = coerceReservationsCallConfig(settings?.reservations_config);

  if (intent === "reminder" && !cfg.reminder.enabled) {
    return json({ ok: true, skipped: "reminder knob off" });
  }

  // ── Kill switch: no outbound reservation call of ANY kind while on ────────
  // Park (not drop) so flipping the switch off resumes everything via the
  // cron within a minute of each parked clock coming due.
  if (cfg.limits.killSwitch) {
    const inHalfHour = new Date(Date.now() + 30 * 60_000).toISOString();
    const parkPatch: ReservationPatch = intent === "book"
      ? { attempts_state: "scheduled", next_attempt_at: inHalfHour }
      : intent === "callback_retry"
      ? { callback_state: "scheduled", callback_next_attempt_at: inHalfHour }
      : intent === "reminder"
      ? { reminder_state: "scheduled", reminder_at: inHalfHour }
      : { notice_state: "scheduled", notice_next_at: inHalfHour };
    await writeReservation(admin, {
      mode: "update",
      id: reservationId,
      patch: { ...parkPatch, last_call_status: "kill switch on — all calls held" },
    });
    return json({ ok: true, skipped: "kill switch on — parked 30 min" });
  }

  // Fleet routing: leg 1 rides eleven-a1 (booker), leg 2 eleven-a2
  // (confirmer) — ids written by sync-reservationist mode "fleet"; fallback is
  // the original single agent, whose prompt branches on {{call_direction}}.
  const fleet = ((settings?.agents_config as Record<string, unknown> | null)?.agents ?? null) as
    | Record<string, { id?: string } | undefined>
    | null;
  const bookerAgentId = fleet?.a1?.id?.trim() || reservationAgentId();
  const confirmerAgentId = fleet?.a2?.id?.trim() || reservationAgentId();

  const { data: placeRow } = await admin
    .from("places")
    .select("name, phone, reservation_channel, reservation_target, hours, lng")
    .eq("id", placeId)
    .maybeSingle();
  const place = (placeRow ?? null) as {
    name?: string | null;
    phone?: string | null;
    reservation_channel?: string | null;
    reservation_target?: string | null;
    hours?: unknown;
    lng?: number | null;
  } | null;

  // ── Resolve the business number: row override → test mode → place endpoint ─
  let businessNumber = (r.place_phone ?? "").trim();
  let via = "row";
  if (!businessNumber) {
    if (cfg.testCall.enabled) {
      businessNumber = cfg.testCall.number;
      via = "test-mode number";
    } else {
      // Dial only when the door is Phone (or never picked — keep the
      // places.phone fallback so existing rows still reach the venue).
      // WhatsApp / Instagram / Web / Not are not voice endpoints.
      const channel = place?.reservation_channel ?? null;
      if (
        channel === "none" || channel === "web" ||
        channel === "whatsapp" || channel === "instagram"
      ) {
        businessNumber = "";
        via = `place ${channel} endpoint — no voice dial`;
      } else {
        const endpoint = channel === "phone"
          ? (place?.reservation_target ?? "").trim()
          : "";
        businessNumber = endpoint || (place?.phone ?? "").trim();
        via = endpoint ? "place phone endpoint" : "place.phone fallback";
      }
    }
  }
  const dialsVenue = intent === "book" ||
    (intent === "cancel_notice" && r.notice_kind === "venue_cancel");
  if (!businessNumber && dialsVenue) {
    // Only a venue-dialing errand dies on a missing venue number — and a
    // cancel notice must never corrupt attempts_state (it's 'cancelled').
    if (intent === "book") {
      await writeReservation(admin, {
        mode: "update",
        id: reservationId,
        patch: { attempts_state: "error", last_call_status: `no number to dial (${via})` },
      });
    } else {
      await writeReservation(admin, {
        mode: "update",
        id: reservationId,
        patch: {
          notice_state: "failed",
          last_call_status: `cancel notice — no venue number (${via})`,
        },
      });
    }
    return json({ ok: false, error: `no number to dial (${via})` }, 422);
  }

  const consumer = (r.consumer ?? null) as ConsumerName | null;
  const consumerNumber = (r.consumer_phone ?? consumer?.phone ?? "").trim();

  const runId = crypto.randomUUID();
  const modificationOfIso = typeof r.modification_of === "string" ? r.modification_of : null;
  const legVars: ReservationLegVars = {
    placeName: place?.name?.trim() || "el lugar",
    guestName: guestName(consumer),
    guestPhone: consumerNumber,
    referenceCode: (r.reference_code ?? "").trim(),
    partySize: r.party_size,
    dateEs: esDate(r.reserved_at),
    timeEs: esTime(r.reserved_at),
    specialRequests: (r.notes ?? "").trim(),
    runId,
    modificationOf: modificationOfIso
      ? { dateEs: esDate(modificationOfIso), timeEs: esTime(modificationOfIso) }
      : null,
  };
  const placeLng = typeof place?.lng === "number" ? place.lng : null;

  if (intent === "cancel_notice") {
    const kind = r.notice_kind as "venue_cancel" | "guest_cancel";
    const toNumber = kind === "venue_cancel" ? businessNumber : consumerNumber;
    if (!toNumber) {
      await writeReservation(admin, {
        mode: "update",
        id: reservationId,
        patch: {
          notice_state: "failed",
          last_call_status: `cancel notice (${kind}) — no number to dial`,
        },
      });
      return json({ ok: false, error: "no number to dial for the notice" }, 422);
    }
    // Claim it compare-and-swap style: the cancel EF and the cron may both
    // fire — whoever flips pending/scheduled → running places the call. The
    // claim rotates run_id so a stale runner can never write over this one.
    // Routed through validateReservationPatch directly (not the writeReservation
    // door — this update's `.in("notice_state", …)` filter is a shape the door
    // doesn't model; see reservation-doc.ts's header and the same idiom in
    // business-web-confirm-reservation / supabase-cron-reservation-retries).
    const noticeClaimValidated = validateReservationPatch({
      notice_state: "running",
      notice_next_at: null,
      run_id: runId,
      claimed_at: new Date().toISOString(),
    });
    if (!noticeClaimValidated.ok) {
      return json({ ok: false, error: noticeClaimValidated.error }, 500);
    }
    const { data: claimed } = await admin
      .from("reservation_tickets")
      .update(noticeClaimValidated.patch)
      .eq("id", reservationId)
      .in("notice_state", ["pending", "scheduled"])
      .select("id");
    if (!claimed?.length) return json({ ok: true, skipped: "notice already claimed" });
    // A venue RELEASE after a failed modification speaks about the OLD slot —
    // the one the venue is still holding — not the ticket's new ask.
    const noticeLegVars: ReservationLegVars =
      kind === "venue_cancel" && modificationOfIso && r.status !== "cancelled"
        ? { ...legVars, dateEs: esDate(modificationOfIso), timeEs: esTime(modificationOfIso) }
        : legVars;
    runInBackground(
      runCancelNotice({
        admin,
        reservationId,
        runId,
        key: elevenKey,
        kind,
        attemptsDone: typeof r.notice_attempts === "number" ? r.notice_attempts : 0,
        outageRetries: typeof r.outage_retries === "number" ? r.outage_retries : 0,
        toNumber,
        agentId: kind === "venue_cancel" ? bookerAgentId : confirmerAgentId,
        legVars: noticeLegVars,
        placeHours: place?.hours ?? null,
        placeLng,
        reservedAtIso: r.reserved_at,
        projectId: placeId,
        venueCallCap: cfg.limits.venueCallsPerPlacePerDay,
        guestNotify,
      }),
    );
    return json({ ok: true, started: true, intent, reservation_id: reservationId });
  }

  if (intent === "callback_retry") {
    if (guestNotify === "app") {
      await writeReservation(admin, {
        mode: "update",
        id: reservationId,
        patch: {
          callback_state: "skipped",
          callback_next_attempt_at: null,
          last_call_status: "callback retry — guest prefers app-only; no call",
        },
      });
      return json({ ok: true, skipped: "guest prefers app-only" });
    }
    if (!consumerNumber) {
      await writeReservation(admin, {
        mode: "update",
        id: reservationId,
        patch: {
          callback_state: "skipped",
          callback_next_attempt_at: null,
          last_call_status: "callback retry — no guest number",
        },
      });
      return json({ ok: true, skipped: "no guest number" });
    }
    // Claim it CAS-style — a single `.eq()` match beyond id, so this is the
    // writeReservation door itself, not a hand-built query.
    const callbackClaim = await writeReservation(admin, {
      mode: "update",
      id: reservationId,
      patch: {
        callback_state: "calling",
        callback_next_attempt_at: null,
        run_id: runId,
        claimed_at: new Date().toISOString(),
      },
      match: { callback_state: "scheduled" },
      select: "id",
    });
    if (!callbackClaim.ok || !callbackClaim.row) {
      return json({ ok: true, skipped: "callback already claimed" });
    }
    const context = r.status === "confirmed" ? "confirmation" as const : "counter_offer" as const;
    runInBackground(
      runCallbackRetry({
        admin,
        reservationId,
        runId,
        key: elevenKey,
        context,
        alternativesText: context === "counter_offer"
          ? alternativesToSpeech(normalizeAlternatives(r.alternatives))
          : "",
        consumerNumber,
        confirmerAgentId,
        legVars,
        attemptsDone: typeof r.callback_attempts === "number" ? r.callback_attempts : 0,
        outageRetries: typeof r.outage_retries === "number" ? r.outage_retries : 0,
        placeLng,
        reservedAtIso: r.reserved_at,
        guestNotify,
      }),
    );
    return json({ ok: true, started: true, intent, reservation_id: reservationId });
  }

  if (intent === "reminder") {
    if (guestNotify === "app") {
      await writeReservation(admin, {
        mode: "update",
        id: reservationId,
        patch: {
          reminder_state: "skipped",
          reminder_at: null,
          last_call_status: "reminder — guest prefers app-only; no call",
        },
      });
      return json({ ok: true, skipped: "guest prefers app-only" });
    }
    const reminderClaim = await writeReservation(admin, {
      mode: "update",
      id: reservationId,
      patch: {
        reminder_state: "calling",
        reminder_at: null,
        run_id: runId,
        claimed_at: new Date().toISOString(),
      },
      match: { reminder_state: "scheduled" },
      select: "id",
    });
    if (!reminderClaim.ok || !reminderClaim.row) {
      return json({ ok: true, skipped: "reminder already claimed" });
    }
    runInBackground(
      runReminder({
        admin,
        reservationId,
        runId,
        key: elevenKey,
        consumerNumber,
        confirmerAgentId,
        legVars,
        outageRetries: typeof r.outage_retries === "number" ? r.outage_retries : 0,
        reservedAtIso: r.reserved_at,
        placeLng,
        guestNotify,
        reminderEnabled: cfg.reminder.enabled,
      }),
    );
    return json({ ok: true, started: true, intent, reservation_id: reservationId });
  }

  // Claim the booking run compare-and-swap style: only ONE engine may flip a
  // non-running pending ticket to running (the old read-then-write let two
  // concurrent invokes both pass the gate and double-dial the venue). The
  // claim rotates run_id — every background write is guarded by it.
  // Routed through validateReservationPatch directly (not the writeReservation
  // door — this update's `.or(...)` filter is a shape the door doesn't model;
  // see reservation-doc.ts's header and the same idiom in
  // business-web-confirm-reservation / supabase-cron-reservation-retries).
  const bookClaimValidated = validateReservationPatch({
    attempts_state: "running",
    run_id: runId,
    claimed_at: new Date().toISOString(),
    next_attempt_at: null,
    attempts_planned: cfg.attempts,
    place_phone: businessNumber,
    consumer_phone: consumerNumber || null,
    // A stale verdict from a previous negotiation round must never be read
    // as this run's outcome — and a new errand starts a fresh guest ladder.
    reported_verdict: null,
    callback_attempts: 0,
    callback_next_attempt_at: null,
  });
  if (!bookClaimValidated.ok) {
    return json({ ok: false, error: bookClaimValidated.error }, 500);
  }
  const { data: bookClaim } = await admin
    .from("reservation_tickets")
    .update(bookClaimValidated.patch)
    .eq("id", reservationId)
    .eq("status", "pending")
    .or("attempts_state.is.null,attempts_state.neq.running")
    .select("id");
  if (!bookClaim?.length) {
    return json({ ok: true, skipped: "booking already claimed" });
  }

  runInBackground(
    runIntents({
      admin,
      reservationId,
      attemptsPlanned: cfg.attempts,
      attemptsDone: typeof r.call_attempts === "number" ? r.call_attempts : 0,
      priorAttempts: Array.isArray(r.attempts) ? (r.attempts as AttemptEntry[]) : [],
      placeHours: place?.hours ?? null,
      placeLng,
      businessNumber,
      consumerNumber,
      bookerAgentId,
      confirmerAgentId,
      legVars,
      callbackAttemptsDone: 0,
      reservedAtIso: r.reserved_at,
      runId,
      projectId: placeId,
      outageRetries: typeof r.outage_retries === "number" ? r.outage_retries : 0,
      venueCallCap: cfg.limits.venueCallsPerPlacePerDay,
      modificationOfIso,
      guestNotify,
    }),
  );

  return json({
    ok: true,
    started: true,
    reservation_id: reservationId,
    dialed: businessNumber,
    via,
  });
});
