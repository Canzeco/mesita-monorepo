// The ticket aggregate — validator + THE write door (MESITA-1281, split off
// MESITA-1247 "Mesita as documents" §C — aggregate 4 of 6 named there; the
// widest write-call-site fan-out of the six, 17 files / 18 call sites, each
// one call site — against visit_tickets).
//
// THE TWO-BELT PATTERN (StampablePulseStep, pulse-report.ts; copied from
// consumer-doc.ts, aggregate 1's reference implementation — same shape, not
// the same fields):
//   Belt 1 — TypeScript. TicketWriteArgs.patch IS TicketPatch (a closed key
//     set), not Record<string, unknown> — a misspelled or retired field name
//     fails to compile at every call site that builds the patch as a typed
//     literal or variable.
//   Belt 2 — runtime. validateTicketPatch re-checks the same closed key set
//     (HTTP JSON has no compiler) plus the shape and cross-field invariants
//     below. A malformed patch never reaches Postgres.
//
// THE GUARD EXTENSION, not in consumer-doc.ts's shape: THE TICKET is a
// concurrency-sensitive 7-step machine (Bill/Reward/Task/QR/Pay/Validate/
// Results, MESITA-1084 v4) with a guest and staff writing the same row from
// different devices. Every call site researched here (17 of 18) guards its
// UPDATE with extra .eq()/.is()/.in() predicates beyond the row id — compare-
// and-swap on status, a null-check on approved_at, an expectedUpdatedAt CAS
// token (MESITA-1090 §12) — because a write that lands on a row the caller
// never saw is exactly the race this machine cannot allow (a stale approval,
// a guest's edit silently discarded). Belt 2 must not force every call site
// down to a bare `.eq("id", ...)` and quietly drop that guard — that would be
// this door WEAKENING a concurrency control every one of its callers already
// depends on. So the write door takes an optional `guard` (eq/is/in
// predicates applied verbatim, same as the hand-rolled queries they replace)
// and a `single` flag (some call sites treat a lost CAS as a generic error
// via `.single()`; others detect it explicitly via `.maybeSingle()` — both
// are preserved, not one picked for the other) — no aggregate router in this
// codebase has needed this yet; visit_tickets is the first.
//
// STEP ORDER IS DELIBERATELY NOT ENFORCED HERE. lib/ticket-journey.ts (web
// client) is the tested state machine that owns which status may follow
// which; this validator checks the STORED SHAPE of one patch only — the same
// scope consumer-doc.ts drew around itself (birthday format yes, age-gate
// business rule no). Encoding a transition table here risks blocking a legal
// edge the client machine allows; the issue names this explicitly as the
// landmine to not step on.
//
// THE CHECK -> VALIDATE RENAME (MESITA-1114/1115) touches visit_tickets only
// through check_code / ticket_code — both live, trigger-synced
// (sync_visit_ticket_validate_columns, 20260823070057). staff_pin lives on
// `projects` (twin of check_pin), gating writes through
// _shared/ticket-check.ts's requireCheckPin — entirely outside this
// aggregate's table and this door. The bill is always required (MESITA-1095);
// there is no per-place require_bill column any more.
//
// THE INVARIANTS, and why each is real (not invented) — every one below is a
// verbatim mirror of a live Postgres CHECK on visit_tickets (confirmed via
// pg_get_constraintdef against the project, 2026-08-23) or the column's own
// enum type, which Postgres enforces exactly as strictly as a CHECK would:
//   - status is one of ALL_TICKET_STATUSES (ticket_status enum, imported
//     from ticket-status.ts — the code-owned vocabulary already, not
//     re-typed here).
//   - story_status / review_status are one of the 8 story_status enum labels
//     (both columns share the one Postgres enum; read via pg_enum).
//   - bill_source, if set: 'business' | 'consumer' (visit_tickets_bill_
//     source_check).
//   - fix_requested, if set: 'bill' | 'proof' | 'reward' (visit_tickets_
//     fix_requested_kind).
//   - paid_method, if set: 'at_place' | 'mesita' (visit_tickets_paid_
//     method_kind).
//   - story_ojo_verdict / review_ojo_verdict, if set: 'pass' | 'unsure' |
//     'fail' (visit_tickets_story/review_ojo_verdict_check).
//   - bill_subtotal_cents, tip_cents, total_cents, redeem_cents, discount_
//     cents, approved_discount_cents, approved_amount_due_cents: each NULL
//     or >= 0 (their six matching *_check constraints — every money column
//     on this table is non-negative, no exceptions).
//   - discount_percent, tip_pct: NULL or 0-100 (visit_tickets_discount_
//     percent_check / _tip_pct_range).
//   - story_ojo_confidence, review_ojo_confidence: NULL or 0-1 (their two
//     *_confidence_check constraints).
//   - fix_note: NULL or <= 200 chars (visit_tickets_fix_note_len).
//   - approved_at and fix_requested are mutually exclusive WITHIN one patch
//     (visit_tickets_approved_xor_fix) — the exact cross-field DB CHECK,
//     checked here only when both keys appear in the same patch, the same
//     scope consumer-doc.ts drew around class_origin/class_expires_at:
//     a patch that touches only one of the pair can't be judged without
//     reading the row, and Postgres's own CHECK is the backstop for that.
//
// welcome_free_rate / welcome_premium_rate / free_rate / premium_rate carry
// NO live CHECK (confirmed absent from pg_constraint) — validated as number
// or null only, no invented range. check_code / ticket_code likewise carry
// no format CHECK (the EXPAND migration says so explicitly, to keep the two
// columns' sync symmetric) — validated as string or null only.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { ALL_TICKET_STATUSES, type TicketStatus } from "./ticket-status.ts";

