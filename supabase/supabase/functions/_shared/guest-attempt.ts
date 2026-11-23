// MESITA-4524 — no zombie tickets. A guest pay attempt (guest_pay_attempts)
// always ends: closed (paid; a pay_tabs ticket) or released with one reason.
//
//   card / wallet  Bill · Tip · Method · Confirm · Pay · Receipt
//                  "Show the waiter" places a HOLD; the waiter's Confirm
//                  captures it (Pay).
//   cash           Bill · Tip · Method · Pay · Confirm · Receipt
//   credits-only   held at once; the waiter's Confirm spends them.
//
// The state machine (guest_pay_phase in SQL):
//
//   begin ─► placing_hold ──hold lands (requires_capture)──► live ──Confirm claim──► charging ──captured──► closed
//                 │                                            │                         │
//                 └─ refused / dismissed ─► released           └─ Cancel/Reject/expiry   └─ refused + read back
//                                                                 claim → cancel hold       not charged ─► released(declined)
//                                                                 → read back ─► released   unknown ─► stays charging (retry)
//
// Every transition that talks to Stripe is CLAIM (SQL) → Stripe → FINISH
// (SQL): supabase-js has no multi-statement transactions. A release is
// written only after Stripe reads back canceled or requires_payment_method.
//
// To the screens an attempt looks like a guest bill (attemptAsTab): the
// guest's GuestTabView and the waiter's GuestVerify read it unchanged.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { settlePaidPayment } from "./settle-payment.ts";
import { type StripeCall, StripeError } from "./stripe.ts";
import { hashTabToken, type TabPartRow, type TabRow } from "./tab.ts";

/** Thresholds, once (MESITA-4524 §5c). The window is money config. */
export const GUEST_PAY = {
  windowMinutesDefault: 15,
  prevTokenGraceSec: 60,
  chargingAlertMs: 10 * 60_000,
  reviewCapMs: 60 * 60_000,
  sweepBatch: 50,
} as const;

/** Our word is "cancelled"; Stripe's PaymentIntent status is "canceled". */
export type EndReason = "declined" | "rejected" | "expired" | "cancelled";
export const STRIPE_CANCELED = "canceled";

export type AttemptRow = {
  id: string;
  consumer_id: string;
  place_id: string;
  request_id: string;
  bill_cents: number;
  tip_cents: number;
  credit_cents: number;
  cash_cents: number;
  card_cents: number;
  currency: string;
  livemode: boolean;
  tender: "credits" | "card" | "cash";
  status: "opening" | "due" | "closed" | "released";
  payment_id: string | null;
  tab_id: string | null;
  token_hash: string;
  prev_token_hash: string | null;
  prev_token_until: string | null;
  expires_at: string;
  created_at: string;
  end_reason: EndReason | null;
  held_at: string | null;
  charging_at: string | null;
  ending_at: string | null;
  ending_reason: EndReason | null;
  needs_review_at: string | null;
  /** MESITA-4770: what applied to this bill; the discount came off bill_cents. */
  visit_mechanism?: "cashback" | "discount" | null;
  discount_bps?: number;
  discount_cents?: number;
};

const ATTEMPT_COLUMNS =
  "id, consumer_id, place_id, request_id, bill_cents, tip_cents, credit_cents, cash_cents, card_cents, currency, livemode, tender, status, payment_id, tab_id, token_hash, prev_token_hash, prev_token_until, expires_at, created_at, end_reason, held_at, charging_at, ending_at, ending_reason, needs_review_at, visit_mechanism, discount_bps, discount_cents";

export type Phase = "placing_hold" | "live" | "charging" | "closed" | "released";

/** The SQL's guest_pay_phase, for a row already read. Pure. */
export function phaseOf(a: Pick<AttemptRow, "status" | "charging_at" | "held_at">): Phase {
  if (a.status === "closed") return "closed";
  if (a.status === "released") return "released";
  if (a.charging_at) return "charging";
  if (!a.held_at) return "placing_hold";
  return "live";
}

