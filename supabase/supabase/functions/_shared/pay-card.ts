// The card part of a payment (MESITA-3305, W2b): a guest whose credit is
// short pays the rest by card, plus an optional tip, as ONE Stripe Checkout
// on the place's own connected account. The credit part is held first
// (wallet_hold_payment), the Checkout is a direct charge with NO application
// fee (charge model d5a, MESITA-3461: Mesita's 5% of the card part, never of
// the tip, is stored on the row and billed to the place apart), and the hold becomes a spend when Stripe says paid
// (settle-payment.ts). A refused Checkout releases the hold at once; an
// expired one is released only when Stripe confirms the expiry.
//
//   consumer-web-start-payment    readCardPayBody → startCardPayment
//   consumer-web-release-payment  releaseCardPayment (MESITA-3458)
//
// Refusals, in the order they are checked: no_account (no account that can
// charge in this universe), cards_off (the owner's switch, or Mesita's fee
// invoice unpaid: fee_hold, MESITA-3461), currency_mismatch,
// below_minimum (on card + tip), locked (three refused Checkouts in ten
// minutes), in_progress (a Checkout of this guest at this place is open),
// then the RPC's insufficient and taken.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { type StripeCall, StripeError } from "./boost.ts";
import { bps, CASHBACK_BPS, MESITA_FEE_BPS_PAYMENT, MIN_CHARGE_CENTS } from "./money.ts";
import type { MoneyCode } from "./money-codes.ts";
import { moneyState } from "./money-state.ts";
import { type AccountRow, type PaymentSettings } from "./payments.ts";
import type { PayInput, PayRefusal } from "./pay.ts";
import { mintProofToken } from "./proof.ts";
import { accountCurrency } from "./vouchers.ts";
import { releasePayment, settlePayment } from "./settle-payment.ts";
import { WALLET_CHECKOUT_TTL_SEC } from "./wallet.ts";

/** A start with a card part: the bill (credit + card), the card part, the
 *  tip by card, and where Checkout returns to. */
export type CardPayInput = PayInput & { cardCents: number; tipCents: number; returnUrl: string };

/** Three refused Checkouts in this window lock the (guest, place) pair. */
export const CHECKOUT_FAILED_LIMIT = 3;
export const CHECKOUT_FAILED_WINDOW_SEC = 10 * 60;

function refuse(status: number, error: string, code: MoneyCode, detail?: Record<string, unknown>): PayRefusal {
  return { ok: false, status, error, code, ...(detail ? { detail } : {}) };
}

export type CardStart = {
  payment_id: string;
  status: "open";
  url: string;
  expires_at: string;
  amount_cents: number;
  credit_cents: number;
  card_cents: number;
  tip_cents: number;
  currency: string;
  test_mode: boolean;
};

/** Every gate before any money moves. Pure. */
export function cardRefusal(args: {
  account: AccountRow | null;
  settings: PaymentSettings;
  livemode: boolean;
  currency: string;
  cardCents: number;
  tipCents: number;
}): PayRefusal | null {
  const a = args.account;
  if (!a || a.livemode !== args.livemode || !a.charges_enabled) {
    return refuse(409, "This place isn't taking card payments yet", "no_account");
  }
  if (args.settings.pay_cards === false) {
    return refuse(409, "This place isn't taking card payments right now", "cards_off");
  }
  if (a.fee_hold === true) {
    console.log("[pay-card] fee_unpaid_cards_off", JSON.stringify({ place_id: a.place_id }));
    return refuse(409, "This place isn't taking card payments right now", "cards_off");
  }
  const acct = accountCurrency(a);
  if (acct && acct !== args.currency) {
    return refuse(409, "This place's Stripe account does not settle in its currency", "currency_mismatch");
  }
  const min = MIN_CHARGE_CENTS[args.currency] ?? 0;
  if (args.cardCents + args.tipCents < min) {
    return refuse(409, "The card part is below Stripe's minimum charge", "below_minimum", { minimum_cents: min });
  }
  return null;
}

/** The lock rule (rule 13): when the three newest rows of this pair are all
 *  `failed` within the window, the next start waits. Pure: takes the rows
 *  newest first. Answers the seconds left, or 0 when open. */
export function lockedFor(rows: Array<{ status: string; created_at: string }>, nowMs: number): number {
  if (rows.length < CHECKOUT_FAILED_LIMIT) return 0;
  const newest = rows.slice(0, CHECKOUT_FAILED_LIMIT);
  if (!newest.every((r) => r.status === "failed")) return 0;
  const oldest = Math.min(...newest.map((r) => Date.parse(r.created_at)));
  const until = oldest + CHECKOUT_FAILED_WINDOW_SEC * 1000;
  return until > nowMs ? Math.ceil((until - nowMs) / 1000) : 0;
}

