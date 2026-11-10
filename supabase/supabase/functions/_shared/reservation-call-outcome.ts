// How a placed reservation call ENDS (MESITA-3618). The engine
// (supabase-edgefunc-place-reservation-call) places a call, saves its
// conversation_id on the ticket and returns: it no longer watches the call.
// The outcome arrives by message, through one door with two callers:
//
//   eleven-webhook-post-call          ElevenLabs posts the finished
//                                     conversation (post_call_transcription)
//                                     or a call that never connected
//                                     (call_initiation_failure).
//   supabase-cron-retry-reservations  the fallback: a placed call with no
//                                     result 10 min after its claim is read
//                                     ONCE per sweep (GET the conversation)
//                                     and applied here. Works with no webhook
//                                     secret set.
//
// Both build a CallResult and call applyCallResult. The leg is found by the
// conversation id on the ticket — last_conversation_id (a1, the place call),
// callback_conversation_id (a2, the guest call), notice_conversation_id (the
// cancellation notice), reminder_conversation_id (the reminder) — and only
// while that leg is still AWAITING that very call (attempts_state running /
// callback_state ringing / notice_state running / reminder_state ringing).
// The write is compare-and-swap on run_id + leg state + conversation id, so a
// second delivery, or the webhook racing the cron, changes nothing.
//
// The outcome rules are the ones the poller applied (same codes, same
// patches): a1's reported_verdict (eleven-a1-report-outcome, mid-call)
// outranks the post-call analysis; a platform kill (error 1002) parks on the
// outage clock without charging the attempt; a guest-side voicemail on a
// cancel notice earns one more rung. What changed is only the guest call
// after a place confirms or counter-offers: it is parked due now and the
// engine is kicked with intent callback_retry (the cron wakes it within a
// minute if the kick is lost).

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { EFEnv } from "./auth.ts";
import { invokeInternalCaller } from "./internal.ts";
import { ATTEMPTS } from "./reservations-config.ts";
import { nextAttemptAt } from "./reservation-retry.ts";
import { PLACE_ZONE_COLUMNS, placeZone } from "./local-time.ts";
import { nextGuestCallAt, spentLadderPatch } from "./reservation-callback.ts";
import { REMINDER_MAX_ATTEMPTS, reminderParkPatch } from "./reservation-reminder.ts";
import { classifyFailedConversation, noticeNextAt, outageRetryAt } from "./reservation-run.ts";
import type { ReservationAttempt, ReservationPatch } from "./reservation-doc.ts";
import { writeReservation } from "./reservation-doc.ts";
import { notifyReservationOutcome, type ReservationOutcome } from "./reservation-notification.ts";
import { rowPlaceId } from "./place-id.ts";
import { timingSafeEqual } from "./timing-safe-equal.ts";

// ── The signature ──────────────────────────────────────────────────────────

/** ElevenLabs signs `${t}.${rawBody}` (HMAC-SHA256, hex) and sends
 *  `ElevenLabs-Signature: t=<unix secs>,v0=<hex>`. Their own examples reject
 *  a timestamp older than 30 minutes. */
export const SIGNATURE_TOLERANCE_SEC = 30 * 60;

export type SignatureVerdict = { ok: true } | { ok: false; code: "bad_signature" | "stale_event" };

export function parseElevenSignature(header: string | null): { t: number; v0: string[] } | null {
  if (!header) return null;
  let t: number | null = null;
  const v0: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.trim().split("=", 2);
    if (k === "t" && /^\d+$/.test(v ?? "")) t = Number(v);
    else if (k === "v0" && /^[0-9a-f]{64}$/i.test(v ?? "")) v0.push(v.toLowerCase());
  }
  return t === null || v0.length === 0 ? null : { t, v0 };
}

