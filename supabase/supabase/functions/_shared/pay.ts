// Paying from credit (MESITA-3304, W2a): the four doors' rules in one place.
//
//   consumer-web-start-payment  readPayBody → startPayment (wallet_pay_credit)
//   consumer-web-get-payment    readPayment → paymentView
//   visit-web-get-proof         readProof   → proofView
//   visit-web-mark-proof-seen   markProofSeen
//
// The money move is the RPC: it locks the (guest, place) pair, replays a
// request_id, refuses more than spendable and writes the payment and its
// spend entry together. This module validates what reaches it and shapes
// what leaves. No Stripe here: the card part is W2b.
//
// The retry contract the Pay page keeps: the same request_id on any answer
// without a money code (a network failure, a 5xx: the first call may have
// committed, and a replay answers already_paid); a fresh one after an answer
// with a code, and whenever the amount or the place changes. `taken` means
// the money already moved under that id: the page shows that payment's proof.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { MAX_PAYMENT_INPUT_CENTS, OUTSIDE_CASHBACK_BPS, OUTSIDE_MAX_PER_DAY } from "./money.ts";
import type { MoneyCode } from "./money-codes.ts";
import { withVouchersUpTo } from "./payments.ts";
import { isUuid } from "./place-id.ts";
import { mintProofToken, proofUrl } from "./proof.ts";
import { readVoucherPlace } from "./wallet.ts";

export type PayInput = { placeId: string; amountCents: number; requestId: string; ticket: string | null };

/** A refusal the door answers as-is: its status, a money code when it has
 *  one, the sentence a person reads, and any detail the client needs. */
export type PayRefusal = { ok: false; status: number; code?: MoneyCode; error: string; detail?: Record<string, unknown> };

const TICKET_MAX = 32;
// deno-lint-ignore no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/;

function refuse(status: number, error: string, code?: MoneyCode, detail?: Record<string, unknown>): PayRefusal {
  return { ok: false, status, error, ...(code ? { code } : {}), ...(detail ? { detail } : {}) };
}

/** The start body, checked before anything is read. A 400 without a code is
 *  a malformed call; amount_required and above_cap are things a person can
 *  fix, so they carry codes. */
export function readPayBody(b: Record<string, unknown>): { ok: true; input: PayInput } | PayRefusal {
  if (!isUuid(b.place_id)) return refuse(400, "place_id must be a Mesita place id");
  if (!isUuid(b.request_id)) return refuse(400, "request_id must be a uuid");

  const a = b.amount_cents;
  if (a === undefined || a === null || a === 0) return refuse(400, "Type an amount to pay", "amount_required");
  if (typeof a !== "number" || !Number.isInteger(a)) return refuse(400, "amount_cents must be a whole number of centavos");
  if (a < 0) return refuse(400, "Type an amount to pay", "amount_required");
  if (a > MAX_PAYMENT_INPUT_CENTS) {
    return refuse(400, "That is more than one payment can be", "above_cap", { cap_cents: MAX_PAYMENT_INPUT_CENTS });
  }

  let ticket: string | null = null;
  if (b.ticket !== undefined && b.ticket !== null) {
    if (typeof b.ticket !== "string") return refuse(400, "ticket must be text");
    const t = b.ticket.trim();
    if (t.length > TICKET_MAX) return refuse(400, `A ticket number is at most ${TICKET_MAX} characters`);
    if (CONTROL.test(t)) return refuse(400, "A ticket number cannot hold control characters");
    ticket = t === "" ? null : t;
  }
  return { ok: true, input: { placeId: b.place_id, amountCents: a, requestId: b.request_id, ticket } };
}

/** The card part of the body (MESITA-3305): `card_cents` (0 or absent is a
 *  credit-only payment), `tip_cents` by card only, and `return_url`, a
 *  Mesita address, needed whenever there is a card part. The card part
 *  never exceeds the bill. The caller checks the address. */