function log(fields: Record<string, unknown>): void {
  // Never a token in a log line.
  console.log("[guest-pay]", JSON.stringify(fields));
}

export async function readAttemptById(admin: SupabaseClient, id: string): Promise<AttemptRow | null> {
  const { data, error } = await admin.from("guest_pay_attempts").select(ATTEMPT_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`guest_pay_attempts_read: ${error.message}`);
  return (data as AttemptRow | null) ?? null;
}

/** The waiter's scan: the current token, or the previous one within its
 *  60-second grace after a reissue. */
export async function readAttemptByToken(admin: SupabaseClient, token: string, nowMs = Date.now()): Promise<AttemptRow | null> {
  const hash = await hashTabToken(token);
  const { data, error } = await admin.from("guest_pay_attempts").select(ATTEMPT_COLUMNS).eq("token_hash", hash).maybeSingle();
  if (error) throw new Error(`guest_pay_attempts_read: ${error.message}`);
  if (data) return data as AttemptRow;
  const prev = await admin.from("guest_pay_attempts").select(ATTEMPT_COLUMNS).eq("prev_token_hash", hash).maybeSingle();
  if (prev.error) throw new Error(`guest_pay_attempts_read: ${prev.error.message}`);
  const row = (prev.data as AttemptRow | null) ?? null;
  if (row && row.prev_token_until && Date.parse(row.prev_token_until) > nowMs) return row;
  return null;
}

type PaymentRow = {
  id: string;
  part: string | null;
  status: string;
  credit_cents: number;
  outside_cents: number;
  card_cents: number;
  tip_cents: number;
  paid_at: string | null;
  proof_token: string | null;
  created_at: string;
  held_at: string | null;
  pay_with: string | null;
  pay_source: string | null;
  stripe_payment_intent_id: string | null;
  stripe_account_id: string | null;
};

export async function readAttemptPayment(admin: SupabaseClient, a: AttemptRow): Promise<PaymentRow | null> {
  if (!a.payment_id) return null;
  const { data, error } = await admin.from("wallet_payments")
    .select("id, part, status, credit_cents, outside_cents, card_cents, tip_cents, paid_at, proof_token, created_at, held_at, pay_with, pay_source, stripe_payment_intent_id, stripe_account_id")
    .eq("id", a.payment_id).maybeSingle();
  if (error) throw new Error(`attempt_payment_read: ${error.message}`);
  return (data as PaymentRow | null) ?? null;
}

/** What the guest's Not paid says, keyed by the bill's end_reason. */
const TAB_END_REASON: Record<EndReason, string> = {
  // A ticket declined at the waiter's Confirm: "The card charge failed."
  // (guest) and "Not charged" (waiter).
  declined: "capture_failed",
  rejected: "rejected",
  expired: "expired",
  cancelled: "cancelled",
};

/** An open or released attempt as the guest bill both screens already
 *  read. A closed attempt is read from its real ticket instead. Pure. */
export function attemptAsTab(a: AttemptRow): TabRow {
  const card = a.tender === "card" ? a.card_cents - a.tip_cents : 0;
  const cash = a.tender === "cash" ? a.cash_cents - a.tip_cents : 0;
  const status = a.status === "released" ? (a.end_reason === "expired" ? "expired" : "cancelled") : "paying";
  return {
    id: a.id,
    place_id: a.place_id,
    consumer_id: a.consumer_id,
    status,
    currency: a.currency,
    livemode: a.livemode,
    bill_cents: a.bill_cents,
    tip_cents: a.tip_cents,
    ticket: null,
    bill_version: 1,
    waiter_name: null,
    staff_key_hash: null,
    credit_cents: a.credit_cents,
    cash_bill_cents: cash,
    cash_tip_cents: a.tender === "cash" ? a.tip_cents : 0,
    card_bill_cents: card,
    card_tip_cents: a.tender === "card" ? a.tip_cents : 0,
    cash_received_cents: null,
    billed_at: a.created_at,
    paying_at: a.created_at,
    paid_at: null,
    expires_at: a.expires_at,
    updated_at: a.charging_at ?? a.held_at ?? a.created_at,
    created_at: a.created_at,
    origin: "guest",
    verified_at: null,
    end_reason: a.end_reason ? TAB_END_REASON[a.end_reason] : null,
    signing_at: a.status === "opening" || a.status === "due" ? a.charging_at : null,
    visit_mechanism: a.visit_mechanism ?? null,
    discount_bps: a.discount_bps ?? 0,
    discount_cents: a.discount_cents ?? 0,
  };
}