// ── TicketDoc — the full row shape ──────────────────────────────────────

/** The 8 live labels of the story_status Postgres enum, shared verbatim by
 * review_status (one enum, two columns) — read via pg_enum, 2026-08-23. */
export type TicketActionStatus =
  | "not_required"
  | "pending"
  | "submitted"
  | "ai_verified"
  | "ai_rejected"
  | "staff_verified"
  | "staff_rejected"
  | "self_verified";

const TICKET_ACTION_STATUS_VALUES = new Set<string>([
  "not_required",
  "pending",
  "submitted",
  "ai_verified",
  "ai_rejected",
  "staff_verified",
  "staff_rejected",
  "self_verified",
]);

export type TicketDoc = {
  id: string;
  created_at: string;
  updated_at: string;
  // Identity — set at insert, never patched again in practice; still part of
  // the closed key set below because the insert path writes them through
  // the same patch (there is no separate `id` arg the way ConsumerWriteArgs
  // has one — visit_tickets.id is DB-generated, gen_random_uuid()).
  project_id: string;
  consumer_id: string;
  opened_by: string;
  status: TicketStatus;
  bill_subtotal_cents: number | null;
  tip_cents: number | null;
  total_cents: number | null;
  currency: string;
  paid_at: string | null;
  cancelled_at: string | null;
  redeem_cents: number | null;
  cancel_reason: string | null;
  story_status: TicketActionStatus;
  story_screenshot_url: string | null;
  story_submitted_at: string | null;
  story_verified_at: string | null;
  story_verified_by: string | null;
  story_reject_reason: string | null;
  discount_percent: number | null;
  discount_cents: number | null;
  revealed_at: string | null;
  review_status: TicketActionStatus;
  review_screenshot_url: string | null;
  review_submitted_at: string | null;
  review_verified_at: string | null;
  review_verified_by: string | null;
  review_reject_reason: string | null;
  check_code: string | null;
  first_scanned_at: string | null;
  bill_source: "business" | "consumer" | null;
  welcome_free_rate: number | null;
  welcome_premium_rate: number | null;
  free_rate: number | null;
  premium_rate: number | null;
  rates_snapshotted_at: string | null;
  tip_pct: number | null;
  approved_at: string | null;
  approved_discount_cents: number | null;
  approved_amount_due_cents: number | null;
  fix_requested: "bill" | "proof" | "reward" | null;
  fix_note: string | null;
  paid_method: "at_place" | "mesita" | null;
  validated_at: string | null;
  ticket_code: string | null;
  story_ojo_verdict: "pass" | "unsure" | "fail" | null;
  story_ojo_confidence: number | null;
  story_ojo_reasons: string[] | null;
  story_ojo_checked_at: string | null;
  story_ojo_attempts: number;
  review_ojo_verdict: "pass" | "unsure" | "fail" | null;
  review_ojo_confidence: number | null;
  review_ojo_reasons: string[] | null;
  review_ojo_checked_at: string | null;
  review_ojo_attempts: number;
};