export function readCardPart(
  b: Record<string, unknown>,
  amountCents: number,
): { ok: true; cardCents: number; tipCents: number; returnUrl: string | null } | PayRefusal {
  const c = b.card_cents;
  const cardCents = c === undefined || c === null ? 0 : c;
  if (typeof cardCents !== "number" || !Number.isInteger(cardCents) || cardCents < 0) {
    return refuse(400, "card_cents must be a whole number of centavos");
  }
  if (cardCents > amountCents) return refuse(400, "card_cents cannot exceed amount_cents");
  const t = b.tip_cents;
  const tipCents = t === undefined || t === null ? 0 : t;
  if (typeof tipCents !== "number" || !Number.isInteger(tipCents) || tipCents < 0) {
    return refuse(400, "tip_cents must be a whole number of centavos");
  }
  if (tipCents > MAX_PAYMENT_INPUT_CENTS) return refuse(400, "That is more than one tip can be", "above_cap", { cap_cents: MAX_PAYMENT_INPUT_CENTS });
  if (cardCents === 0 && tipCents > 0) return refuse(400, "A tip goes with a card part");
  const returnUrl = typeof b.return_url === "string" ? b.return_url : null;
  if (cardCents > 0 && !returnUrl) return refuse(400, "return_url is needed with a card part");
  return { ok: true, cardCents, tipCents, returnUrl };
}

/** "$170MX" or "$170.50MX" (MX after the amount, MESITA-3491): the one sentence the server writes with money in it. */
export function moneyText(cents: number, currency: string): string {
  const whole = cents % 100 === 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    }).format(cents / 100).replace(/^(-?)MX\$(.*)$/, "$1$$$2MX");
  } catch {
    return `${(cents / 100).toFixed(whole ? 0 : 2)} ${currency.toUpperCase()}`;
  }
}

type RpcAnswer =
  | {
    ok: true;
    outcome: "paid" | "already_paid";
    payment_id: string;
    status: string;
    credit_cents: number;
    currency: string;
    paid_at: string;
    proof_token: string | null;
  }
  | { ok: false; code: "insufficient"; spendable_cents: number }
  | { ok: false; code: "taken"; payment_id: string | null }
  | { ok: false; code: "amount_required" };

export type StartedPayment = {
  payment_id: string;
  status: string;
  outcome: "paid" | "already_paid";
  amount_cents: number;
  credit_cents: number;
  currency: string;
  paid_at: string;
  proof: { token: string; url: string } | null;
  test_mode: boolean;
};

type Rpc = Pick<SupabaseClient, "rpc">;

/** The one money move. A thrown error (the RPC failed to run) is the door's
 *  5xx; every answer the RPC gives is mapped here. */
export async function startPayment(
  admin: Rpc,
  args: { consumerId: string; input: PayInput; currency: string; livemode: boolean; token?: string },
): Promise<{ ok: true; payment: StartedPayment } | PayRefusal> {
  const { data, error } = await admin.rpc("wallet_pay_credit", {
    p_consumer_id: args.consumerId,
    p_place_id: args.input.placeId,
    p_amount_cents: args.input.amountCents,
    p_currency: args.currency,
    p_livemode: args.livemode,
    p_request_id: args.input.requestId,
    p_proof_token: args.token ?? mintProofToken(),
    p_ticket: args.input.ticket,
  });
  if (error) throw new Error(`wallet_pay_credit: ${error.message}`);
  const r = data as RpcAnswer | null;
  if (!r) throw new Error("wallet_pay_credit: no answer");

  if (r.ok) {
    return {
      ok: true,
      payment: {
        payment_id: r.payment_id,
        status: r.status,
        outcome: r.outcome,
        amount_cents: args.input.amountCents,
        credit_cents: r.credit_cents,
        currency: r.currency,
        paid_at: r.paid_at,
        proof: r.proof_token ? { token: r.proof_token, url: proofUrl(r.proof_token) } : null,
        test_mode: !args.livemode,
      },
    };
  }
  switch (r.code) {
    case "insufficient":
      return refuse(409, `You have ${moneyText(r.spendable_cents, args.currency)} of credit here`, "insufficient", {
        spendable_cents: r.spendable_cents,
      });
    case "taken":
      return refuse(409, "This payment already went through", "taken", { payment_id: r.payment_id });
    case "amount_required":
      return refuse(400, "Type an amount to pay", "amount_required");
    default:
      throw new Error(`wallet_pay_credit: unknown answer ${JSON.stringify(r)}`);
  }
}