/** The attempt's money row as a bill part; a card part reads held once the
 *  attempt is (the waiter's card_pending is false only then). */
export function attemptParts(a: AttemptRow, p: PaymentRow | null): TabPartRow[] {
  if (!p) return [];
  return [{
    id: p.id,
    part: p.part,
    status: p.status,
    credit_cents: p.credit_cents,
    outside_cents: p.outside_cents,
    card_cents: p.card_cents,
    tip_cents: p.tip_cents,
    paid_at: p.paid_at,
    proof_token: null,
    created_at: p.created_at,
    held_at: a.held_at ?? p.held_at ?? null,
    pay_with: p.pay_with,
  }];
}

// ── Ending (Cancel, Reject, expiry, a refused hold) ────────────────────────

export type EndOutcome =
  | { ok: true; outcome: "released" | "already"; endReason: EndReason }
  | { ok: false; code: "charging" | "already_final" | "gone" | "forbidden" | "pending"; tabId?: string | null };

type ClaimAnswer = Record<string, unknown>;

async function rpc(admin: Pick<SupabaseClient, "rpc">, fn: string, args: Record<string, unknown>): Promise<ClaimAnswer> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return (data ?? {}) as ClaimAnswer;
}

/** Cancels a PaymentIntent and reads it back. Answers whether Stripe says
 *  nothing was charged (canceled / requires_payment_method), or succeeded,
 *  or still unknown. */
async function cancelAndReadBack(
  stripe: StripeCall,
  pi: string,
  account: string,
  key: string,
): Promise<"not_charged" | "succeeded" | "unknown"> {
  const path = `payment_intents/${encodeURIComponent(pi)}`;
  let after: Record<string, unknown> | null = null;
  try {
    after = await stripe("POST", `${path}/cancel`, {}, { stripeAccount: account, idempotencyKey: key });
  } catch (err) {
    if (!(err instanceof StripeError) || err.httpStatus !== 400) return "unknown";
  }
  if (!after || after.status !== STRIPE_CANCELED) {
    try {
      after = await stripe("GET", path, undefined, { stripeAccount: account });
    } catch {
      return "unknown";
    }
  }
  if (after.status === STRIPE_CANCELED || after.status === "requires_payment_method") return "not_charged";
  if (after.status === "succeeded") return "succeeded";
  return "unknown";
}

/** Ends an open attempt: claim → let any hold go → release. A charging one
 *  is refused (`charging`); a hold Stripe will not confirm as let go stays
 *  for the next sweep (`pending`). */
