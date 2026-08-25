// The reservation aggregate — validator + THE write door (MESITA-1280, child
// of MESITA-1247 "Mesita as documents" §C, aggregate 2 of 6 to route). Table:
// public.reservation_tickets — read/written by the LIVE Reservationist agent
// fleet (a1-a4, ElevenLabs-backed) mid-call, not just by form submits.
//
// WRITE-SURFACE RESEARCH (grep `.from("reservation_tickets")` for
// insert/update/upsert/delete across supabase/supabase/functions/, 2026-08-23):
// no `.delete(`/`.upsert(` anywhere — every write is insert or update. 28
// write call sites across 10 files:
//   _shared/agent-tools.ts (cancelTicket, 1 site — 4 callers share it),
//   eleven-a1-report-outcome (1), eleven-a2-confirm-reservation (4),
//   consumer-web-create-reservation (1 insert), consumer-mcp/index.ts
//   (1 insert), consumer-web-update-reservation (1), consumer-web-confirm-
//   reservation (2) — 11 sites routed through writeReservation below;
//   business-web-confirm-reservation (1), supabase-cron-reservation-retries
//   (3, all bulk/filtered `.in()`/`.lt()` sweeps) — 4 more sites gated
//   through validateReservationPatch directly (see below for why they don't
//   use writeReservation); and supabase-edgefunc-reservation-call (13 — the
//   live call engine: guardedRecord plus 12 direct writes, routed in a
//   follow-up PR, MESITA-1280, once this file's write-surface research
//   confirmed every literal value it writes was already covered by the
//   closed sets below). All 28 of 28 routed.
//
// THE TWO-BELT PATTERN (StampablePulseStep, pulse-report.ts; consumer-doc.ts
// is the first aggregate to apply it — same shape here):
//   Belt 1 — TypeScript. ReservationWriteArgs.patch IS ReservationPatch (a
//     closed key set), not Record<string, unknown> — a misspelled or retired
//     field name fails to compile at every call site that builds the patch as
//     a typed literal or variable.
//   Belt 2 — runtime. validateReservationPatch re-checks the same closed key
//     set (HTTP JSON and agent-tool JSON both arrive with no compiler) plus
//     the shape and cross-field invariants below. A malformed patch never
//     reaches Postgres.
//
// THE INVARIANTS, and why each is real (not invented):
//   - status, if set, is one of the reservation_status enum's 7 values
//     (pending/confirmed/declined/no_show/cancelled/unreachable/unresolved)
//     — the exact Postgres enum type, read live via pg_enum.
//   - party_size, if set, is a positive integer — the exact DB CHECK
//     (reservation_tickets_party_size_check: party_size > 0).
//   - consumer_notify, if set, is 'call' | 'app' — the exact DB CHECK
//     (reservation_tickets_consumer_notify_check).
//   - reference_code, if set, matches ^\d{8}$ — not a DB CHECK (the column is
//     plain text; a unique index is what turns a collision into 23505), but
//     the ONLY generator (_shared/reservation-code.ts's generateReservationCode)
//     produces exactly this shape and the ONE lookup (agent-tools.ts's
//     ticketByCode) requires it — enforcing today's sole producer/consumer
//     contract, the same move consumer-doc.ts made for `code`.
//   - reported_verdict, if set, is one of the 5 values eleven-a1-report-
//     outcome's own VERDICTS list accepts (confirmed/counter_offer/declined/
//     unreachable/wrong_number) — not a DB CHECK (plain text column), but the
//     one EF that ever writes it already enforces exactly this set; the
//     validator mirrors that EF's law rather than leaving the column wide
//     open to every other writer.
//   - attempts_state / callback_state / notice_state / notice_kind /
//     cancelled_by, if set, are each one of the values actually assigned
//     anywhere in the codebase today (grepped literal-by-literal across every
//     write call site) — again code law, not a DB CHECK, on plain text
//     columns with NOT NULL defaults ('idle'/'none'/'none' respectively).
//   - alternatives, if set, is an array of the structured
//     {time, date?, note?} shape _shared/reservation-alternatives.ts already
//     normalizes every write into (see its header: prose-string entries were
//     retired because nothing could tell a place's own offer from a new
//     guest idea).
//   - attempts, if set, is an array of the {n, started_at, conversation_id,
//     result} shape supabase-edgefunc-reservation-call's own AttemptEntry
//     type already defines and is the only writer of.
//
// WHAT THIS VALIDATOR DELIBERATELY DOES NOT DO: couple `status` to
// `reported_verdict`/`alternatives`/`outcome_note` in one invariant. Per this
// issue's own landmine note, those three are written mid-call by
// eleven-a1-report-outcome WITHOUT flipping status (status transitions are
// owned by supabase-edgefunc-reservation-call) — but OTHER legitimate patches
// (business-web-confirm-reservation, eleven-a2-confirm-reservation,
// consumer-web-update-reservation's reschedule reset) DO set status and
// reported_verdict together in the same write. There is no single rule that
// covers both truths, so this validator type-checks each field independently
// and leaves the "which fields travel together" decision where it already
// correctly lives: in each EF's own business logic, not in the shape guard.
//
// CHANNEL SHAPE: place_phone/consumer_phone are validated as flat nullable
// strings, on purpose — reservation_tickets stores PRE-RESOLVED phone numbers
// for this one ticket's calls, not the venue's own {channel,value}+fallbacks[]
// contact configuration (that shape lives on places.reservation_channel /
// reservation_target, the place aggregate's concern, not this one's).
//
// supabase-edgefunc-reservation-call/index.ts (the live Reservationist call
// engine, 12+ raw/guarded update sites) is NOT routed through this door by
// this PR. Its writes run through `guardedRecord`, a run_id compare-and-swap
// guard that stops an orphaned background run from racing a newer one — a
// concurrency contract this door does not (yet) model, plus a handful of
// catch-block fallback writes with their own semantics. Rerouting it needs
// its own dedicated, carefully-verified pass, not a blind sweep appended
// here; see the MESITA-1280 Linear comment for the explicit list of what
// remains.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  fromPlaceIdRow,
  remapPlaceIdIdent,
  remapPlaceIdSelect,
  toPlaceIdPatch,
} from "./place-id.ts";