// ── Paying outside (MESITA-3545) ─────────────────────────────────────────────

/** How long an outside bill waits for the waiter's Received: its own 30
 *  minutes, not the charge's 10, so a slow cash handover still earns. */
export const OUTSIDE_TTL_SEC = 30 * 60;

/** The outside split of a bill: credit first (what the guest can spend
 *  here), the rest outside. Credit covering the whole bill leaves nothing to
 *  pay outside: credit_covers. */
export function outsideSplit(billCents: number, spendableCents: number): { credit: number; outside: number } | null {
  const credit = Math.min(Math.max(spendableCents, 0), billCents);
  const outside = billCents - credit;
  return outside > 0 ? { credit, outside } : null;
}

export type StartedOutside = {
  payment_id: string;
  status: "open" | "paid";
  outcome: "opened" | "in_progress" | "already_paid";
  amount_cents: number;
  credit_cents: number;
  outside_cents: number;
  tip_cents: number;
  outside_cashback_bps: number;
  currency: string;
  expires_at: string | null;
  test_mode: boolean;
};

/** Opens a bill paid outside Mesita: the credit part held, the rest waiting
 *  for the waiter's Received (wallet_open_outside). The server decides the
 *  split; the guest only says "paying outside". */
export async function startOutsidePayment(
  admin: Rpc,
  args: {
    consumerId: string;
    placeId: string;
    billCents: number;
    tipCents: number;
    ticket: string | null;
    requestId: string;
    currency: string;
    livemode: boolean;
    cashbackOn: boolean;
    nowMs: number;
  },
): Promise<{ ok: true; started: StartedOutside } | PayRefusal> {
  const bps = args.cashbackOn ? OUTSIDE_CASHBACK_BPS : 0;
  const expiresAt = new Date(args.nowMs + OUTSIDE_TTL_SEC * 1000).toISOString();
  // The split is the SQL's, under the pair lock: credit = least(spendable, bill).
  const { data, error } = await admin.rpc("wallet_open_outside_capped", {
    p_consumer_id: args.consumerId,
    p_place_id: args.placeId,
    p_bill_cents: args.billCents,
    p_tip_cents: args.tipCents,
    p_currency: args.currency,
    p_livemode: args.livemode,
    p_request_id: args.requestId,
    p_proof_token: mintProofToken(),
    p_ticket: args.ticket,
    p_outside_cashback_bps: bps,
    p_expires_at: expiresAt,
    p_max_per_day: OUTSIDE_MAX_PER_DAY,
  });
  if (error) throw new Error(`wallet_open_outside_capped: ${error.message}`);
  const r = (data ?? null) as Record<string, unknown> | null;
  if (!r) throw new Error("wallet_open_outside_capped: no answer");
  if (r.ok === true) {
    const outcome = r.outcome as StartedOutside["outcome"];
    const credit = Number(r.credit_cents ?? 0);
    const outside = Number(r.outside_cents ?? 0);
    return {
      ok: true,
      started: {
        payment_id: String(r.payment_id),
        status: outcome === "already_paid" ? "paid" : "open",
        outcome,
        amount_cents: credit + outside,
        credit_cents: credit,
        outside_cents: outside,
        tip_cents: Number(r.tip_cents ?? args.tipCents),
        outside_cashback_bps: bps,
        currency: args.currency,
        expires_at: typeof r.expires_at === "string" ? r.expires_at : null,
        test_mode: !args.livemode,
      },
    };
  }
  switch (r.code) {
    case "credit_covers":
      return refuse(409, "Your credit here covers this bill. Pay it from credit.", "credit_covers", {
        spendable_cents: r.spendable_cents,
        bill_cents: r.bill_cents,
      });
    case "outside_limit":
      return refuse(409, "You have paid the waiter here enough times today. Pay on Mesita instead.", "outside_limit", {
        max_per_day: r.max_per_day,
      });
    case "closed":
      return refuse(409, "That payment was cancelled. Tap again to start over.", "closed", { payment_id: r.payment_id ?? null });
    case "insufficient":
      return refuse(409, "Your credit changed. Try again.", "insufficient", { spendable_cents: r.spendable_cents });
    case "taken":
      return refuse(409, "This payment already went through", "taken", { payment_id: r.payment_id ?? null });
    case "amount_required":
      return refuse(400, "Type an amount to pay", "amount_required");
    default:
      throw new Error(`wallet_open_outside_capped: unknown answer ${JSON.stringify(r)}`);
  }
}