/** Stripe Checkout on the connected account for the card part and the tip.
 *  Two line items when there is a tip, so the receipt says what was what;
 *  no application fee (d5a, MESITA-3461): Mesita's fee is billed apart. The ledger
 *  row id rides in metadata and client_reference_id so the receiver finds
 *  it before the session id is stored. */
export function cardCheckoutParams(args: {
  paymentId: string;
  placeId: string;
  consumerId: string;
  email: string | null;
  cardCents: number;
  tipCents: number;
  currency: string;
  placeName: string;
  returnUrl: string;
  nowSec: number;
}): Record<string, unknown> {
  const origin = new URL(args.returnUrl).origin;
  const metadata = {
    mesita_kind: "wallet_payment",
    payment_id: args.paymentId,
    place_id: args.placeId,
    consumer_id: args.consumerId,
    card_cents: String(args.cardCents),
    tip_cents: String(args.tipCents),
  };
  const line_items: Record<string, unknown>[] = [{
    quantity: 1,
    price_data: {
      currency: args.currency,
      unit_amount: args.cardCents,
      product_data: { name: `Payment · ${args.placeName}`.slice(0, 250) },
    },
  }];
  if (args.tipCents > 0) {
    line_items.push({
      quantity: 1,
      price_data: {
        currency: args.currency,
        unit_amount: args.tipCents,
        product_data: { name: `Tip · ${args.placeName}`.slice(0, 250) },
      },
    });
  }
  return {
    mode: "payment",
    client_reference_id: args.paymentId,
    ...(args.email ? { customer_email: args.email } : {}),
    success_url: `${origin}/pay?payment=${args.paymentId}&checkout={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pay?payment=${args.paymentId}&checkout=cancel`,
    expires_at: args.nowSec + WALLET_CHECKOUT_TTL_SEC,
    metadata,
    line_items,
    payment_intent_data: { metadata },
  };
}

type HoldAnswer =
  | { ok: true; outcome: "held"; payment_id: string; expires_at: string }
  | { ok: true; outcome: "in_progress"; payment_id: string; session_id: string | null; expires_at: string | null }
  | {
    ok: true;
    outcome: "already_paid";
    payment_id: string;
    status: string;
    credit_cents: number;
    card_cents: number;
    tip_cents: number;
    currency: string;
    paid_at: string;
    proof_token: string | null;
  }
  | { ok: false; code: "insufficient"; spendable_cents: number }
  | { ok: false; code: "taken"; payment_id: string | null }
  | { ok: false; code: "amount_required" };

export type CardStartResult =
  | { ok: true; kind: "open"; start: CardStart }
  | { ok: true; kind: "already_paid"; payment_id: string }
  | PayRefusal;

/** The start: the gates, the hold, the Checkout, the row's session. A
 *  thrown error is the door's 5xx (the hold, if any, is released by the
 *  cron when its Checkout never appears). */