// ── ReservationDoc — the full row shape ─────────────────────────────────────

export type ReservationStatus =
  | "pending"
  | "confirmed"
  | "declined"
  | "no_show"
  | "cancelled"
  | "unreachable"
  | "unresolved";

export type ReportedVerdict =
  | "confirmed"
  | "counter_offer"
  | "declined"
  | "unreachable"
  | "wrong_number";

export type AttemptsState =
  | "idle"
  | "running"
  | "scheduled"
  | "answered"
  | "error"
  | "exhausted"
  | "cancelled";

export type CallbackState =
  | "none"
  | "scheduled"
  | "ringing"
  | "calling"
  | "answered"
  | "failed"
  | "skipped";

export type NoticeState =
  | "none"
  | "pending"
  | "scheduled"
  | "running"
  | "done"
  | "failed"
  | "skipped";

export type NoticeKind = "venue_cancel" | "guest_cancel";

export type ReminderState =
  | "idle"
  | "scheduled"
  | "ringing"
  | "calling"
  | "answered"
  | "failed"
  | "skipped";

export type CancelledBy = "consumer" | "business" | "agent";

export type ConsumerNotify = "call" | "app";

/** One option the place volunteered — mirrors reservation-alternatives.ts's PlaceAlternative. */
export type ReservationAlternative = {
  time: string;
  date?: string;
  note?: string;
};

/** One placement attempt — mirrors supabase-edgefunc-reservation-call's AttemptEntry. */
export type ReservationAttempt = {
  n: number;
  started_at: string;
  conversation_id: string | null;
  result: string;
};