export async function endAttempt(
  admin: SupabaseClient,
  stripe: StripeCall | null,
  attemptId: string,
  reason: EndReason,
  scope: { consumerId?: string; placeId?: string; source: string },
): Promise<EndOutcome> {
  const claim = await rpc(admin, "pay_guest_claim_end", {
    p_attempt_id: attemptId,
    p_reason: reason,
    p_consumer_id: scope.consumerId ?? null,
    p_place_id: scope.placeId ?? null,
  });
  if (claim.ok !== true) {
    const code = String(claim.code ?? "gone") as "charging" | "already_final" | "gone" | "forbidden";
    return { ok: false, code, tabId: (claim.tab_id as string | null | undefined) ?? null };
  }
  if (claim.outcome === "already") return { ok: true, outcome: "already", endReason: (claim.end_reason as EndReason) ?? reason };
  const finalReason = ((claim.ending_reason as EndReason | undefined) ?? reason);
  const pi = typeof claim.payment_intent === "string" ? claim.payment_intent : null;
  const account = typeof claim.stripe_account_id === "string" ? claim.stripe_account_id : null;
  if (pi && account) {
    if (!stripe) return { ok: false, code: "pending" };
    const read = await cancelAndReadBack(stripe, pi, account, `attempt-cancel:${attemptId}`);
    if (read === "succeeded") {
      // Money moved after all: never "Not paid". The settle records it;
      // the ticket closes when the payment reads paid.
      log({ attempt_id: attemptId, from: "ending", to: "closing", reason: "late_success", source: scope.source, pi_id: pi });
      if (claim.payment_id) await settlePaidPayment(admin, String(claim.payment_id), pi);
      await rpc(admin, "pay_guest_close", { p_attempt_id: attemptId });
      return { ok: false, code: "already_final" };
    }
    if (read === "unknown") {
      log({ attempt_id: attemptId, from: "ending", to: "ending", reason: "stripe_unknown", source: scope.source, pi_id: pi });
      return { ok: false, code: "pending" };
    }
  }
  const fin = await rpc(admin, "pay_guest_finish_release", { p_attempt_id: attemptId, p_reason: finalReason });
  if (fin.ok !== true) return { ok: false, code: (fin.code === "paid" ? "already_final" : String(fin.code ?? "gone")) as "already_final" };
  log({ attempt_id: attemptId, to: "released", reason: finalReason, source: scope.source, pi_id: pi });
  return { ok: true, outcome: fin.outcome === "already" ? "already" : "released", endReason: finalReason };
}

// ── The waiter's Confirm ───────────────────────────────────────────────────

export type ConfirmOutcome =
  | { ok: true; outcome: "verified" | "already_verified" | "confirming"; tabId: string | null }
  | { ok: false; status: number; code: string; error: string };

const CONFIRM_REFUSALS: Record<string, [number, string]> = {
  gone: [404, "Scan the guest's screen again."],
  forbidden: [403, "This bill is for another place."],
  already_final: [409, "This bill is no longer open."],
  card_pending: [409, "The guest's card is still going through."],
  expired: [409, "This bill expired. Ask the guest to start a new one."],
  capture_failed: [409, "The card charge failed. Nothing was charged."],
};

function confirmRefusal(code: string): ConfirmOutcome {
  const [status, error] = CONFIRM_REFUSALS[code] ?? [409, "That did not go through."];
  return { ok: false, status, code, error };
}

/** Captures a confirmed card hold. succeeded → settle (spends the held
 *  credit) and close; a refusal read back as not charged → released
 *  declined; anything else stays charging for the next read. */
export async function captureAttemptHold(
  admin: SupabaseClient,
  stripe: StripeCall,
  hold: { attemptId: string; paymentId: string; paymentIntent: string; account: string },
): Promise<"paid" | "declined" | "confirming"> {
  const path = `payment_intents/${encodeURIComponent(hold.paymentIntent)}`;
  let pi: Record<string, unknown>;
  try {
    pi = await stripe("POST", `${path}/capture`, {}, { stripeAccount: hold.account, idempotencyKey: `attempt-capture:${hold.attemptId}` });
  } catch (err) {
    if (!(err instanceof StripeError) || (err.httpStatus !== 400 && err.httpStatus !== 402)) {
      log({ attempt_id: hold.attemptId, from: "charging", to: "charging", reason: "capture_unanswered", source: "ef", pi_id: hold.paymentIntent });
      return "confirming";
    }
    try {
      pi = await stripe("GET", path, undefined, { stripeAccount: hold.account });
    } catch {
      return "confirming";
    }
  }
  if (pi.status === "succeeded") {
    await settlePaidPayment(admin, hold.paymentId, hold.paymentIntent);
    const closed = await rpc(admin, "pay_guest_close", { p_attempt_id: hold.attemptId });
    if (closed.ok !== true) throw new Error(`pay_guest_close: ${String(closed.code)}`);
    log({ attempt_id: hold.attemptId, from: "charging", to: "closed", reason: "captured", source: "ef", pi_id: hold.paymentIntent });
    return "paid";
  }
  if (pi.status === STRIPE_CANCELED || pi.status === "requires_payment_method") {
    const fin = await rpc(admin, "pay_guest_finish_release", { p_attempt_id: hold.attemptId, p_reason: "declined" });
    const last = (pi.last_payment_error ?? {}) as Record<string, unknown>;
    log({ attempt_id: hold.attemptId, from: "charging", to: "released", reason: "declined", source: "ef", pi_id: hold.paymentIntent, decline_code: String(last.decline_code ?? last.code ?? "") });
    return fin.ok === true ? "declined" : "confirming";
  }
  // requires_capture after a refusal, processing: read again later. A hold
  // that cannot be captured is cancelled by the sweep after the review cap.
  return "confirming";
}