// Every field a patch may touch — everything except `id`, `created_at` and
// `updated_at` (server-stamped: gen_random_uuid(), now(), the
// tickets_set_updated_at trigger). `as const satisfies` makes a typo here a
// compile error.
export const TICKET_PATCH_KEYS = [
  "project_id",
  "consumer_id",
  "opened_by",
  "status",
  "bill_subtotal_cents",
  "tip_cents",
  "total_cents",
  "currency",
  "paid_at",
  "cancelled_at",
  "redeem_cents",
  "cancel_reason",
  "story_status",
  "story_screenshot_url",
  "story_submitted_at",
  "story_verified_at",
  "story_verified_by",
  "story_reject_reason",
  "discount_percent",
  "discount_cents",
  "revealed_at",
  "review_status",
  "review_screenshot_url",
  "review_submitted_at",
  "review_verified_at",
  "review_verified_by",
  "review_reject_reason",
  "check_code",
  "first_scanned_at",
  "bill_source",
  "welcome_free_rate",
  "welcome_premium_rate",
  "free_rate",
  "premium_rate",
  "rates_snapshotted_at",
  "tip_pct",
  "approved_at",
  "approved_discount_cents",
  "approved_amount_due_cents",
  "fix_requested",
  "fix_note",
  "paid_method",
  "validated_at",
  "ticket_code",
  "story_ojo_verdict",
  "story_ojo_confidence",
  "story_ojo_reasons",
  "story_ojo_checked_at",
  "story_ojo_attempts",
  "review_ojo_verdict",
  "review_ojo_confidence",
  "review_ojo_reasons",
  "review_ojo_checked_at",
  "review_ojo_attempts",
] as const satisfies readonly (keyof Omit<TicketDoc, "id" | "created_at" | "updated_at">)[];

// Compile-time exhaustiveness check the other direction: if a field is ever
// added to TicketDoc and this array is forgotten, `_exhaustive` fails to
// type as `true` and the file stops compiling — same discipline
// FUNCTION_STATE_KEYS borrows from PULSE_PIECE_META (MESITA-1222),
// consumer-doc.ts borrows in turn.
type _MissingFromTicketPatchKeys = Exclude<
  keyof Omit<TicketDoc, "id" | "created_at" | "updated_at">,
  typeof TICKET_PATCH_KEYS[number]
>;
const _assertNoMissingTicketPatchKeys: _MissingFromTicketPatchKeys extends never ? true
  : ["TICKET_PATCH_KEYS is missing a field from TicketDoc", _MissingFromTicketPatchKeys] = true;
void _assertNoMissingTicketPatchKeys;

export type TicketPatch = Partial<
  Pick<TicketDoc, typeof TICKET_PATCH_KEYS[number]>
>;

// ── validateTicketPatch — belt 2 ────────────────────────────────────────

export type TicketValidationResult =
  | { ok: true; patch: TicketPatch }
  | { ok: false; error: string };

const BILL_SOURCE_VALUES = new Set(["business", "consumer"]);
const FIX_REQUESTED_VALUES = new Set(["bill", "proof", "reward"]);
const PAID_METHOD_VALUES = new Set(["at_place", "mesita"]);
const OJO_VERDICT_VALUES = new Set(["pass", "unsure", "fail"]);
const TICKET_STATUS_VALUES = new Set<string>(ALL_TICKET_STATUSES);

