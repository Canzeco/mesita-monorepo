// supabase-edgefunc-place-reservation-call · the leg runners.
//
// Everything that runs AFTER the HTTP response, inside the background task:
// the booking call (leg 1), the guest call (legs 2/3), the cancellation
// notice (legs 5/6) and the reminder (leg 7). index.ts validates, claims the
// ticket (rotating run_id) and hands one of these to runInBackground. Every
// ticket write here is guarded by that run_id.
//
// A runner PLACES one call, saves its conversation_id on the ticket and
// returns (MESITA-3618). It never watches the call: how the call ended
// arrives by message — eleven-webhook-post-call, or the cron's one read of a
// call still owed after 10 min — and _shared/reservation-call-outcome.ts
// applies it. A placed call is never redialed by a crash.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  consumerFromNumber,
  placeOutboundCall,
  reservationFromNumber,
  resolveElevenLabsKey,
  resolvePhoneNumberId,
} from "../_shared/elevenlabs.ts";
import { nextAttemptAt } from "../_shared/reservation-retry.ts";
import { nextGuestCallAt, spentLadderPatch } from "../_shared/reservation-callback.ts";
import { REMINDER_MAX_ATTEMPTS, reminderParkPatch } from "../_shared/reservation-reminder.ts";
import { classifyPlacementFailure, noticeNextAt, outageRetryAt } from "../_shared/reservation-run.ts";
import { legDynamicVariables, type ReservationLegVars } from "../_shared/reservation-legs.ts";
import {
  type ReservationAttempt,
  type ReservationPatch,
  writeReservation,
} from "../_shared/reservation-doc.ts";
import type { ReservationOutcome } from "../_shared/reservation-notification.ts";
import { type DeadEnd, type DeadEndIo, endAtDeadEnd } from "../_shared/reservation-dead-end.ts";

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

// Per-place daily place-call meter (abuse guard): atomic bump, returns the
// count AFTER this call. Failure to count must never block a call — the
// meter is a guard, not a ledger.
async function bumpPlaceCalls(admin: SupabaseClient, projectId: string): Promise<number | null> {
  const { data, error } = await admin.rpc("bump_reservation_call_counter", { pid: projectId });
  if (error) {
    console.error(`[reservation-call] place-call counter failed: ${error.message}`);
    return null;
  }
  return typeof data === "number" ? data : null;
}

// One line per audience: the place leg dials from the business line, the guest
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
// (+10 min, then +1 h, cap 3, quiet hours 09:00–22:00 place-local, nothing
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
      // Plain place confirm: in-app state IS the ack. Counter-offers stay
      // open for the guest to pick an alternative in the app.
      ...(input.context === "confirmation"
        ? { consumer_confirmed_at: new Date().toISOString() }
        : {}),
      last_call_state: `${label} — guest prefers app-only; no call`,
    });
    return;
  }
  if (!input.consumerNumber) {
    await record({
      callback_state: "skipped",
      callback_next_attempt_at: null,
      last_call_state: `${label} — no guest number for the callback`,
    });
    return;
  }
  const n = input.attemptsDone + 1;
  // Park the next ladder rung, or go quiet for good once the ladder is spent.
  const parkOrGiveUp = async (failNote: string) => {
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
        last_call_state: `${label} — ${failNote} — ${next.reason}`.slice(0, 200),
      });
    } else {
      // Spent ladder: terminal `failed`, the reason rides in last_call_state.
      await record(spentLadderPatch(n, label, failNote));
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
        last_call_state: `${label} — ${why} — ${next.reason}`.slice(0, 200),
      });
    } else {
      await record({
        callback_state: "failed",
        callback_next_attempt_at: null,
        last_call_state: `${label} — ${why} — platform outage persisted; needs attention`
          .slice(0, 200),
      });
    }
  };
  const call = await placeOutboundCall(input.key, {
    agentId: input.confirmerAgentId,
    agentPhoneNumberId: input.phoneNumberId,
    toNumber: input.consumerNumber,
    dynamicVariables: legDynamicVariables(input.legVars, {
      callContext: input.context,
      placeAlternatives: input.alternativesText,
    }),
  });
  if (!call.ok) {
    if (classifyPlacementFailure(call.httpStatus) === "platform") {
      await outagePark(`guest call not placed (HTTP ${call.httpStatus ?? "network"})`);
    } else {
      await parkOrGiveUp(`guest call failed: ${call.error}`);
    }
    return;
  }
  if (!call.conversationId) {
    // No id = no way to learn how it ended; count it as a missed rung.
    await parkOrGiveUp("guest call placed without a conversation id");
    return;
  }
  // Placed. How it ended arrives by message (_shared/reservation-call-outcome.ts).
  await record({
    callback_state: "ringing",
    callback_conversation_id: call.conversationId,
    last_call_state: `${label} — calling the guest`,
  });
}