async function hmacHex(secret: string, text: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Signs a raw body the way ElevenLabs does; the tests build fixtures with it. */
export async function signElevenPayload(secret: string, raw: string, tSec: number): Promise<string> {
  return `t=${tSec},v0=${await hmacHex(secret, `${tSec}.${raw}`)}`;
}

/** A malformed header or no matching v0 is bad_signature; a good signature
 *  older than the tolerance is stale_event. */
export async function verifyElevenSignature(
  raw: string,
  header: string | null,
  secret: string,
  nowSec: number,
  toleranceSec: number = SIGNATURE_TOLERANCE_SEC,
): Promise<SignatureVerdict> {
  const parsed = parseElevenSignature(header);
  if (!parsed) return { ok: false, code: "bad_signature" };
  const want = await hmacHex(secret, `${parsed.t}.${raw}`);
  if (!parsed.v0.some((got) => timingSafeEqual(got, want))) return { ok: false, code: "bad_signature" };
  if (nowSec - parsed.t > toleranceSec) return { ok: false, code: "stale_event" };
  return { ok: true };
}

// ── The call result ────────────────────────────────────────────────────────

export type CallResult = {
  /** done or failed: the call is over. Anything else is still live. */
  final: boolean;
  status: string;
  /** Someone (or a machine) picked up: done, or failed after the callee spoke. */
  answered: boolean;
  /** analysis.call_successful ("success" | "failure" | "unknown"), done only. */
  callSuccessful: string | null;
  /** metadata.error.code when the platform killed the call (1002 = credits). */
  errorCode: number | null;
  voicemail: boolean;
};

/** The conversation object — the GET /v1/convai/conversations/{id} body and
 *  the post_call_transcription webhook's `data` share this shape. */
export function readConversation(conv: unknown): CallResult {
  const b = (conv ?? {}) as Record<string, unknown>;
  const status = typeof b.status === "string" ? b.status : "unknown";
  const meta = (b.metadata ?? null) as Record<string, unknown> | null;
  const analysis = (b.analysis ?? null) as Record<string, unknown> | null;
  const err = (meta?.error ?? null) as Record<string, unknown> | null;
  const transcript = Array.isArray(b.transcript) ? b.transcript as Array<Record<string, unknown>> : [];
  const calleeSpoke = transcript.some((t) =>
    t?.role === "user" && typeof t.message === "string" && t.message.trim() !== ""
  );
  // Voicemail: the platform's detection tool in the transcript, or the
  // termination reason saying so.
  const voicemail = JSON.stringify(b.transcript ?? "").includes("voicemail_detection") ||
    (typeof meta?.termination_reason === "string" &&
      meta.termination_reason.toLowerCase().includes("voicemail"));
  const final = status === "done" || status === "failed";
  return {
    final,
    status,
    answered: status === "done" || (status === "failed" && calleeSpoke),
    callSuccessful: analysis && typeof analysis.call_successful === "string"
      ? analysis.call_successful
      : null,
    errorCode: err && typeof err.code === "number" ? err.code : null,
    voicemail,
  };
}

/** call_initiation_failure: busy / no-answer / unknown — never connected. */
export const INITIATION_FAILURE: CallResult = {
  final: true,
  status: "failed",
  answered: false,
  callSuccessful: null,
  errorCode: null,
  voicemail: false,
};

/** The cron's give-up: still no final result 30 min after the claim. Never a
 *  redial — a1 falls back to its reported verdict, else unresolved. */
export const GIVE_UP: CallResult = {
  final: false,
  status: "unknown",
  answered: false,
  callSuccessful: null,
  errorCode: null,
  voicemail: false,
};

// ── The ticket and its legs ────────────────────────────────────────────────

export type Leg = "book" | "callback" | "notice" | "reminder";

/** Per leg: the column holding its conversation id, its state column, and
 *  the state that means "a call is placed and its result is owed". */
export const AWAITING: Record<Leg, { conv: string; field: string; state: string }> = {
  book: { conv: "last_conversation_id", field: "attempts_state", state: "running" },
  callback: { conv: "callback_conversation_id", field: "callback_state", state: "ringing" },
  notice: { conv: "notice_conversation_id", field: "notice_state", state: "running" },
  reminder: { conv: "reminder_conversation_id", field: "reminder_state", state: "ringing" },
};

export const OUTCOME_TICKET_COLUMNS =
  "id, consumer_id, reference_code, reserved_at, state, place_id, run_id, claimed_at, attempts, call_attempts, attempts_planned, attempts_state, last_conversation_id, callback_state, callback_conversation_id, callback_attempts, notice_kind, notice_state, notice_attempts, notice_conversation_id, reminder_state, reminder_conversation_id, outage_retries, modification_of, consumer_notify, reported_verdict, outcome_note";

export type OutcomeTicket = {
  id: string;
  consumer_id: string;
  reference_code: string | null;
  reserved_at: string;
  state: string;
  place_id?: string | null;
  run_id: string | null;
  claimed_at?: string | null;
  attempts: unknown;
  call_attempts: number | null;
  attempts_planned: number | null;
  attempts_state: string | null;
  last_conversation_id: string | null;
  callback_state: string | null;
  callback_conversation_id: string | null;
  callback_attempts: number | null;
  notice_kind: string | null;
  notice_state: string | null;
  notice_attempts: number | null;
  notice_conversation_id: string | null;
  reminder_state: string | null;
  reminder_conversation_id: string | null;
  outage_retries: number | null;
  modification_of: string | null;
  consumer_notify: string | null;
  reported_verdict: string | null;
  outcome_note: string | null;
};

export type OutcomePlace = {
  name?: string | null;
  photos?: unknown;
  hours?: unknown;
  lng?: number | null;
  /** The place's IANA zone (MESITA-3626) — see placeZone. */
  timezone?: string | null;
};

/** Which leg of this ticket is waiting on this very conversation, or null. */
export function awaitingLeg(t: OutcomeTicket, conversationId: string): Leg | null {
  const row = t as unknown as Record<string, unknown>;
  for (const leg of Object.keys(AWAITING) as Leg[]) {
    const a = AWAITING[leg];
    if (row[a.conv] === conversationId && row[a.field] === a.state) return leg;
  }
  return null;
}

// ── The decision (pure) ────────────────────────────────────────────────────

export type LegDecision = {
  patch: ReservationPatch;
  /** A Me › Notifications row the guest must get. */
  notify?: ReservationOutcome;
  /** The guest call is parked due now — kick the engine (callback_retry). */
  kickCallback?: boolean;
};

const REPORTABLE = ["confirmed", "declined", "counter_offer", "unreachable", "wrong_number"];
const num = (v: number | null | undefined) => (typeof v === "number" ? v : 0);
const cut = (s: string) => s.slice(0, 200);

/** The patch one finished call earns — the rules the poller applied. */
export function decideLegOutcome(
  leg: Leg,
  t: OutcomeTicket,
  r: CallResult,
  place: OutcomePlace | null,
  now: Date = new Date(),
): LegDecision {
  const zone = placeZone(place);
  const reservedAt = t.reserved_at ? new Date(t.reserved_at) : null;
  const platformKill = r.final && !r.answered && r.status === "failed" &&
    classifyFailedConversation(r.errorCode) === "platform";
  const outageRetries = num(t.outage_retries);

  if (leg === "book") return decideBooking(t, r, place, platformKill, now);

  if (leg === "callback") {
    const label = t.state === "confirmed" ? "confirmed" : "counter-offer";
    const n = num(t.callback_attempts) + 1;
    if (r.answered) {
      return {
        patch: {
          callback_attempts: n,
          callback_state: "answered",
          callback_next_attempt_at: null,
          outage_retries: 0,
          last_call_state: `${label} — guest notified`,
        },
      };
    }
    if (platformKill) {
      const next = outageRetryAt(outageRetries, now);
      return {
        patch: next
          ? {
            outage_retries: outageRetries + 1,
            callback_state: "scheduled",
            callback_next_attempt_at: next.at.toISOString(),
            last_call_state: cut(`${label} — platform killed the call (code ${r.errorCode}) — ${next.reason}`),
          }
          : {
            callback_state: "failed",
            callback_next_attempt_at: null,
            last_call_state: cut(`${label} — platform killed the call — platform outage persisted; needs attention`),
          },
      };
    }
    const failNote = r.final ? "guest didn't answer" : "guest call outcome unknown";
    const next = nextGuestCallAt(n, zone, reservedAt, now);
    return {
      patch: next
        ? {
          callback_attempts: n,
          callback_state: "scheduled",
          callback_next_attempt_at: next.at.toISOString(),
          last_call_state: cut(`${label} — ${failNote} — ${next.reason}`),
        }
        : spentLadderPatch(n, label, failNote),
    };
  }

  if (leg === "reminder") {
    if (r.answered) {
      return {
        patch: {
          reminder_attempts: REMINDER_MAX_ATTEMPTS,
          reminder_state: "answered",
          reminder_at: null,
          outage_retries: 0,
          last_call_state: "reminder — guest reached",
        },
      };
    }
    if (platformKill) {
      const next = outageRetryAt(outageRetries, now);
      return {
        patch: next
          ? {
            outage_retries: outageRetries + 1,
            reminder_state: "scheduled",
            reminder_at: next.at.toISOString(),
            last_call_state: cut(`reminder — platform killed the call (code ${r.errorCode}) — ${next.reason}`),
          }
          : {
            reminder_state: "failed",
            reminder_at: null,
            last_call_state: "reminder — platform outage persisted; needs attention",
          },
      };
    }
    // Cap 1: voicemail / no-answer is NOT retried. The app is the fallback.
    return {
      patch: {
        reminder_attempts: REMINDER_MAX_ATTEMPTS,
        reminder_state: "skipped",
        reminder_at: null,
        last_call_state: "reminder — guest didn't answer; app is the fallback",
      },
    };
  }

  // leg === "notice"
  const kind = t.notice_kind === "guest_cancel" ? "guest_cancel" : "place_cancel";
  const isPlaceSide = kind === "place_cancel";
  const who = isPlaceSide ? "place" : "guest";
  const n = num(t.notice_attempts) + 1;
  const park = (failNote: string): LegDecision => {
    const next = noticeNextAt(kind, n, place?.hours ?? null, zone, reservedAt, now);
    return {
      patch: next
        ? {
          notice_attempts: n,
          notice_state: "scheduled",
          notice_next_at: next.at.toISOString(),
          last_call_state: cut(`cancel notice (${who}) — ${failNote} — ${next.reason}`),
        }
        : {
          notice_attempts: n,
          notice_state: "failed",
          notice_next_at: null,
          last_call_state: cut(
            `cancel notice (${who}) NOT delivered after ${n} call${n === 1 ? "" : "s"} — needs attention`,
          ),
        },
    };
  };
  if (r.answered) {
    // A message on a guest's machine is not a told guest: one more rung.
    if (!isPlaceSide && r.voicemail) {
      const next = noticeNextAt(kind, n, place?.hours ?? null, zone, reservedAt, now);
      return {
        patch: next
          ? {
            notice_attempts: n,
            notice_state: "scheduled",
            notice_next_at: next.at.toISOString(),
            outage_retries: 0,
            last_call_state: cut(
              `cancel notice (guest) — voicemail answered; message left, retrying live — ${next.reason}`,
            ),
          }
          : {
            notice_attempts: n,
            notice_state: "done",
            notice_next_at: null,
            outage_retries: 0,
            last_call_state: "cancel notice (guest) delivered — voicemail only",
          },
      };
    }
    return {
      patch: {
        notice_attempts: n,
        notice_state: "done",
        notice_next_at: null,
        outage_retries: 0,
        last_call_state: `cancel notice (${who}) delivered`,
      },
    };
  }
  if (platformKill) {
    const next = outageRetryAt(outageRetries, now);
    return {
      patch: next
        ? {
          outage_retries: outageRetries + 1,
          notice_state: "scheduled",
          notice_next_at: next.at.toISOString(),
          last_call_state: cut(`cancel notice (${who}) — platform killed the call (code ${r.errorCode}) — ${next.reason}`),
        }
        : {
          notice_state: "failed",
          notice_next_at: null,
          last_call_state: cut(`cancel notice (${who}) — platform killed the call — outage persisted; needs attention`),
        },
    };
  }
  return park(r.final ? "no answer" : "outcome unknown");
}

function decideBooking(
  t: OutcomeTicket,
  r: CallResult,
  place: OutcomePlace | null,
  platformKill: boolean,
  now: Date,
): LegDecision {
  const zone = placeZone(place);
  const n = num(t.call_attempts);
  const planned = num(t.attempts_planned) || ATTEMPTS;
  const attempts: ReservationAttempt[] = Array.isArray(t.attempts)
    ? (t.attempts as ReservationAttempt[]).map((a) => ({ ...a }))
    : [];
  const entry = [...attempts].reverse().find((a) => a.conversation_id === t.last_conversation_id) ??
    null;
  const setResult = (result: string) => {
    if (entry) entry.result = result;
  };
  // Failed to book new terms while the place still HOLDS the old slot → the
  // old hold must be released (leg 5); the cron sweeps the owed notice.
  const releaseOldHold: ReservationPatch = t.modification_of
    ? { notice_kind: "place_cancel", notice_state: "pending", notice_attempts: 0, notice_next_at: null }
    : {};
  const reported = t.reported_verdict && REPORTABLE.includes(t.reported_verdict) ? t.reported_verdict : null;

  if (!reported && platformKill) {
    // The platform killed a placed call: park on the outage clock, attempt
    // NOT charged.
    const kept = attempts.filter((a) => a !== entry);
    const next = outageRetryAt(num(t.outage_retries), now);
    return {
      patch: next
        ? {
          attempts: kept,
          call_attempts: n - 1,
          outage_retries: num(t.outage_retries) + 1,
          attempts_state: "scheduled",
          next_attempt_at: next.at.toISOString(),
          last_call_state: cut(`intent ${n}: platform killed the call (code ${r.errorCode}) — ${next.reason}`),
        }
        : {
          attempts: kept,
          call_attempts: n - 1,
          attempts_state: "error",
          next_attempt_at: null,
          last_call_state: cut(`intent ${n}: platform outage persisted — needs attention`),
        },
    };
  }

  if (!reported && r.final && !r.answered) {
    setResult("no_answer");
    if (n < planned) {
      // The place's own hours decide when we try again; the cron wakes it.
      const next = nextAttemptAt(place?.hours ?? null, zone, now);
      return {
        patch: {
          attempts,
          attempts_state: "scheduled",
          next_attempt_at: next.at.toISOString(),
          last_call_state: cut(`intent ${n}: no answer — ${next.reason}`),
        },
      };
    }
    return {
      patch: {
        attempts,
        attempts_state: "exhausted",
        next_attempt_at: null,
        state: "unreachable",
        callback_state: "skipped",
        ...releaseOldHold,
        last_call_state: `no answer after ${planned} intent${planned === 1 ? "" : "s"}`,
      },
      notify: "unreachable",
    };
  }

  if (!reported && !r.final) {
    // Never learned the end of the call. Stop rather than risk ringing a
    // line that may have said yes.
    setResult("unknown");
    return {
      patch: {
        attempts,
        attempts_state: "exhausted",
        next_attempt_at: null,
        state: "unresolved",
        callback_state: "skipped",
        ...releaseOldHold,
        last_call_state: `intent ${n}: outcome unknown — not retrying`,
      },
      notify: "unresolved",
    };
  }

  // Answered. a1's explicit report outranks the analysis.
  const analyzed = r.status === "done"
    ? (r.callSuccessful === "success" ? "confirmed" : r.callSuccessful === "failure" ? "declined" : "unknown")
    : "unknown";
  const verdict = reported ?? analyzed;

  if (verdict === "wrong_number") {
    setResult("wrong_number");
    return {
      patch: {
        attempts,
        attempts_state: "exhausted",
        next_attempt_at: null,
        state: "unresolved",
        callback_state: "skipped",
        last_call_state: cut(
          `intent ${n}: wrong number — the line isn't the place${t.outcome_note ? ` (${t.outcome_note})` : ""}`,
        ),
      },
      notify: "unresolved",
    };
  }
  if (verdict === "unreachable") {
    setResult("unreachable");
    if (n < planned) {
      const next = nextAttemptAt(place?.hours ?? null, zone, now);
      return {
        patch: {
          attempts,
          attempts_state: "scheduled",
          next_attempt_at: next.at.toISOString(),
          // The call is over: the next attempt starts from a blank verdict.
          reported_verdict: null,
          last_call_state: cut(`intent ${n}: no one who books was reached — ${next.reason}`),
        },
      };
    }
    return {
      patch: {
        attempts,
        attempts_state: "exhausted",
        next_attempt_at: null,
        state: "unreachable",
        callback_state: "skipped",
        ...releaseOldHold,
        last_call_state: `intent ${n}: no one who books was reached — giving up`,
      },
      notify: "unreachable",
    };
  }

  const appOnly = t.consumer_notify === "app";
  const nowIso = now.toISOString();
  if (verdict === "confirmed") {
    setResult("confirmed");
    return {
      patch: {
        attempts,
        attempts_state: "answered",
        next_attempt_at: null,
        state: "confirmed",
        confirmed_at: nowIso,
        callback_at: nowIso,
        callback_next_attempt_at: appOnly ? null : nowIso,
        callback_state: appOnly ? "skipped" : "scheduled",
        // App-only: the in-app state IS the guest's acknowledgement.
        ...(appOnly ? { consumer_confirmed_at: nowIso } : {}),
        outage_retries: 0,
        // A confirmed MODIFICATION moved the booking on this very call.
        modification_of: null,
        ...reminderParkPatch(zone, t.reserved_at ? new Date(t.reserved_at) : null, appOnly ? "app" : "call", now),
        last_call_state: appOnly
          ? `intent ${n}: place confirmed — guest prefers app-only; no call`
          : `intent ${n}: place confirmed — calling the guest`,
      },
      notify: "confirmed",
      kickCallback: !appOnly,
    };
  }
  if (verdict === "counter_offer") {
    // The ticket STAYS pending; the guest hears the options and their pick
    // (eleven-a2-confirm-reservation) re-fires the engine.
    setResult("counter_offer");
    return {
      patch: {
        attempts,
        attempts_state: "answered",
        next_attempt_at: null,
        callback_at: nowIso,
        callback_next_attempt_at: appOnly ? null : nowIso,
        callback_state: appOnly ? "skipped" : "scheduled",
        last_call_state: appOnly
          ? `intent ${n}: place counter-offer — guest prefers app-only; no call`
          : `intent ${n}: place counter-offer — calling the guest`,
      },
      notify: "counter_offer",
      kickCallback: !appOnly,
    };
  }
  if (verdict === "declined") {
    setResult("declined");
    return {
      patch: {
        attempts,
        attempts_state: "answered",
        next_attempt_at: null,
        state: "declined",
        callback_state: "skipped",
        // A1's brief asks the place to drop the old booking too: no notice.
        modification_of: null,
        last_call_state: `intent ${n}: place declined — no guest call`,
      },
      notify: "declined",
    };
  }
  setResult("unresolved");
  return {
    patch: {
      attempts,
      attempts_state: "answered",
      state: "unresolved",
      callback_state: "skipped",
      last_call_state: `intent ${n}: answered, verdict unknown — no guest call`,
    },
    notify: "unresolved",
  };
}

// ── The door ───────────────────────────────────────────────────────────────

/** What applyCallResult needs from the world — Supabase in production
 *  (supabaseOutcomeStore), an in-memory table in the tests. */
export type OutcomeStore = {
  findByConversation(conversationId: string): Promise<OutcomeTicket | null>;
  place(placeId: string): Promise<OutcomePlace | null>;
  /** Compare-and-swap update; true when the row matched. */
  write(id: string, patch: ReservationPatch, match: Record<string, string>): Promise<boolean>;
  notify(t: OutcomeTicket, place: OutcomePlace | null, outcome: ReservationOutcome): Promise<void>;
  kickCallback(reservationId: string): Promise<void>;
};

export type ApplyResult =
  | { applied: true; reservationId: string; leg: Leg; state: string }
  | { applied: false; reason: "unknown_conversation" | "not_awaiting" | "lost_race" };

/** Ids ElevenLabs issues are `conv_…`; anything else never reaches a filter. */
export function cleanConversationId(raw: unknown): string | null {
  return typeof raw === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(raw) ? raw : null;
}

export async function applyCallResult(
  store: OutcomeStore,
  conversationId: string,
  result: CallResult,
  now: Date = new Date(),
): Promise<ApplyResult> {
  const t = await store.findByConversation(conversationId);
  if (!t) return { applied: false, reason: "unknown_conversation" };
  const leg = awaitingLeg(t, conversationId);
  if (!leg) return { applied: false, reason: "not_awaiting" };
  const placeId = rowPlaceId(t as unknown as Record<string, unknown>);
  const place = placeId ? await store.place(placeId) : null;
  const decision = decideLegOutcome(leg, t, result, place, now);
  const a = AWAITING[leg];
  const match: Record<string, string> = { [a.field]: a.state, [a.conv]: conversationId };
  if (t.run_id) match.run_id = t.run_id;
  const ok = await store.write(t.id, decision.patch, match);
  if (!ok) return { applied: false, reason: "lost_race" };
  if (decision.notify) await store.notify(t, place, decision.notify);
  if (decision.kickCallback) await store.kickCallback(t.id);
  const st = (decision.patch as Record<string, unknown>)[a.field];
  return { applied: true, reservationId: t.id, leg, state: typeof st === "string" ? st : "" };
}

/** The production store. `caller` names the EF for the engine kick. */
export function supabaseOutcomeStore(admin: SupabaseClient, env: EFEnv, caller: string): OutcomeStore {
  return {
    async findByConversation(id) {
      const { data, error } = await admin
        .from("reservation_tickets")
        .select(OUTCOME_TICKET_COLUMNS)
        .or(
          `last_conversation_id.eq.${id},callback_conversation_id.eq.${id},notice_conversation_id.eq.${id},reminder_conversation_id.eq.${id}`,
        )
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`ticket lookup failed: ${error.message}`);
      return (data ?? null) as OutcomeTicket | null;
    },
    async place(placeId) {
      const { data, error } = await admin
        .from("place_profiles")
        .select(`name, photos, hours, ${PLACE_ZONE_COLUMNS}`)
        .eq("id", placeId)
        .maybeSingle();
      // A failed read must not decide the outcome on default hours.
      if (error) throw new Error(`place lookup failed: ${error.message}`);
      return (data ?? null) as OutcomePlace | null;
    },
    async write(id, patch, match) {
      const res = await writeReservation(admin, { mode: "update", id, patch, match, select: "id" });
      return res.ok && !!res.row;
    },
    async notify(t, place, outcome) {
      await notifyReservationOutcome(admin, {
        consumerId: t.consumer_id,
        reservationId: t.id,
        referenceCode: t.reference_code ?? null,
        outcome,
        placeName: place?.name ?? null,
        placePhotos: place?.photos ?? null,
      });
    },
    async kickCallback(reservationId) {
      // Best-effort: the cron wakes a due callback within a minute anyway.
      const res = await invokeInternalCaller(env, caller, "supabase-edgefunc-place-reservation-call", {
        reservation_id: reservationId,
        intent: "callback_retry",
      });
      if (!res.ok) console.error(`[call-outcome] callback kick for ${reservationId} failed: ${res.error}`);
    },
  };
}

