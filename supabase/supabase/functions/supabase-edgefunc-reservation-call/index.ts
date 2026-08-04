// Supabase Edge Function — supabase-edgefunc-reservation-call (internal / artificial caller)
//
// THE Reservationist call engine — the sandbox AND the admin Playground are
// retired (2026-07-27): every ticket is a real public.reservations row and
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
//   business — reservations.business_number when pre-resolved (test tickets),
//     else config testCall (test mode defaults ON → never rings a real venue
//     by accident), else the place's products.reservations phone endpoint.
//   consumer — reservations.consumer_number when pre-resolved, else the
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
import { corsPreflight, json, readJson } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { requireInternalCaller } from "../_shared/internal.ts";
import { coerceReservationsCallConfig } from "../_shared/reservations-config.ts";
import {
  consumerFromNumber,
  elevenLabsKey,
  getConversationStatus,
  placeOutboundCall,
  reservationAgentId,
  reservationFromNumber,
  resolvePhoneNumberId,
} from "../_shared/elevenlabs.ts";
import { nextAttemptAt } from "../_shared/reservation-retry.ts";
import { nextGuestCallAt } from "../_shared/reservation-callback.ts";
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
  legDynamicVariables,
  type ReservationLegVars,
  venueCancelNoticeFirstMessage,
  venueCancelNoticePrompt,
} from "../_shared/reservation-legs.ts";

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

type AttemptEntry = {
  n: number;
  started_at: string;
  conversation_id: string | null;
  result: string;
};

// Watch one placed call until we can tell whether it was answered.
async function watchUntilAnswered(
  key: string,
  conversationId: string,
  budgetMs: number,
): Promise<"answered" | "no_answer" | "unknown"> {
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    await delay(WATCH_POLL_MS);
    const s = await getConversationStatus(key, conversationId);
    if (!s.ok) continue; // transient fetch trouble — keep watching until budget
    if (s.status === "failed") return "no_answer";
    if (s.status === "in-progress" || s.status === "processing" || s.status === "done") {
      return "answered";
    }
  }
  return "unknown";
}

// What the Booker explicitly recorded mid-call via a1_report_outcome — the
// authoritative verdict; the analysis heuristic is only the fallback.
async function readReportedVerdict(
  admin: SupabaseClient,
  id: string,
): Promise<{ verdict: string | null; alternativesText: string; note: string }> {
  const { data } = await admin
    .from("reservations")
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
): Promise<{ ok: true; venueLineId: string; guestLineId: string } | { ok: false; error: string }> {
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
  return { ok: true, venueLineId: phoneRes.id, guestLineId };
}

// Leg 2/3 · business → consumer — ONE Confirmer call to the human, plus the
// retry ladder (RESERVATIONS-PROTOCOL.md leg 3): a missed call parks
// callback_state='scheduled' + callback_next_attempt_at per nextGuestCallAt
// (+10 min, then +1 h, cap 3, quiet hours 09:00–22:00 venue-local, nothing
// within 30 min of the slot) and the retry cron re-fires this engine with
// intent "callback_retry". Past the ladder the app is the fallback — never a
// fourth ring.
async function callGuest(input: {
  admin: SupabaseClient;
  reservationId: string;
  key: string;
  phoneNumberId: string;
  context: "confirmation" | "counter_offer";
  alternativesText: string;
  consumerNumber: string;
  confirmerAgentId: string;
  legVars: ReservationLegVars;
  /** Guest calls already placed for this errand (ladder position). */
  attemptsDone: number;
  placeLng: number | null;
  reservedAtIso: string;
}): Promise<void> {
  const { admin, reservationId } = input;
  const record = async (patch: Record<string, unknown>) => {
    await admin.from("reservations").update(patch).eq("id", reservationId);
  };
  const label = input.context === "confirmation" ? "confirmed" : "counter-offer";
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
  const call = await placeOutboundCall(input.key, {
    agentId: input.confirmerAgentId,
    agentPhoneNumberId: input.phoneNumberId,
    toNumber: input.consumerNumber,
    dynamicVariables: legDynamicVariables("guest_confirmation", input.legVars, {
      callContext: input.context,
      venueAlternatives: input.alternativesText,
    }),
    overrides: {
      prompt: guestLegPrompt(input.legVars),
      firstMessage: guestLegFirstMessage(input.legVars),
      language: "es",
    },
  });
  if (!call.ok) {
    await parkOrGiveUp("failed", `guest call failed: ${call.error}`);
    return;
  }
  await record({
    callback_state: "ringing",
    callback_conversation_id: call.conversationId,
    last_call_status: `${label} — calling the guest`,
  });
  const outcome = call.conversationId
    ? await watchUntilAnswered(input.key, call.conversationId, CALLBACK_BUDGET_MS)
    : "unknown";
  if (outcome === "answered") {
    await record({
      callback_attempts: n,
      callback_state: "answered",
      callback_next_attempt_at: null,
      last_call_status: `${label} — guest notified`,
    });
    return;
  }
  await parkOrGiveUp(
    outcome,
    outcome === "no_answer" ? "guest didn't answer" : "guest call outcome unknown",
  );
}