/** The waiter's Confirm on an attempt (visit-web-verify-tab). */
export async function confirmAttempt(
  admin: SupabaseClient,
  stripe: StripeCall | null,
  a: AttemptRow,
  args: { placeId: string; keyHash: string },
): Promise<ConfirmOutcome> {
  if (a.place_id !== args.placeId) return confirmRefusal("forbidden");
  const claim = await rpc(admin, "pay_guest_claim_confirm", { p_attempt_id: a.id, p_place_id: args.placeId, p_key_hash: args.keyHash });
  if (claim.ok !== true) return confirmRefusal(String(claim.code ?? "gone"));
  if (claim.outcome === "already_confirmed") return { ok: true, outcome: "already_verified", tabId: (claim.tab_id as string | null) ?? null };
  // A repeat tap while charging: carry on with the same capture (same key).
  if (a.tender === "card") {
    const pi = typeof claim.payment_intent === "string" ? claim.payment_intent : null;
    const account = typeof claim.stripe_account_id === "string" ? claim.stripe_account_id : null;
    let paymentId = typeof claim.payment_id === "string" ? claim.payment_id : null;
    let piId = pi;
    let acct = account;
    if (!piId || !acct || !paymentId) {
      const p = await readAttemptPayment(admin, a);
      paymentId = p?.id ?? null;
      piId = p?.stripe_payment_intent_id ?? null;
      acct = p?.stripe_account_id ?? null;
    }
    if (!stripe || !piId || !acct || !paymentId) return { ok: true, outcome: "confirming", tabId: null };
    const out = await captureAttemptHold(admin, stripe, { attemptId: a.id, paymentId, paymentIntent: piId, account: acct });
    if (out === "declined") return confirmRefusal("capture_failed");
    if (out === "confirming") return { ok: true, outcome: "confirming", tabId: null };
    const now = await readAttemptById(admin, a.id);
    return { ok: true, outcome: "verified", tabId: now?.tab_id ?? null };
  }
  const closed = await rpc(admin, "pay_guest_close", { p_attempt_id: a.id });
  if (closed.ok !== true) return confirmRefusal(String(closed.code ?? "already_final"));
  log({ attempt_id: a.id, from: "charging", to: "closed", reason: a.tender === "cash" ? "cash_received" : "credits_spent", source: "ef" });
  return { ok: true, outcome: closed.outcome === "already" ? "already_verified" : "verified", tabId: (closed.tab_id as string | null) ?? null };
}

// ── The guest's poll: a hold landing ───────────────────────────────────────

/** A card attempt still placing its hold: read its PaymentIntent. Held →
 *  live. A refusal (or a canceled PaymentIntent) ends it. Never throws for
 *  Stripe: the poll must still answer. */