// ── The cron's two nets (supabase-cron-retry-reservations) ─────────────────

/** A claim older than this with no result: the cron steps in. */
export const STALE_CLAIM_MS = 10 * 60_000;
/** A placed call still without a final result this long after its claim is
 *  given up (GIVE_UP) — never redialed. */
export const GIVE_UP_AFTER_MS = 30 * 60_000;

/**
 * The reaper: a stale claim whose call was NEVER PLACED (the worker died
 * while dialing) goes back to 'scheduled', due now, attempts and
 * reported_verdict intact. A placed call is never on this list — its state
 * plus a conversation id is AWAITING above, and the cron reads it instead.
 */
export const REAP_UNPLACED: ReadonlyArray<{
  leg: Leg;
  field: string;
  states: string[];
  /** Only rows where this conversation column is still null. */
  convNull: string | null;
  patch: ReservationPatch;
}> = [
  {
    leg: "book",
    field: "attempts_state",
    states: ["running"],
    convNull: "last_conversation_id",
    patch: { attempts_state: "scheduled" },
  },
  // 'ringing' means placed; only a claim that never got past 'calling' reaps.
  { leg: "callback", field: "callback_state", states: ["calling"], convNull: null, patch: { callback_state: "scheduled" } },
  {
    leg: "notice",
    field: "notice_state",
    states: ["running"],
    convNull: "notice_conversation_id",
    patch: { notice_state: "scheduled" },
  },
  { leg: "reminder", field: "reminder_state", states: ["calling"], convNull: null, patch: { reminder_state: "scheduled" } },
];

/** Whether a reaper rule would take this row (the query's own semantics). */
export function reaperTakes(row: Record<string, unknown>): boolean {
  return REAP_UNPLACED.some((r) =>
    r.states.includes(String(row[r.field])) && (r.convNull === null || row[r.convNull] == null)
  );
}

/** What the cron does with a placed call still owed: read the conversation
 *  once (this sweep), or give up when it is past GIVE_UP_AFTER_MS. */
export function owedCallStep(claimedAtIso: string | null | undefined, nowMs: number): "read" | "read_or_give_up" {
  const claimed = claimedAtIso ? Date.parse(claimedAtIso) : NaN;
  return Number.isFinite(claimed) && nowMs - claimed >= GIVE_UP_AFTER_MS ? "read_or_give_up" : "read";
}