export type ReservationDoc = {
  id: string;
  created_at: string;
  updated_at: string;
  consumer_id: string;
  project_id: string;
  reserved_at: string;
  party_size: number;
  status: ReservationStatus;
  notes: string | null;
  confirmed_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  call_attempts: number;
  last_conversation_id: string | null;
  last_called_at: string | null;
  last_call_status: string | null;
  reference_code: string | null;
  is_test: boolean;
  place_phone: string | null;
  consumer_phone: string | null;
  attempts: ReservationAttempt[];
  attempts_planned: number;
  attempts_state: AttemptsState;
  callback_state: CallbackState;
  callback_conversation_id: string | null;
  callback_at: string | null;
  reported_verdict: ReportedVerdict | null;
  alternatives: ReservationAlternative[];
  outcome_note: string | null;
  consumer_confirmed_at: string | null;
  cancelled_by: CancelledBy | null;
  negotiation_rounds: number;
  next_attempt_at: string | null;
  callback_attempts: number;
  callback_next_attempt_at: string | null;
  notice_kind: NoticeKind | null;
  notice_state: NoticeState;
  notice_attempts: number;
  notice_next_at: string | null;
  notice_conversation_id: string | null;
  run_id: string | null;
  claimed_at: string | null;
  outage_retries: number;
  reschedules_today: number;
  reschedules_day: string | null;
  modification_of: string | null;
  consumer_notify: ConsumerNotify;
  reminder_state: ReminderState;
  reminder_at: string | null;
  reminder_attempts: number;
  reminder_conversation_id: string | null;
};

// Every field a patch may touch — everything except `id` (server-generated,
// gen_random_uuid() default) and `created_at` (server-stamped, never
// patched). `updated_at` stays IN the set: a `reservations_set_updated_at`
// trigger owns it on every UPDATE regardless, but business-web-confirm-
// reservation already sets it explicitly in its patch today — excluding it
// would be a behavior change this refactor isn't here to make.
export const RESERVATION_PATCH_KEYS = [
  "updated_at",
  "consumer_id",
  "project_id",
  "reserved_at",
  "party_size",
  "status",
  "notes",
  "confirmed_at",
  "completed_at",
  "cancelled_at",
  "call_attempts",
  "last_conversation_id",
  "last_called_at",
  "last_call_status",
  "reference_code",
  "is_test",
  "place_phone",
  "consumer_phone",
  "attempts",
  "attempts_planned",
  "attempts_state",
  "callback_state",
  "callback_conversation_id",
  "callback_at",
  "reported_verdict",
  "alternatives",
  "outcome_note",
  "consumer_confirmed_at",
  "cancelled_by",
  "negotiation_rounds",
  "next_attempt_at",
  "callback_attempts",
  "callback_next_attempt_at",
  "notice_kind",
  "notice_state",
  "notice_attempts",
  "notice_next_at",
  "notice_conversation_id",
  "run_id",
  "claimed_at",
  "outage_retries",
  "reschedules_today",
  "reschedules_day",
  "modification_of",
  "consumer_notify",
  "reminder_state",
  "reminder_at",
  "reminder_attempts",
  "reminder_conversation_id",
] as const satisfies readonly (keyof Omit<ReservationDoc, "id" | "created_at">)[];

// Compile-time exhaustiveness check the other direction — same discipline
// consumer-doc.ts borrows from FUNCTION_STATE_KEYS/PULSE_PIECE_META
// (MESITA-1222): a field added to ReservationDoc and forgotten here fails
// the build instead of silently becoming unwritable.
type _MissingFromPatchKeys = Exclude<
  keyof Omit<ReservationDoc, "id" | "created_at">,
  typeof RESERVATION_PATCH_KEYS[number]
>;
const _assertNoMissingPatchKeys: _MissingFromPatchKeys extends never ? true
  : ["RESERVATION_PATCH_KEYS is missing a field from ReservationDoc", _MissingFromPatchKeys] = true;
void _assertNoMissingPatchKeys;

export type ReservationPatch = Partial<
  Pick<ReservationDoc, typeof RESERVATION_PATCH_KEYS[number]>
>;

// ── validateReservationPatch — belt 2 ──────────────────────────────────────

export type ReservationValidationResult =
  | { ok: true; patch: ReservationPatch }
  | { ok: false; error: string };