// ── Reads ────────────────────────────────────────────────────────────────────

export type PaymentRow = {
  id: string;
  place_id: string;
  status: string;
  amount_cents: number;
  credit_cents: number;
  /** The card part and the tip (MESITA-3305); 0 on a credit-only payment. */
  card_cents: number;
  tip_cents: number;
  /** The part paid outside Mesita, confirmed by the waiter (MESITA-3545). */
  outside_cents?: number;
  cashback_cents: number;
  currency: string;
  /** Null while a card part's Checkout is still open. */
  paid_at: string | null;
  proof_token: string | null;
  proof_seen_at: string | null;
  ticket: string | null;
  /** Card + tip refunded so far (Stripe's cumulative amount_refunded, capped). */
  refunded_cents: number;
  livemode: boolean;
  stripe_checkout_session_id: string | null;
  stripe_account_id: string | null;
  created_at: string;
  expires_at: string | null;
};

const PAYMENT_COLUMNS =
  "id, place_id, status, amount_cents, credit_cents, card_cents, tip_cents, outside_cents, cashback_cents, currency, paid_at, " +
  "proof_token, proof_seen_at, ticket, refunded_cents, livemode, stripe_checkout_session_id, stripe_account_id, created_at, expires_at";

/** The place's two marks beside its name (MESITA-3321): the Premier tier
 *  (red) and the Mesita Pay mark (green). */
export type PlaceMarksView = { tier: number | null; mesita_pay: boolean };

/** What the guest's Pay page shows for one of their payments: the proof
 *  (once paid), the seen stamp, the status as it stands (a refund reads
 *  Refunded; an open card part reads open), the ticket the guest typed and
 *  how much was refunded (MESITA-3539). `marks` rides on the place when the
 *  caller read them. */
export function paymentView(row: PaymentRow, placeName: string | null, marks?: PlaceMarksView | null) {
  return {
    payment_id: row.id,
    place: { id: row.place_id, name: placeName, ...(marks ? { marks } : {}) },
    status: row.status,
    amount_cents: row.amount_cents,
    credit_cents: row.credit_cents,
    card_cents: row.card_cents,
    tip_cents: row.tip_cents,
    outside_cents: row.outside_cents ?? 0,
    cashback_cents: row.cashback_cents,
    currency: row.currency,
    paid_at: row.paid_at,
    expires_at: row.expires_at ?? null,
    proof_seen_at: row.proof_seen_at,
    proof: row.proof_token && row.paid_at ? { token: row.proof_token, url: proofUrl(row.proof_token) } : null,
    ticket: row.ticket,
    refunded_cents: row.refunded_cents ?? 0,
    test_mode: !row.livemode,
  };
}

/** The place's marks for the proof: its Premier tier (profiles.boost_tier,
 *  read with the name, as the Pay list reads it) and moneyState's Mesita Pay
 *  mark. A failed switch read answers no green mark; the proof still shows. */
export async function readPlaceMarks(admin: SupabaseClient, placeId: string, tier: number | null): Promise<PlaceMarksView> {
  try {
    const money = await withVouchersUpTo(admin, [{ id: placeId }]);
    return { tier, mesita_pay: money[0]?.mesita_pay ?? false };
  } catch (err) {
    console.error("[pay] marks_read_failed", JSON.stringify({ place_id: placeId, error: String(err) }));
    return { tier, mesita_pay: false };
  }
}