export async function pollPlacingHold(
  admin: SupabaseClient,
  stripe: StripeCall,
  a: AttemptRow,
  p: PaymentRow | null,
): Promise<void> {
  if (phaseOf(a) !== "placing_hold" || !p?.stripe_payment_intent_id || !p.stripe_account_id) return;
  try {
    const pi = await stripe("GET", `payment_intents/${encodeURIComponent(p.stripe_payment_intent_id)}`, undefined, { stripeAccount: p.stripe_account_id });
    if (pi.status === "requires_capture") {
      await rpc(admin, "pay_guest_mark_held", { p_attempt_id: a.id });
    } else if (pi.status === STRIPE_CANCELED) {
      await endAttempt(admin, stripe, a.id, "cancelled", { source: "poll" });
    }
  } catch (err) {
    console.error("[guest-pay] poll_failed", JSON.stringify({ attempt_id: a.id, error: String(err).slice(0, 200) }));
  }
}

// ── The sweep (settle-wallet cron, every 5 minutes) ────────────────────────

type SweepRow = {
  attempt_id: string;
  phase: Phase;
  tender: string;
  ending_reason: EndReason | null;
  charging_at: string | null;
  payment_id: string | null;
  payment_intent: string | null;
  stripe_account_id: string | null;
  payment_status: string | null;
  needs_review_at: string | null;
};

export type SweepReport = { looked: number; released: number; closed: number; pending: number; review: number; errors: number };

/** Ends every attempt past its window, finishes stuck claims and retries
 *  confirmed card captures. Never releases while money may still move. */
export async function sweepGuestAttempts(admin: SupabaseClient, stripe: StripeCall | null, nowMs = Date.now()): Promise<SweepReport> {
  const report: SweepReport = { looked: 0, released: 0, closed: 0, pending: 0, review: 0, errors: 0 };
  const { data, error } = await admin.rpc("pay_guest_sweep_list", { p_limit: GUEST_PAY.sweepBatch });
  if (error) throw new Error(`pay_guest_sweep_list: ${error.message}`);
  const rows = (data ?? []) as SweepRow[];
  report.looked = rows.length;
  for (const r of rows) {
    try {
      if (r.phase === "charging") {
        if (r.tender === "card" && stripe && r.payment_intent && r.stripe_account_id && r.payment_id) {
          const out = await captureAttemptHold(admin, stripe, {
            attemptId: r.attempt_id,
            paymentId: r.payment_id,
            paymentIntent: r.payment_intent,
            account: r.stripe_account_id,
          });
          if (out === "paid") report.closed++;
          else if (out === "declined") report.released++;
          else report.pending++;
        } else {
          // Cash or credits confirmed but not closed (a dropped request).
          const closed = await rpc(admin, "pay_guest_close", { p_attempt_id: r.attempt_id });
          if (closed.ok === true) report.closed++;
          else report.pending++;
        }
        if (r.charging_at && nowMs - Date.parse(r.charging_at) >= GUEST_PAY.reviewCapMs && !r.needs_review_at) {
          await admin.rpc("pay_guest_mark_review", { p_attempt_id: r.attempt_id });
          report.review++;
          console.error("[guest-pay] needs_review", JSON.stringify({ attempt_id: r.attempt_id, pi_id: r.payment_intent }));
        } else if (r.charging_at && nowMs - Date.parse(r.charging_at) >= GUEST_PAY.chargingAlertMs) {
          console.error("[guest-pay] charging_long", JSON.stringify({ attempt_id: r.attempt_id, pi_id: r.payment_intent }));
        }
        continue;
      }
      const reason: EndReason = r.ending_reason ?? (r.phase === "placing_hold" ? "cancelled" : "expired");
      const out = await endAttempt(admin, stripe, r.attempt_id, reason, { source: "sweep" });
      if (out.ok) report.released++;
      else if (out.code === "already_final") report.closed++;
      else report.pending++;
    } catch (err) {
      report.errors++;
      console.error("[guest-pay] sweep_row", JSON.stringify({ attempt_id: r.attempt_id, error: String(err).slice(0, 200) }));
    }
  }
  if (report.looked > 0) log({ source: "sweep", ...report });
  return report;
}