// Leg 3 resume — the cron woke a parked callback; same call, next rung.
async function runCallbackRetry(input: {
  admin: SupabaseClient;
  reservationId: string;
  key: string;
  context: "confirmation" | "counter_offer";
  alternativesText: string;
  consumerNumber: string;
  confirmerAgentId: string;
  legVars: ReservationLegVars;
  attemptsDone: number;
  placeLng: number | null;
  reservedAtIso: string;
}): Promise<void> {
  const lines = await resolveLines(input.key);
  if (!lines.ok) {
    await input.admin
      .from("reservations")
      .update({
        callback_state: "failed",
        callback_next_attempt_at: null,
        last_call_status: `callback retry — line resolution failed: ${lines.error}`.slice(0, 200),
      })
      .eq("id", input.reservationId);
    return;
  }
  await callGuest({ ...input, phoneNumberId: lines.guestLineId });
}

// Legs 5/6 · the cancellation notice — tell the side that DIDN'T cancel.
// venue_cancel → a1 rings the venue to release the held table (paced by the
// venue's own hours, cap 2); guest_cancel → a2 rings the guest (guest ladder,
// cap 3). Answered = delivered — a voicemail pickup counts, the message is
// left either way. Exhausted → notice_state='failed', visible for ops.
const VENUE_NOTICE_ATTEMPTS = 2;
async function runCancelNotice(input: {
  admin: SupabaseClient;
  reservationId: string;
  key: string;
  kind: "venue_cancel" | "guest_cancel";
  attemptsDone: number;
  toNumber: string;
  agentId: string;
  legVars: ReservationLegVars;
  placeHours: unknown;
  placeLng: number | null;
  reservedAtIso: string;
}): Promise<void> {
  const { admin, reservationId } = input;
  const record = async (patch: Record<string, unknown>) => {
    await admin.from("reservations").update(patch).eq("id", reservationId);
  };
  const isVenue = input.kind === "venue_cancel";
  const who = isVenue ? "venue" : "guest";
  const n = input.attemptsDone + 1;
  const park = async (failNote: string) => {
    const next = isVenue
      ? (n < VENUE_NOTICE_ATTEMPTS ? nextAttemptAt(input.placeHours, input.placeLng) : null)
      : nextGuestCallAt(
        n,
        input.placeLng,
        input.reservedAtIso ? new Date(input.reservedAtIso) : null,
      );
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
  try {
    const lines = await resolveLines(input.key);
    if (!lines.ok) {
      await park(`line resolution failed: ${lines.error}`);
      return;
    }
    const call = await placeOutboundCall(input.key, {
      agentId: input.agentId,
      agentPhoneNumberId: isVenue ? lines.venueLineId : lines.guestLineId,
      toNumber: input.toNumber,
      dynamicVariables: legDynamicVariables(
        isVenue ? "business_booking" : "guest_confirmation",
        input.legVars,
        { callContext: isVenue ? "cancellation" : "cancelled_by_venue", venueAlternatives: "" },
      ),
      overrides: {
        prompt: isVenue
          ? venueCancelNoticePrompt(input.legVars)
          : guestCancelNoticePrompt(input.legVars),
        firstMessage: isVenue
          ? venueCancelNoticeFirstMessage(input.legVars)
          : guestCancelNoticeFirstMessage(input.legVars),
        language: "es",
      },
    });
    if (!call.ok) {
      await park(`call failed: ${call.error}`);
      return;
    }
    await record({
      notice_conversation_id: call.conversationId,
      last_call_status: `cancel notice (${who}) — ringing`,
    });
    const outcome = call.conversationId
      ? await watchUntilAnswered(input.key, call.conversationId, ANSWER_BUDGET_MS)
      : "unknown";
    if (outcome === "answered") {
      await record({
        notice_attempts: n,
        notice_state: "done",
        notice_next_at: null,
        last_call_status: `cancel notice (${who}) delivered`,
      });
      return;
    }
    await park(outcome === "no_answer" ? "no answer" : "outcome unknown");
  } catch (e) {
    await record({
      notice_state: "failed",
      notice_next_at: null,
      last_call_status: `cancel notice (${who}) crashed: ${
        e instanceof Error ? e.message : "run crashed"
      }`.slice(0, 200),
    });
  }
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
}): Promise<void> {
  const { admin, reservationId, attemptsPlanned, legVars } = input;
  // Prior runs' entries stay in the log; this run appends to them.
  const attempts: AttemptEntry[] = [...input.priorAttempts];
  const record = async (patch: Record<string, unknown>) => {
    await admin.from("reservations").update(patch).eq("id", reservationId);
  };
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
      key,
      phoneNumberId,
      context,
      alternativesText,
      consumerNumber: input.consumerNumber,
      confirmerAgentId: input.confirmerAgentId,
      legVars,
      attemptsDone: input.callbackAttemptsDone,
      placeLng: input.placeLng,
      reservedAtIso: input.reservedAtIso,
    });

  try {
    const key = elevenLabsKey();
    if (!key) {
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

      const call = await placeOutboundCall(key, {
        agentId: input.bookerAgentId,
        agentPhoneNumberId: lines.venueLineId,
        toNumber: input.businessNumber,
        dynamicVariables: legDynamicVariables("business_booking", legVars),
        overrides: {
          prompt: businessLegPrompt(legVars),
          firstMessage: businessLegFirstMessage(legVars),
          language: "es",
        },
      });

      if (!call.ok) {
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

      const outcome = call.conversationId
        ? await watchUntilAnswered(key, call.conversationId, ANSWER_BUDGET_MS)
        : "unknown";

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
      last_call_status: `no answer after ${attemptsPlanned} intent${
        attemptsPlanned === 1 ? "" : "s"
      }`,
    });
  } catch (e) {
    await record({
      attempts_state: "error",
      callback_state: "skipped",
      last_call_status: `failed: ${e instanceof Error ? e.message : "run crashed"}`.slice(0, 200),
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

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
  const intent = bodyRes.body.intent === "callback_retry" || bodyRes.body.intent === "cancel_notice"
    ? bodyRes.body.intent
    : "book";

  if (!elevenLabsKey()) {
    return json({ ok: false, error: "ELEVENLABS_KEY not configured" }, 503);
  }

  const admin = adminClient(envRes.env);

  // Fetch place by project_id separately — reservations.project_id has no
  // PostgREST FK hint to places, so an embed 500s. places.id == project_id.
  const { data: r, error: rErr } = await admin
    .from("reservations")
    .select(
      "id, reference_code, reserved_at, party_size, notes, status, project_id, is_test, business_number, consumer_number, attempts_state, attempts, call_attempts, callback_attempts, guest_confirmed_at, alternatives, notice_kind, notice_state, notice_attempts, consumer:consumers(full_name, first_name, last_name, phone)",
    )
    .eq("id", reservationId)
    .maybeSingle();
  if (rErr) return json({ ok: false, error: rErr.message }, 500);
  if (!r) return json({ ok: false, error: "reservation not found" }, 404);
  // Per-intent gates — each errand has its own idea of a live ticket.
  if (intent === "book") {
    if (r.status !== "pending") {
      return json({ ok: true, skipped: `reservation is ${r.status}, not pending` });
    }
    if (r.attempts_state === "running") {
      return json({ ok: true, skipped: "intents already running" });
    }
  } else if (intent === "cancel_notice") {
    if (r.status !== "cancelled") {
      return json({ ok: true, skipped: `reservation is ${r.status}, not cancelled` });
    }
    if (r.notice_kind !== "venue_cancel" && r.notice_kind !== "guest_cancel") {
      return json({ ok: true, skipped: "no cancellation notice owed" });
    }
  } else {
    // callback_retry: only a still-live verdict warrants re-ringing the guest.
    const confirmationDue = r.status === "confirmed" && !r.guest_confirmed_at;
    const counterDue = r.status === "pending" &&
      normalizeAlternatives(r.alternatives).length > 0;
    if (!confirmationDue && !counterDue) {
      return json({ ok: true, skipped: "callback no longer applicable" });
    }
  }

  const { data: settings } = await admin
    .from("app_settings")
    .select("reservations_config, agents_config")
    .eq("id", 1)
    .maybeSingle();
  const cfg = coerceReservationsCallConfig(settings?.reservations_config);

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
    .select("name, phone, products, hours, lng")
    .eq("id", r.project_id)
    .maybeSingle();
  const place = (placeRow ?? null) as {
    name?: string | null;
    phone?: string | null;
    products?: Record<string, unknown> | null;
    hours?: unknown;
    lng?: number | null;
  } | null;

  // ── Resolve the business number: row override → test mode → place endpoint ─
  let businessNumber = (r.business_number ?? "").trim();
  let via = "row";
  if (!businessNumber) {
    if (cfg.testCall.enabled) {
      businessNumber = cfg.testCall.number;
      via = "test-mode number";
    } else {
      const resv = (place?.products?.reservations ?? null) as
        | { channel?: string; value?: string }
        | null;
      businessNumber =
        (resv?.channel === "phone" && resv.value ? resv.value : place?.phone ?? "")?.trim() ?? "";
      via = "place phone endpoint";
    }
  }
  const dialsVenue = intent === "book" ||
    (intent === "cancel_notice" && r.notice_kind === "venue_cancel");
  if (!businessNumber && dialsVenue) {
    // Only a venue-dialing errand dies on a missing venue number — and a
    // cancel notice must never corrupt attempts_state (it's 'cancelled').
    if (intent === "book") {
      await admin
        .from("reservations")
        .update({ attempts_state: "error", last_call_status: `no number to dial (${via})` })
        .eq("id", reservationId);
    } else {
      await admin
        .from("reservations")
        .update({ notice_state: "failed", last_call_status: `cancel notice — no venue number (${via})` })
        .eq("id", reservationId);
    }
    return json({ ok: false, error: `no number to dial (${via})` }, 422);
  }

  const consumer = (r.consumer ?? null) as ConsumerName | null;
  const consumerNumber = (r.consumer_number ?? consumer?.phone ?? "").trim();

  const legVars: ReservationLegVars = {
    venueName: place?.name?.trim() || "el lugar",
    guestName: guestName(consumer),
    guestPhone: consumerNumber,
    referenceCode: (r.reference_code ?? "").trim(),
    partySize: r.party_size,
    dateEs: esDate(r.reserved_at),
    timeEs: esTime(r.reserved_at),
    specialRequests: (r.notes ?? "").trim(),
  };
  const placeLng = typeof place?.lng === "number" ? place.lng : null;

  if (intent === "cancel_notice") {
    const kind = r.notice_kind as "venue_cancel" | "guest_cancel";
    const toNumber = kind === "venue_cancel" ? businessNumber : consumerNumber;
    if (!toNumber) {
      await admin
        .from("reservations")
        .update({
          notice_state: "failed",
          last_call_status: `cancel notice (${kind}) — no number to dial`,
        })
        .eq("id", reservationId);
      return json({ ok: false, error: "no number to dial for the notice" }, 422);
    }
    // Claim it compare-and-swap style: the cancel EF and the cron may both
    // fire — whoever flips pending/scheduled → running places the call.
    const { data: claimed } = await admin
      .from("reservations")
      .update({ notice_state: "running", notice_next_at: null })
      .eq("id", reservationId)
      .in("notice_state", ["pending", "scheduled"])
      .select("id");
    if (!claimed?.length) return json({ ok: true, skipped: "notice already claimed" });
    runInBackground(
      runCancelNotice({
        admin,
        reservationId,
        key: elevenLabsKey()!,
        kind,
        attemptsDone: typeof r.notice_attempts === "number" ? r.notice_attempts : 0,
        toNumber,
        agentId: kind === "venue_cancel" ? bookerAgentId : confirmerAgentId,
        legVars,
        placeHours: place?.hours ?? null,
        placeLng,
        reservedAtIso: r.reserved_at,
      }),
    );
    return json({ ok: true, started: true, intent, reservation_id: reservationId });
  }

  if (intent === "callback_retry") {
    if (!consumerNumber) {
      await admin
        .from("reservations")
        .update({
          callback_state: "skipped",
          callback_next_attempt_at: null,
          last_call_status: "callback retry — no guest number",
        })
        .eq("id", reservationId);
      return json({ ok: true, skipped: "no guest number" });
    }
    const { data: claimed } = await admin
      .from("reservations")
      .update({ callback_state: "calling", callback_next_attempt_at: null })
      .eq("id", reservationId)
      .eq("callback_state", "scheduled")
      .select("id");
    if (!claimed?.length) return json({ ok: true, skipped: "callback already claimed" });
    const context = r.status === "confirmed" ? "confirmation" as const : "counter_offer" as const;
    runInBackground(
      runCallbackRetry({
        admin,
        reservationId,
        key: elevenLabsKey()!,
        context,
        alternativesText: context === "counter_offer"
          ? alternativesToSpeech(normalizeAlternatives(r.alternatives))
          : "",
        consumerNumber,
        confirmerAgentId,
        legVars,
        attemptsDone: typeof r.callback_attempts === "number" ? r.callback_attempts : 0,
        placeLng,
        reservedAtIso: r.reserved_at,
      }),
    );
    return json({ ok: true, started: true, intent, reservation_id: reservationId });
  }

  // Mark running + persist the resolved numbers, then ack — the legs continue
  // in the background task.
  await admin
    .from("reservations")
    .update({
      attempts_state: "running",
      next_attempt_at: null,
      attempts_planned: cfg.attempts,
      business_number: businessNumber,
      consumer_number: consumerNumber || null,
      // A stale verdict from a previous negotiation round must never be read
      // as this run's outcome — and a new errand starts a fresh guest ladder.
      reported_verdict: null,
      callback_attempts: 0,
      callback_next_attempt_at: null,
    })
    .eq("id", reservationId);

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