function isNullableString(v: unknown): v is string | null {
  return v === null || typeof v === "string";
}

/** NULL or >= 0 — the shape every *_cents CHECK on this table shares. */
function isNonNegativeOrNull(v: unknown): v is number | null {
  return v === null || (typeof v === "number" && Number.isFinite(v) && v >= 0);
}

function isPercentOrNull(v: unknown): v is number | null {
  return v === null || (typeof v === "number" && v >= 0 && v <= 100);
}

function isUnitIntervalOrNull(v: unknown): v is number | null {
  return v === null || (typeof v === "number" && v >= 0 && v <= 1);
}

function isNumberOrNull(v: unknown): v is number | null {
  return v === null || typeof v === "number";
}

function isStringArrayOrNull(v: unknown): v is string[] | null {
  return v === null ||
    (Array.isArray(v) && v.every((x) => typeof x === "string"));
}

/**
 * The ticket aggregate's runtime shape guard. Rejects an unknown key
 * (closed key set), a wrong-typed value, or a value that breaks one of the
 * cross-field invariants documented above. Returns the same patch back,
 * narrowed to TicketPatch, so a caller that passed validation never
 * re-checks what this function already confirmed.
 */
export function validateTicketPatch(input: unknown): TicketValidationResult {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, error: "ticket patch must be an object" };
  }
  const raw = input as Record<string, unknown>;

  for (const key of Object.keys(raw)) {
    if (!(TICKET_PATCH_KEYS as readonly string[]).includes(key)) {
      return { ok: false, error: `unknown ticket field: ${key}` };
    }
  }

  const patch: TicketPatch = {};

  for (const key of ["project_id", "consumer_id", "opened_by"] as const) {
    if (!(key in raw)) continue;
    const v = raw[key];
    if (typeof v !== "string" || v.length === 0) {
      return { ok: false, error: `${key} must be a non-empty string` };
    }
    patch[key] = v;
  }
  if ("status" in raw) {
    const v = raw.status;
    if (typeof v !== "string" || !TICKET_STATUS_VALUES.has(v)) {
      return { ok: false, error: `status must be one of ${[...TICKET_STATUS_VALUES].join(", ")}` };
    }
    patch.status = v as TicketStatus;
  }
  for (const key of ["story_status", "review_status"] as const) {
    if (!(key in raw)) continue;
    const v = raw[key];
    if (typeof v !== "string" || !TICKET_ACTION_STATUS_VALUES.has(v)) {
      return { ok: false, error: `${key} must be one of ${[...TICKET_ACTION_STATUS_VALUES].join(", ")}` };
    }
    patch[key] = v as TicketActionStatus;
  }
  for (
    const key of [
      "bill_subtotal_cents",
      "tip_cents",
      "total_cents",
      "redeem_cents",
      "discount_cents",
      "approved_discount_cents",
      "approved_amount_due_cents",
    ] as const
  ) {
    if (!(key in raw)) continue;
    if (!isNonNegativeOrNull(raw[key])) {
      return { ok: false, error: `${key} must be a non-negative number or null` };
    }
    patch[key] = raw[key] as number | null;
  }
  for (const key of ["discount_percent", "tip_pct"] as const) {
    if (!(key in raw)) continue;
    if (!isPercentOrNull(raw[key])) {
      return { ok: false, error: `${key} must be 0-100 or null` };
    }
    patch[key] = raw[key] as number | null;
  }
  for (const key of ["story_ojo_confidence", "review_ojo_confidence"] as const) {
    if (!(key in raw)) continue;
    if (!isUnitIntervalOrNull(raw[key])) {
      return { ok: false, error: `${key} must be 0-1 or null` };
    }
    patch[key] = raw[key] as number | null;
  }
  for (
    const key of [
      "welcome_free_rate",
      "welcome_premium_rate",
      "free_rate",
      "premium_rate",
    ] as const
  ) {
    if (!(key in raw)) continue;
    if (!isNumberOrNull(raw[key])) {
      return { ok: false, error: `${key} must be a number or null` };
    }
    patch[key] = raw[key] as number | null;
  }
  for (const key of ["story_ojo_attempts", "review_ojo_attempts"] as const) {
    if (!(key in raw)) continue;
    const v = raw[key];
    if (typeof v !== "number" || !Number.isInteger(v)) {
      return { ok: false, error: `${key} must be an integer` };
    }
    patch[key] = v;
  }
  if ("currency" in raw) {
    const v = raw.currency;
    if (typeof v !== "string" || v.length === 0) {
      return { ok: false, error: "currency must be a non-empty string" };
    }
    patch.currency = v;
  }
  if ("bill_source" in raw) {
    const v = raw.bill_source;
    if (v !== null && (typeof v !== "string" || !BILL_SOURCE_VALUES.has(v))) {
      return { ok: false, error: "bill_source must be 'business', 'consumer', or null" };
    }
    patch.bill_source = v as "business" | "consumer" | null;
  }
  if ("fix_requested" in raw) {
    const v = raw.fix_requested;
    if (v !== null && (typeof v !== "string" || !FIX_REQUESTED_VALUES.has(v))) {
      return { ok: false, error: "fix_requested must be 'bill', 'proof', 'reward', or null" };
    }
    patch.fix_requested = v as "bill" | "proof" | "reward" | null;
  }
  if ("fix_note" in raw) {
    const v = raw.fix_note;
    if (!isNullableString(v) || (typeof v === "string" && v.length > 200)) {
      return { ok: false, error: "fix_note must be a string of 200 characters or fewer, or null" };
    }
    patch.fix_note = v;
  }
  if ("paid_method" in raw) {
    const v = raw.paid_method;
    if (v !== null && (typeof v !== "string" || !PAID_METHOD_VALUES.has(v))) {
      return { ok: false, error: "paid_method must be 'at_place', 'mesita', or null" };
    }
    patch.paid_method = v as "at_place" | "mesita" | null;
  }
  for (const key of ["story_ojo_verdict", "review_ojo_verdict"] as const) {
    if (!(key in raw)) continue;
    const v = raw[key];
    if (v !== null && (typeof v !== "string" || !OJO_VERDICT_VALUES.has(v))) {
      return { ok: false, error: `${key} must be 'pass', 'unsure', 'fail', or null` };
    }
    patch[key] = v as "pass" | "unsure" | "fail" | null;
  }
  for (const key of ["story_ojo_reasons", "review_ojo_reasons"] as const) {
    if (!(key in raw)) continue;
    if (!isStringArrayOrNull(raw[key])) {
      return { ok: false, error: `${key} must be an array of strings or null` };
    }
    patch[key] = raw[key] as string[] | null;
  }
  for (
    const key of [
      "paid_at",
      "cancelled_at",
      "cancel_reason",
      "story_screenshot_url",
      "story_submitted_at",
      "story_verified_at",
      "story_verified_by",
      "story_reject_reason",
      "revealed_at",
      "review_screenshot_url",
      "review_submitted_at",
      "review_verified_at",
      "review_verified_by",
      "review_reject_reason",
      "check_code",
      "first_scanned_at",
      "rates_snapshotted_at",
      "approved_at",
      "validated_at",
      "ticket_code",
      "story_ojo_checked_at",
      "review_ojo_checked_at",
    ] as const
  ) {
    if (!(key in raw)) continue;
    if (!isNullableString(raw[key])) {
      return { ok: false, error: `${key} must be a string or null` };
    }
    patch[key] = raw[key] as string | null;
  }

  // ── Cross-field invariant: approved_at XOR fix_requested ────────────────
  // Verbatim visit_tickets_approved_xor_fix, checked only when BOTH keys are
  // in the SAME patch — a patch touching just one can't be judged without
  // reading the row; Postgres's own CHECK is the backstop for that case,
  // same scope consumer-doc.ts drew for class_origin/class_expires_at.
  if (patch.approved_at !== undefined && patch.fix_requested !== undefined) {
    if (patch.approved_at !== null && patch.fix_requested !== null) {
      return {
        ok: false,
        error: "approved_at and fix_requested cannot both be set in the same patch",
      };
    }
  }

  return { ok: true, patch };
}