const STATUS_VALUES = new Set<string>([
  "pending",
  "confirmed",
  "declined",
  "no_show",
  "cancelled",
  "unreachable",
  "unresolved",
]);
const REPORTED_VERDICT_VALUES = new Set<string>([
  "confirmed",
  "counter_offer",
  "declined",
  "unreachable",
  "wrong_number",
]);
const ATTEMPTS_STATE_VALUES = new Set<string>([
  "idle",
  "running",
  "scheduled",
  "answered",
  "error",
  "exhausted",
  "cancelled",
]);
const CALLBACK_STATE_VALUES = new Set<string>([
  "none",
  "scheduled",
  "ringing",
  "calling",
  "answered",
  "failed",
  "skipped",
]);
const NOTICE_STATE_VALUES = new Set<string>([
  "none",
  "pending",
  "scheduled",
  "running",
  "done",
  "failed",
  "skipped",
]);
const NOTICE_KIND_VALUES = new Set<string>(["venue_cancel", "guest_cancel"]);
const REMINDER_STATE_VALUES = new Set<string>([
  "idle",
  "scheduled",
  "ringing",
  "calling",
  "answered",
  "failed",
  "skipped",
]);
const CANCELLED_BY_VALUES = new Set<string>(["consumer", "business", "agent"]);
const CONSUMER_NOTIFY_VALUES = new Set<string>(["call", "app"]);
const REFERENCE_CODE_RE = /^\d{8}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function isNullableString(v: unknown): v is string | null {
  return v === null || typeof v === "string";
}

function isNonNegativeInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

function isReservationAlternative(v: unknown): v is ReservationAlternative {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  // "" is the legacy prose-only entry (reservation-alternatives.ts); any
  // other value must be a real place-local HH:mm — the exact shape
  // normalizeAlternatives ever writes.
  if (typeof o.time !== "string" || (o.time !== "" && !HHMM_RE.test(o.time))) return false;
  if ("date" in o && o.date !== undefined && (typeof o.date !== "string" || !ISO_DATE_RE.test(o.date))) {
    return false;
  }
  if ("note" in o && o.note !== undefined && typeof o.note !== "string") return false;
  // An entry always carries a real time or a note — normalizeAlternatives
  // never emits one with neither.
  return o.time !== "" || typeof o.note === "string";
}

function isReservationAttempt(v: unknown): v is ReservationAttempt {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.n === "number" &&
    typeof o.started_at === "string" &&
    (o.conversation_id === null || typeof o.conversation_id === "string") &&
    typeof o.result === "string"
  );
}

/**
 * The reservation aggregate's runtime shape guard. Rejects an unknown key
 * (closed key set), a wrong-typed value, or a value outside a documented
 * closed set. Returns the same patch back, narrowed to ReservationPatch, so
 * a caller that passed validation never re-checks what this function already
 * confirmed.
 */