export async function startCardPayment(
  admin: SupabaseClient,
  stripe: StripeCall,
  args: {
    consumerId: string;
    email: string | null;
    input: CardPayInput;
    place: { id: string; name: string | null; currency: string };
    account: AccountRow | null;
    settings: PaymentSettings;
    livemode: boolean;
    nowMs: number;
  },
): Promise<CardStartResult> {
  const { input } = args;
  const currency = args.place.currency;
  const gate = cardRefusal({
    account: args.account,
    settings: args.settings,
    livemode: args.livemode,
    currency,
    cardCents: input.cardCents,
    tipCents: input.tipCents,
  });
  if (gate) return gate;
  const account = args.account as AccountRow;

  // Rule 13: three refused Checkouts in ten minutes lock the pair.
  const { data: recent, error: recentErr } = await admin
    .from("wallet_payments")
    .select("status, created_at")
    .eq("consumer_id", args.consumerId)
    .eq("place_id", args.place.id)
    .order("created_at", { ascending: false })
    .limit(CHECKOUT_FAILED_LIMIT);
  if (recentErr) throw new Error(`payments_read: ${recentErr.message}`);
  const wait = lockedFor((recent ?? []) as Array<{ status: string; created_at: string }>, args.nowMs);
  if (wait > 0) return refuse(409, "Card payments here are paused for a few minutes", "locked", { retry_after_s: wait });

  // Rule 2: a Checkout of this guest at this place is still open.
  const { data: openRows, error: openErr } = await admin
    .from("wallet_payments")
    .select("id, stripe_checkout_session_id, expires_at, request_id")
    .eq("consumer_id", args.consumerId)
    .eq("place_id", args.place.id)
    .eq("livemode", args.livemode)
    .eq("status", "open")
    .limit(1);
  if (openErr) throw new Error(`payments_open_read: ${openErr.message}`);
  const open = (openRows ?? [])[0] as
    | { id: string; stripe_checkout_session_id: string | null; expires_at: string | null; request_id: string | null }
    | undefined;
  if (open && open.request_id !== input.requestId) return await inProgress(stripe, account, open);

  const cashbackBps = moneyState(args.settings, { charges_enabled: true }, null).cashback ? CASHBACK_BPS : 0;
  const creditCents = input.amountCents - input.cardCents;
  const expiresAt = new Date(args.nowMs + WALLET_CHECKOUT_TTL_SEC * 1000).toISOString();
  const { data, error } = await admin.rpc("wallet_hold_payment", {
    p_consumer_id: args.consumerId,
    p_place_id: args.place.id,
    p_credit_cents: creditCents,
    p_card_cents: input.cardCents,
    p_tip_cents: input.tipCents,
    p_currency: currency,
    p_livemode: args.livemode,
    p_request_id: input.requestId,
    p_proof_token: mintProofToken(),
    p_ticket: input.ticket,
    p_stripe_account_id: account.stripe_account_id,
    p_application_fee_cents: bps(input.cardCents, MESITA_FEE_BPS_PAYMENT),
    p_cashback_bps: cashbackBps,
    p_expires_at: expiresAt,
  });
  if (error) throw new Error(`wallet_hold_payment: ${error.message}`);
  const held = data as HoldAnswer | null;
  if (!held) throw new Error("wallet_hold_payment: no answer");
  if (!held.ok) {
    switch (held.code) {
      case "insufficient":
        return refuse(409, "Not enough credit for the credit part", "insufficient", { spendable_cents: held.spendable_cents });
      case "taken":
        return refuse(409, "This payment already went through", "taken", { payment_id: held.payment_id });
      case "amount_required":
        return refuse(400, "Type an amount to pay", "amount_required");
      default:
        throw new Error(`wallet_hold_payment: unknown answer ${JSON.stringify(held)}`);
    }
  }
  if (held.outcome === "already_paid") return { ok: true, kind: "already_paid", payment_id: held.payment_id };
  if (held.outcome === "in_progress") {
    return await inProgress(stripe, account, {
      id: held.payment_id,
      stripe_checkout_session_id: held.session_id,
      expires_at: held.expires_at,
    });
  }

  const paymentId = held.payment_id;
  let session: Record<string, unknown>;
  try {
    session = await stripe(
      "POST",
      "checkout/sessions",
      cardCheckoutParams({
        paymentId,
        placeId: args.place.id,
        consumerId: args.consumerId,
        email: args.email,
        cardCents: input.cardCents,
        tipCents: input.tipCents,
        currency,
        placeName: String(args.place.name ?? "Mesita place"),
        returnUrl: input.returnUrl,
        nowSec: Math.floor(args.nowMs / 1000),
      }),
      { idempotencyKey: paymentId, stripeAccount: account.stripe_account_id },
    );
  } catch (err) {
    const code = err instanceof StripeError ? err.code || err.type || "stripe_error" : "stripe_unreachable";
    console.error("[pay-card] checkout_failed", JSON.stringify({ payment_id: paymentId, code, message: err instanceof Error ? err.message : String(err) }));
    await admin.rpc("wallet_release_payment", { p_payment_id: paymentId, p_status: "failed", p_error: code });
    return refuse(502, `Stripe refused the checkout: ${code}`, "checkout_failed");
  }

  const sessionId = String(session.id ?? "");
  const url = String(session.url ?? "");
  const { data: opened, error: openRpcErr } = await admin.rpc("wallet_open_payment", { p_payment_id: paymentId, p_session_id: sessionId });
  if (openRpcErr || !(opened as { ok?: boolean } | null)?.ok) {
    // The session exists but the row cannot name it: nobody could settle
    // it, so it is closed on Stripe and the hold released.
    console.error("[pay-card] session_write", JSON.stringify({ payment_id: paymentId, error: openRpcErr?.message ?? "not_opening" }));
    try {
      await stripe("POST", `checkout/sessions/${encodeURIComponent(sessionId)}/expire`, undefined, { stripeAccount: account.stripe_account_id });
    } catch (err) {
      console.error("[pay-card] expire_failed", JSON.stringify({ payment_id: paymentId, error: String(err) }));
    }
    await admin.rpc("wallet_release_payment", { p_payment_id: paymentId, p_status: "failed", p_error: "session_write" });
    return refuse(502, "Couldn't open checkout. Try again.", "checkout_failed");
  }

  return {
    ok: true,
    kind: "open",
    start: {
      payment_id: paymentId,
      status: "open",
      url,
      expires_at: expiresAt,
      amount_cents: input.amountCents,
      credit_cents: creditCents,
      card_cents: input.cardCents,
      tip_cents: input.tipCents,
      currency,
      test_mode: !args.livemode,
    },
  };
}