// ── writeTicket — THE write door ────────────────────────────────────────

export type TicketWriteResult =
  | { ok: true; row: Record<string, unknown> | null }
  | { ok: false; error: string; code?: string };

/** Extra WHERE predicates applied verbatim, in this order, alongside the row
 * id — the compare-and-swap guard every UPDATE call site researched here
 * (bar one) already carries. Not a general query builder: exactly the three
 * operators (`eq`/`is`/`in`) the 17 call sites use. */
export type TicketGuard = {
  eq?: Record<string, unknown>;
  is?: Record<string, null>;
  in?: Record<string, readonly unknown[]>;
};

export type TicketWriteArgs =
  | { mode: "insert"; patch: TicketPatch; select?: string }
  | {
    mode: "update";
    id: string;
    patch: TicketPatch;
    guard?: TicketGuard;
    select?: string;
    /** true = `.single()` (a lost CAS surfaces as a Postgrest error, the
     *  shape some call sites already relied on); false/omitted =
     *  `.maybeSingle()` (a lost CAS surfaces as `row: null`, no error) —
     *  both are real, existing call-site behavior, not a new choice. */
    single?: boolean;
  }
  | { mode: "delete"; match: Record<string, unknown> };

/**
 * THE ticket write door. Every insert/update/delete against public.
 * visit_tickets in the codebase goes through this — it is the only place a
 * patch is checked against the aggregate's shape, closed key set, and
 * cross-field invariants before Postgres ever sees it. `delete` carries no
 * patch (nothing to validate — deleting writes no field values) and matches
 * on the given columns verbatim, the same shape consumer-web-delete-account
 * already used for its cascade clean-up.
 */