// Leg 3 resume — the cron woke a parked callback; same call, next rung.
export async function runCallbackRetry(input: {
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
        last_call_state: `callback retry — line resolution failed: ${lines.error}`.slice(0, 200),
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
export async function runReminder(input: {
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
        last_call_state: "reminder — guest prefers app-only; no call",
      });
      return;
    }
    // Knob-off after a race with cron: restore the park. Never skip-then-lose
    // the timestamp — flipping ON must still cover this held table.
    if (!input.reminderEnabled) {
      const reservedAt = input.reservedAtIso ? new Date(input.reservedAtIso) : null;
      await record({
        ...reminderParkPatch(input.placeLng, reservedAt, input.guestNotify),
        last_call_state: "reminder — operator knob off; park kept",
      });
      return;
    }
    const reservedAt = input.reservedAtIso ? new Date(input.reservedAtIso) : null;
    const cutoff = reservedAt ? reservedAt.getTime() - 30 * 60_000 : 0;
    if (!reservedAt || Date.now() > cutoff) {
      await record({
        reminder_state: "skipped",
        reminder_at: null,
        last_call_state: "reminder skipped — past the 30 min cutoff (or no slot)",
      });
      return;
    }
    const lines = await resolveLines(input.key);
    if (!lines.ok) {
      await record({
        reminder_state: "failed",
        reminder_at: null,
        last_call_state: `reminder — line resolution failed: ${lines.error}`.slice(0, 200),
      });
      return;
    }
    if (!input.consumerNumber) {
      await record({
        reminder_state: "skipped",
        reminder_at: null,
        last_call_state: "reminder — no guest number",
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
          last_call_state: `reminder — ${why} — ${next.reason}`.slice(0, 200),
        });
      } else {
        await record({
          reminder_state: "failed",
          reminder_at: null,
          last_call_state: `reminder — ${why} — platform outage persisted; needs attention`
            .slice(0, 200),
        });
      }
    };
    const call = await placeOutboundCall(input.key, {
      agentId: input.confirmerAgentId,
      agentPhoneNumberId: lines.guestLineId,
      toNumber: input.consumerNumber,
      dynamicVariables: legDynamicVariables(input.legVars, { callContext: "reminder" }),
    });
    if (!call.ok) {
      if (classifyPlacementFailure(call.httpStatus) === "platform") {
        await outagePark(`not placed (HTTP ${call.httpStatus ?? "network"})`);
      } else {
        await record({
          reminder_attempts: REMINDER_MAX_ATTEMPTS,
          reminder_state: "skipped",
          reminder_at: null,
          last_call_state: `reminder failed: ${call.error} — app is the fallback`.slice(0, 200),
        });
      }
      return;
    }
    if (!call.conversationId) {
      await record({
        reminder_attempts: REMINDER_MAX_ATTEMPTS,
        reminder_state: "skipped",
        reminder_at: null,
        last_call_state: "reminder placed without a conversation id — app is the fallback",
      });
      return;
    }
    // Placed. How it ended arrives by message (_shared/reservation-call-outcome.ts).
    await record({
      reminder_state: "ringing",
      reminder_conversation_id: call.conversationId,
      last_call_state: "reminder — calling the guest",
    });
  } catch (e) {
    if (e instanceof OrphanedRunError) return;
    console.error(`[reservation-call] reminder crashed: ${e}`);
  }
}