export function validateReservationPatch(input: unknown): ReservationValidationResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "reservation patch must be an object" };
  }
  const raw = input as Record<string, unknown>;

  for (const key of Object.keys(raw)) {
    if (!(RESERVATION_PATCH_KEYS as readonly string[]).includes(key)) {
      return { ok: false, error: `unknown reservation field: ${key}` };
    }
  }

  const patch: ReservationPatch = {};

  for (const key of ["consumer_id", "project_id"] as const) {
    if (!(key in raw)) continue;
    const v = raw[key];
    if (typeof v !== "string" || v.length === 0) {
      return { ok: false, error: `${key} must be a non-empty string` };
    }
    patch[key] = v;
  }
  for (const key of ["reserved_at", "updated_at"] as const) {
    if (!(key in raw)) continue;
    const v = raw[key];
    if (typeof v !== "string") {
      return { ok: false, error: `${key} must be an ISO timestamp string` };
    }
    patch[key] = v;
  }
  for (
    const key of [
      "confirmed_at",
      "completed_at",
      "cancelled_at",
      "last_called_at",
      "callback_at",
      "consumer_confirmed_at",
      "next_attempt_at",
      "callback_next_attempt_at",
      "notice_next_at",
      "claimed_at",
      "modification_of",
      "reminder_at",
    ] as const
  ) {
    if (!(key in raw)) continue;
    const v = raw[key];
    if (!isNullableString(v)) {
      return { ok: false, error: `${key} must be an ISO timestamp string or null` };
    }
    patch[key] = v;
  }
  if ("party_size" in raw) {
    const v = raw.party_size;
    if (typeof v !== "number" || !Number.isInteger(v) || v <= 0) {
      return { ok: false, error: "party_size must be a positive integer" };
    }
    patch.party_size = v;
  }
  if ("status" in raw) {
    const v = raw.status;
    if (typeof v !== "string" || !STATUS_VALUES.has(v)) {
      return { ok: false, error: `status must be one of ${[...STATUS_VALUES].join(", ")}` };
    }
    patch.status = v as ReservationStatus;
  }
  for (
    const key of [
      "notes",
      "last_conversation_id",
      "last_call_status",
      "place_phone",
      "consumer_phone",
      "callback_conversation_id",
      "outcome_note",
      "notice_conversation_id",
      "reminder_conversation_id",
      "run_id",
    ] as const
  ) {
    if (!(key in raw)) continue;
    const v = raw[key];
    if (!isNullableString(v)) return { ok: false, error: `${key} must be a string or null` };
    patch[key] = v;
  }
  if ("reference_code" in raw) {
    const v = raw.reference_code;
    if (v !== null && (typeof v !== "string" || !REFERENCE_CODE_RE.test(v))) {
      return { ok: false, error: "reference_code must be an 8-digit string or null" };
    }
    patch.reference_code = v as string | null;
  }
  if ("is_test" in raw) {
    const v = raw.is_test;
    if (typeof v !== "boolean") return { ok: false, error: "is_test must be a boolean" };
    patch.is_test = v;
  }
  for (
    const key of [
      "call_attempts",
      "attempts_planned",
      "negotiation_rounds",
      "callback_attempts",
      "notice_attempts",
      "reminder_attempts",
      "outage_retries",
      "reschedules_today",
    ] as const
  ) {
    if (!(key in raw)) continue;
    const v = raw[key];
    if (!isNonNegativeInt(v)) return { ok: false, error: `${key} must be a non-negative integer` };
    patch[key] = v;
  }
  if ("reschedules_day" in raw) {
    const v = raw.reschedules_day;
    if (v !== null && (typeof v !== "string" || !ISO_DATE_RE.test(v))) {
      return { ok: false, error: "reschedules_day must be YYYY-MM-DD or null" };
    }
    patch.reschedules_day = v as string | null;
  }
  if ("attempts_state" in raw) {
    const v = raw.attempts_state;
    if (typeof v !== "string" || !ATTEMPTS_STATE_VALUES.has(v)) {
      return {
        ok: false,
        error: `attempts_state must be one of ${[...ATTEMPTS_STATE_VALUES].join(", ")}`,
      };
    }
    patch.attempts_state = v as AttemptsState;
  }
  if ("callback_state" in raw) {
    const v = raw.callback_state;
    if (typeof v !== "string" || !CALLBACK_STATE_VALUES.has(v)) {
      return {
        ok: false,
        error: `callback_state must be one of ${[...CALLBACK_STATE_VALUES].join(", ")}`,
      };
    }
    patch.callback_state = v as CallbackState;
  }
  if ("notice_state" in raw) {
    const v = raw.notice_state;
    if (typeof v !== "string" || !NOTICE_STATE_VALUES.has(v)) {
      return {
        ok: false,
        error: `notice_state must be one of ${[...NOTICE_STATE_VALUES].join(", ")}`,
      };
    }
    patch.notice_state = v as NoticeState;
  }
  if ("reminder_state" in raw) {
    const v = raw.reminder_state;
    if (typeof v !== "string" || !REMINDER_STATE_VALUES.has(v)) {
      return {
        ok: false,
        error: `reminder_state must be one of ${[...REMINDER_STATE_VALUES].join(", ")}`,
      };
    }
    patch.reminder_state = v as ReminderState;
  }
  if ("notice_kind" in raw) {
    const v = raw.notice_kind;
    if (v !== null && (typeof v !== "string" || !NOTICE_KIND_VALUES.has(v))) {
      return {
        ok: false,
        error: `notice_kind must be null or one of ${[...NOTICE_KIND_VALUES].join(", ")}`,
      };
    }
    patch.notice_kind = v as NoticeKind | null;
  }
  if ("cancelled_by" in raw) {
    const v = raw.cancelled_by;
    if (v !== null && (typeof v !== "string" || !CANCELLED_BY_VALUES.has(v))) {
      return {
        ok: false,
        error: `cancelled_by must be null or one of ${[...CANCELLED_BY_VALUES].join(", ")}`,
      };
    }
    patch.cancelled_by = v as CancelledBy | null;
  }
  if ("consumer_notify" in raw) {
    const v = raw.consumer_notify;
    if (typeof v !== "string" || !CONSUMER_NOTIFY_VALUES.has(v)) {
      return {
        ok: false,
        error: `consumer_notify must be one of ${[...CONSUMER_NOTIFY_VALUES].join(", ")}`,
      };
    }
    patch.consumer_notify = v as ConsumerNotify;
  }
  if ("reported_verdict" in raw) {
    const v = raw.reported_verdict;
    if (v !== null && (typeof v !== "string" || !REPORTED_VERDICT_VALUES.has(v))) {
      return {
        ok: false,
        error: `reported_verdict must be null or one of ${[...REPORTED_VERDICT_VALUES].join(", ")}`,
      };
    }
    patch.reported_verdict = v as ReportedVerdict | null;
  }
  if ("alternatives" in raw) {
    const v = raw.alternatives;
    if (!Array.isArray(v) || !v.every(isReservationAlternative)) {
      return {
        ok: false,
        error: "alternatives must be an array of {time, date?, note?} entries",
      };
    }
    patch.alternatives = v as ReservationAlternative[];
  }
  if ("attempts" in raw) {
    const v = raw.attempts;
    if (!Array.isArray(v) || !v.every(isReservationAttempt)) {
      return {
        ok: false,
        error: "attempts must be an array of {n, started_at, conversation_id, result} entries",
      };
    }
    patch.attempts = v as ReservationAttempt[];
  }

  return { ok: true, patch };
}