export async function writeTicket(
  admin: SupabaseClient,
  args: TicketWriteArgs,
): Promise<TicketWriteResult> {
  if (args.mode === "delete") {
    // deno-lint-ignore no-explicit-any
    let q: any = admin.from("visit_tickets").delete();
    for (const [column, value] of Object.entries(args.match)) {
      q = q.eq(column, value);
    }
    const { error } = await q;
    if (error) return { ok: false, error: error.message, code: error.code };
    return { ok: true, row: null };
  }

  const validated = validateTicketPatch(args.patch);
  if (!validated.ok) return { ok: false, error: validated.error };

  if (args.mode === "insert") {
    // deno-lint-ignore no-explicit-any
    let q: any = admin.from("visit_tickets").insert(validated.patch);
    if (args.select) {
      q = q.select(args.select).single();
      const { data, error } = await q;
      if (error) return { ok: false, error: error.message, code: error.code };
      return { ok: true, row: data as unknown as Record<string, unknown> };
    }
    const { error } = await q;
    if (error) return { ok: false, error: error.message, code: error.code };
    return { ok: true, row: null };
  }

  // update
  // deno-lint-ignore no-explicit-any
  let q: any = admin.from("visit_tickets").update(validated.patch).eq(
    "id",
    args.id,
  );
  if (args.guard?.eq) {
    for (const [column, value] of Object.entries(args.guard.eq)) {
      q = q.eq(column, value);
    }
  }
  if (args.guard?.is) {
    for (const [column, value] of Object.entries(args.guard.is)) {
      q = q.is(column, value);
    }
  }
  if (args.guard?.in) {
    for (const [column, values] of Object.entries(args.guard.in)) {
      q = q.in(column, values);
    }
  }
  if (args.select) {
    q = args.single
      ? q.select(args.select).single()
      : q.select(args.select).maybeSingle();
    const { data, error } = await q;
    if (error) return { ok: false, error: error.message, code: error.code };
    return { ok: true, row: (data as unknown as Record<string, unknown>) ?? null };
  }
  const { error } = await q;
  if (error) return { ok: false, error: error.message, code: error.code };
  return { ok: true, row: null };
}