/** 409 in_progress with the open session's url and expiry, so the guest
 *  resumes it; nothing is expired behind their back (rule 2). A session
 *  Stripe no longer reports open answers the same code with no url, and
 *  the cron closes the row on its next read. */
async function inProgress(
  stripe: StripeCall,
  account: AccountRow,
  row: { id: string; stripe_checkout_session_id: string | null; expires_at: string | null },
): Promise<PayRefusal> {
  let url: string | null = null;
  if (row.stripe_checkout_session_id) {
    try {
      const s = await stripe("GET", `checkout/sessions/${encodeURIComponent(row.stripe_checkout_session_id)}`, undefined, {
        stripeAccount: account.stripe_account_id,
      });
      if (s.status === "open" && typeof s.url === "string") url = s.url;
    } catch (err) {
      console.error("[pay-card] in_progress_read", JSON.stringify({ payment_id: row.id, error: String(err) }));
    }
  }
  return refuse(409, "A card payment here is still open", "in_progress", {
    payment_id: row.id,
    url,
    expires_at: row.expires_at,
  });
}

// ── Back from a cancelled Checkout (MESITA-3458) ────────────────────────────

/** Why a cancelled Checkout's row closes: `expired`, never `failed`, so a
 *  guest who cancels three times is not locked out (rule 13 counts failed). */
export const CANCELLED_ERROR = "cancelled";

/** What a release did: `released` (the session is closed on Stripe and the
 *  hold is gone), `paid` (Stripe had already taken the money: settled
 *  instead), `unchanged` (the row was already closed or paid), `pending`
 *  (Stripe could not close it and still reports it open: nothing changed,
 *  the cron closes it when it expires). */
export type ReleaseOutcome = "released" | "paid" | "unchanged" | "pending";

/** The guest came back from Checkout with `checkout=cancel`: the open
 *  session is expired on the place's account and the hold released, so the
 *  next start is not answered in_progress with the old session and the
 *  credit is spendable again. When the expire is refused (the session
 *  completed or already expired), the session is read and settled as it
 *  says: a paid one is never released. The caller has already checked the
 *  row is this guest's. */
export async function releaseCardPayment(
  admin: Pick<SupabaseClient, "rpc">,
  stripe: StripeCall,
  row: {
    id: string;
    status: string;
    stripe_checkout_session_id: string | null;
    stripe_account_id: string | null;
    created_at: string;
    expires_at: string | null;
  },
  nowMs: number,
): Promise<ReleaseOutcome> {
  if (row.status !== "open" && row.status !== "opening") return "unchanged";
  const sessionId = row.stripe_checkout_session_id;
  const account = row.stripe_account_id;
  if (!sessionId || !account) {
    // No session yet: nothing on Stripe can take money for this row. A
    // start still in flight finds the row closed and expires its session.
    await releasePayment(admin, row.id, "expired", CANCELLED_ERROR);
    return "released";
  }
  try {
    const s = await stripe("POST", `checkout/sessions/${encodeURIComponent(sessionId)}/expire`, undefined, { stripeAccount: account });
    if (s.status === "expired") {
      await releasePayment(admin, row.id, "expired", CANCELLED_ERROR);
      return "released";
    }
  } catch (err) {
    // Stripe refuses to expire a session that is no longer open.
    console.log("[pay-card] expire_refused", JSON.stringify({ payment_id: row.id, error: err instanceof Error ? err.message : String(err) }));
  }
  const outcome = await settlePayment(admin, stripe, {
    id: row.id,
    stripe_checkout_session_id: sessionId,
    stripe_account_id: account,
    created_at: row.created_at,
    expires_at: row.expires_at,
  }, nowMs);
  if (outcome === "paid" || outcome === "already_paid" || outcome === "late_completion") return "paid";
  if (outcome === "expired") return "released";
  return "pending";
}