// Legs 5/6 · the cancellation notice — tell the side that DIDN'T cancel.
// place_cancel → a1 rings the place to release the held table (paced by the
// place's own hours, cap 2); guest_cancel → a2 rings the guest (guest ladder,
// cap 3). Delivery: a place-side voicemail counts (it's the place's own line);
// a GUEST voicemail does NOT — one more ladder rung fires before we claim the
// guest was told (eng-review 2026-08-04). Platform failures park on the
// outage clock without consuming notice attempts. Exhausted → 'failed',
// visible in the admin needs-attention filter.
export async function runCancelNotice(input: {
  admin: SupabaseClient;
  reservationId: string;
  runId: string;
  key: string;
  kind: "place_cancel" | "guest_cancel";
  attemptsDone: number;
  outageRetries: number;
  toNumber: string;
  agentId: string;
  legVars: ReservationLegVars;
  placeHours: unknown;
  placeLng: number | null;
  reservedAtIso: string;
  projectId: string;
  placeCallCap: number;
  guestNotify: "call" | "app";
}): Promise<void> {
  const { admin, reservationId } = input;
  const record = (patch: Record<string, unknown>) =>
    guardedRecord(admin, reservationId, input.runId, patch);
  const isPlaceSide = input.kind === "place_cancel";
  const who = isPlaceSide ? "place" : "guest";
  // guest_cancel wire kind = tell the GUEST the place cancelled (leg 6).
  if (!isPlaceSide && input.guestNotify === "app") {
    await record({
      notice_state: "skipped",
      notice_next_at: null,
      last_call_state: "cancel notice (guest) — guest prefers app-only; no call",
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
        last_call_state: `cancel notice (${who}) — ${failNote} — ${next.reason}`.slice(0, 200),
      });
    } else {
      await record({
        notice_attempts: n,
        notice_state: "failed",
        notice_next_at: null,
        last_call_state:
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
        last_call_state: `cancel notice (${who}) — ${why} — ${next.reason}`.slice(0, 200),
      });
    } else {
      await record({
        notice_state: "failed",
        notice_next_at: null,
        last_call_state: `cancel notice (${who}) — ${why} — outage persisted; needs attention`
          .slice(0, 200),
      });
    }
  };
  try {
    if (isPlaceSide) {
      const calls = await bumpPlaceCalls(admin, input.projectId);
      if (calls !== null && calls > input.placeCallCap) {
        await record({
          notice_state: "scheduled",
          notice_next_at: new Date(Date.now() + 6 * 3600_000).toISOString(),
          last_call_state:
            `cancel notice (place) — daily place-call cap (${input.placeCallCap}) reached — deferred`
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
      // "cancelled_by_venue" is a wire key the a2 prompt reads
      // (_shared/reservationist/a2.ts); it changes only with a sync.
      dynamicVariables: legDynamicVariables(input.legVars, {
        callContext: isPlaceSide ? "cancellation" : "cancelled_by_venue",
      }),
    });
    if (!call.ok) {
      if (classifyPlacementFailure(call.httpStatus) === "platform") {
        await outagePark(`not placed (HTTP ${call.httpStatus ?? "network"})`);
      } else {
        await park(`call failed: ${call.error}`);
      }
      return;
    }
    if (!call.conversationId) {
      await park("call placed without a conversation id");
      return;
    }
    // Placed; notice_state stays 'running' until the outcome arrives by
    // message (_shared/reservation-call-outcome.ts).
    await record({
      notice_conversation_id: call.conversationId,
      last_call_state: `cancel notice (${who}) — ringing`,
    });
  } catch (e) {
    if (e instanceof OrphanedRunError) return; // ticket moved on — stop quietly
    await writeReservation(admin, {
      mode: "update",
      id: reservationId,
      patch: {
        notice_state: "failed",
        notice_next_at: null,
        last_call_state: `cancel notice (${who}) crashed: ${
          e instanceof Error ? e.message : "run crashed"
        }`.slice(0, 200),
      },
      match: { run_id: input.runId },
    });
  }
}

// Leg 1 — fires AFTER the HTTP response: places ONE booking call (the next
// intent) and returns once its conversation id is saved. A placement that
// fails parks the ticket for the cron; the call's outcome (and the guest call
// that follows a yes or a counter-offer) is applied by
// _shared/reservation-call-outcome.ts.
export async function runIntents(input: {
  admin: SupabaseClient;
  reservationId: string;
  attemptsPlanned: number;
  /** Attempts already burned by earlier runs — this run resumes after them. */
  attemptsDone: number;
  /** Log carried across runs so the ticket keeps its full history. */
  priorAttempts: ReservationAttempt[];
  /** The place's weekly hours + lng — when the next try is allowed to fire. */
  placeHours: unknown;
  placeLng: number | null;
  businessNumber: string;
  bookerAgentId: string; // eleven-a1 (fallback: the original agent)
  legVars: ReservationLegVars;
  runId: string;
  projectId: string;
  outageRetries: number;
  placeCallCap: number;
  /** Old reserved_at when this run MODIFIES a confirmed booking (T3/eng-review). */
  modificationOfIso: string | null;
  /** Writes the guest's Me › Notifications row; never throws. */
  notify: (outcome: ReservationOutcome) => Promise<void>;
}): Promise<void> {
  const { admin, reservationId, attemptsPlanned, legVars, notify } = input;
  // Prior runs' entries stay in the log; this run appends to them.
  const attempts: ReservationAttempt[] = [...input.priorAttempts];
  const record = (patch: Record<string, unknown>) =>
    guardedRecord(admin, reservationId, input.runId, patch);
  // Failed to book new terms while the place still HOLDS the old slot → the
  // old hold must be released (leg 5 through the reschedule door). The cron
  // sweeps the owed notice within a minute.
  const releaseOldHold = input.modificationOfIso
    ? { notice_kind: "place_cancel", notice_state: "pending", notice_attempts: 0, notice_next_at: null }
    : {};
  // Every dead end ends the ticket and tells the guest (MESITA-3619,
  // _shared/reservation-dead-end.ts) — never 'error' on a still-pending row.
  const deadEndIo: DeadEndIo = {
    write: async (patch) => {
      try {
        await record(patch);
        return true;
      } catch (e) {
        if (e instanceof OrphanedRunError) return false;
        throw e;
      }
    },
    notify,
  };
  const end = (d: DeadEnd, reason: string, extra: Record<string, unknown> = {}) =>
    endAtDeadEnd(deadEndIo, d, reason, { ...releaseOldHold, ...extra });
  try {
    const key = await resolveElevenLabsKey();
    if (!key?.startsWith("sk_")) {
      await end("no_key", "no ELEVENLABS_KEY");
      return;
    }
    const lines = await resolveLines(key);
    if (!lines.ok) {
      // Our calling line, not the place: ride the outage clock like any
      // platform failure, and end the ticket once it is spent.
      const next = outageRetryAt(input.outageRetries);
      if (next) {
        await record({
          outage_retries: input.outageRetries + 1,
          attempts_state: "scheduled",
          next_attempt_at: next.at.toISOString(),
          last_call_state: `line resolution failed: ${lines.error} — ${next.reason}`.slice(0, 200),
        });
      } else {
        await end("no_line", `line resolution failed: ${lines.error} — outage clock spent`);
      }
      return;
    }

    // Leg 1 · consumer → business — the booking intents.
    for (let n = input.attemptsDone + 1; n <= attemptsPlanned; n++) {
      const entry: ReservationAttempt = {
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
        last_call_state: `intent ${n}: dialing`,
      });

      // Per-place daily meter — booking calls and place notices share it.
      const meter = await bumpPlaceCalls(admin, input.projectId);
      if (meter !== null && meter > input.placeCallCap) {
        attempts.pop(); // never rang — the entry must not count
        await record({
          attempts,
          call_attempts: n - 1,
          attempts_state: "scheduled",
          next_attempt_at: new Date(Date.now() + 6 * 3600_000).toISOString(),
          last_call_state:
            `intent ${n}: daily place-call cap (${input.placeCallCap}) reached — deferred`
              .slice(0, 200),
        });
        return;
      }

      const call = await placeOutboundCall(key, {
        agentId: input.bookerAgentId,
        agentPhoneNumberId: lines.placeLineId,
        toNumber: input.businessNumber,
        dynamicVariables: legDynamicVariables(legVars, {
          callContext: input.modificationOfIso ? "modification" : "booking",
        }),
      });

      if (!call.ok) {
        // OUR outage (quota, 5xx, network) is not the place's silence: the
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
              last_call_state:
                `intent ${n}: not placed (HTTP ${call.httpStatus ?? "network"}) — ${next.reason}`
                  .slice(0, 200),
            });
          } else {
            await end("outage", `intent ${n}: platform outage persisted — ended`, {
              attempts,
              call_attempts: n - 1,
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
            last_call_state: `intent ${n} failed: ${call.error}`.slice(0, 200),
          });
          return;
        }
        await record({
          attempts,
          last_call_state: `intent ${n} failed: ${call.error}`.slice(0, 200),
        });
        continue;
      }

      if (!call.conversationId) {
        // No id = no way to learn how it ended — and no way to tell whether
        // the place picked up. Stop rather than risk ringing a live line.
        entry.result = "unknown";
        await record({
          attempts,
          attempts_state: "exhausted",
          next_attempt_at: null,
          state: "unresolved",
          callback_state: "skipped",
          ...releaseOldHold,
          last_call_state: `intent ${n}: placed without a conversation id — not retrying`,
        });
        await notify("unresolved");
        return;
      }

      // Placed. attempts_state stays 'running' and the conversation id is the
      // join key: the outcome arrives by message (eleven-webhook-post-call,
      // or the cron's one read after 10 min) and
      // _shared/reservation-call-outcome.ts applies it. Never redialed.
      entry.conversation_id = call.conversationId;
      entry.result = "ringing";
      await record({
        attempts,
        last_conversation_id: call.conversationId,
        last_call_state: `intent ${n}: ringing`,
      });
      return;
    }

    await end(
      "no_answer",
      `no answer after ${attemptsPlanned} intent${attemptsPlanned === 1 ? "" : "s"}`,
    );
  } catch (e) {
    if (e instanceof OrphanedRunError) return; // ticket moved on — stop quietly
    // Guarded by run_id directly: if the run was orphaned between the throw
    // and here, this write must not clobber the ticket's new life.
    await endAtDeadEnd(
      {
        write: async (patch) => {
          const res = await writeReservation(admin, {
            mode: "update",
            id: reservationId,
            patch: patch as ReservationPatch,
            match: { run_id: input.runId },
            select: "id",
          });
          return res.ok && !!res.row;
        },
        notify,
      },
      "crash",
      `failed: ${e instanceof Error ? e.message : "run crashed"}`,
      releaseOldHold,
    );
  }
}