/** The guest's own payment in any state, or null when it is not theirs:
 *  the door answers 404 gone. An open card part is read so the Pay page
 *  can settle it or resume its Checkout (MESITA-3305). */
export async function readPayment(
  admin: SupabaseClient,
  consumerId: string,
  paymentId: string,
): Promise<{ ok: true; row: PaymentRow | null; placeName: string | null; placeTier?: number | null } | { ok: false; error: string }> {
  const { data, error } = await admin
    .from("wallet_payments")
    .select(PAYMENT_COLUMNS)
    .eq("id", paymentId)
    .eq("consumer_id", consumerId)
    .maybeSingle();
  if (error) return { ok: false, error: `payment: ${error.message}` };
  const row = (data as PaymentRow | null) ?? null;
  if (!row) return { ok: true, row: null, placeName: null };
  const place = await readVoucherPlace(admin, row.place_id);
  if (!place.ok) return { ok: false, error: place.error };
  return { ok: true, row, placeName: place.place?.name ?? null, placeTier: place.place?.boost_tier ?? null };
}

/** The staff page's read: what Mesita received, nothing about who paid. */
export function proofView(row: PaymentRow, placeName: string | null, nowIso: string) {
  return {
    place: { name: placeName },
    amount_cents: row.amount_cents,
    currency: row.currency,
    paid_at: row.paid_at,
    status: row.status,
    seen_at: row.proof_seen_at,
    server_time: nowIso,
    test_mode: !row.livemode,
    ticket: row.ticket,
  };
}

/** The paid payment a proof token names, or null (unknown, or a W2b row not
 *  paid yet). */
export async function readProof(
  admin: SupabaseClient,
  token: string,
): Promise<{ ok: true; row: PaymentRow | null; placeName: string | null } | { ok: false; error: string }> {
  const { data, error } = await admin
    .from("wallet_payments")
    .select(PAYMENT_COLUMNS)
    .eq("proof_token", token)
    .not("paid_at", "is", null)
    .maybeSingle();
  if (error) return { ok: false, error: `proof: ${error.message}` };
  const row = (data as PaymentRow | null) ?? null;
  if (!row) return { ok: true, row: null, placeName: null };
  const place = await readVoucherPlace(admin, row.place_id);
  if (!place.ok) return { ok: false, error: place.error };
  return { ok: true, row, placeName: place.place?.name ?? null };
}

/** Stamps the proof seen once and answers the stamp, whether this tap or an
 *  earlier one set it; null when no paid payment carries the token. The
 *  update only ever moves the stamp from null to a time, so reading it back
 *  after a no-op update is stable. */
export async function markProofSeen(
  admin: SupabaseClient,
  token: string,
  nowIso: string,
): Promise<{ ok: true; seenAt: string | null; paymentId: string | null } | { ok: false; error: string }> {
  const { data: stamped, error: updErr } = await admin
    .from("wallet_payments")
    .update({ proof_seen_at: nowIso })
    .eq("proof_token", token)
    .is("proof_seen_at", null)
    .not("paid_at", "is", null)
    .select("id, proof_seen_at");
  if (updErr) return { ok: false, error: `seen: ${updErr.message}` };
  const first = (stamped as Array<{ id: string; proof_seen_at: string }> | null)?.[0];
  if (first) return { ok: true, seenAt: first.proof_seen_at, paymentId: first.id };

  const { data, error } = await admin
    .from("wallet_payments")
    .select("id, proof_seen_at")
    .eq("proof_token", token)
    .not("paid_at", "is", null)
    .maybeSingle();
  if (error) return { ok: false, error: `seen_read: ${error.message}` };
  const row = data as { id: string; proof_seen_at: string | null } | null;
  return { ok: true, seenAt: row?.proof_seen_at ?? null, paymentId: row?.id ?? null };
}