// ── writeReservation — THE write door (single-row) ─────────────────────────

export type ReservationWriteResult =
  | { ok: true; row: Record<string, unknown> | null }
  | { ok: false; error: string; code?: string };

export type ReservationWriteArgs =
  | { mode: "insert"; patch: ReservationPatch; select?: string }
  | {
    mode: "update";
    id: string;
    patch: ReservationPatch;
    /** Extra equality guards beyond `id` — e.g. {consumer_id}, {run_id},
     * {status: "pending"}. For a filter this door doesn't model (`.in(...)`,
     * `.or(...)`, a bulk sweep with no single id), call
     * validateReservationPatch directly and build the query yourself — see
     * business-web-confirm-reservation and supabase-cron-reservation-retries. */
    match?: Record<string, string>;
    select?: string;
  };

/**
 * THE reservation write door for single-row inserts/updates. Every insert or
 * by-id update against public.reservation_tickets that doesn't need a
 * multi-row filter goes through this — it is the only place a patch is
 * checked against the aggregate's shape and closed key sets before Postgres
 * ever sees it. `select`, when given, re-reads exactly those columns after
 * the write (matching what each call site already needed); omitted, the
 * write is fire-and-check-error, same as most existing sites.
 */
export async function writeReservation(
  admin: SupabaseClient,
  args: ReservationWriteArgs,
): Promise<ReservationWriteResult> {
  const validated = validateReservationPatch(args.patch);
  if (!validated.ok) return { ok: false, error: validated.error };
  const dbPatch = toPlaceIdPatch(validated.patch as Record<string, unknown>);

  if (args.mode === "insert") {
    if (args.select) {
      const { data, error } = await admin
        .from("reservation_tickets")
        .insert(dbPatch)
        .select(remapPlaceIdSelect(args.select))
        .single();
      if (error) return { ok: false, error: error.message, code: error.code };
      return {
        ok: true,
        row: fromPlaceIdRow(data as unknown as Record<string, unknown>),
      };
    }
    const { error } = await admin.from("reservation_tickets").insert(dbPatch);
    if (error) return { ok: false, error: error.message, code: error.code };
    return { ok: true, row: null };
  }

  let q = admin.from("reservation_tickets").update(dbPatch).eq("id", args.id);
  for (const [col, val] of Object.entries(args.match ?? {})) {
    q = q.eq(remapPlaceIdIdent(col), val);
  }
  if (args.select) {
    const { data, error } = await q.select(remapPlaceIdSelect(args.select)).single();
    if (error) return { ok: false, error: error.message, code: error.code };
    return {
      ok: true,
      row: fromPlaceIdRow(data as unknown as Record<string, unknown>),
    };
  }
  const { error } = await q;
  if (error) return { ok: false, error: error.message, code: error.code };
  return { ok: true, row: null };
}
