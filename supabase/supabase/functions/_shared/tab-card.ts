// Pay at the table T2b (MESITA-3563): the card part, paid inside the app.
//
// The guest's card lives on Mesita's platform customer (saved cards,
// MESITA-3523), in the PAYMENTS mode (PAYMENTS_STRIPE_MODE), never the
// Premier one. Each card part:
//
//   1. checks the card is on the caller's own customer (an id from the
//      browser is never trusted);
//   2. pay_tab_open_parts opens ONE `opening` card row: the credit (held),
//      the card bill part and the card tip;
//   3. clones the card to the place's connected account (a direct charge
//      needs the card there; proven by the T0 spike, MESITA-3571);
//   4. creates the PaymentIntent there UNCONFIRMED (card only, no
//      application fee: Mesita's 5% of the card bill part is invoiced,
//      MESITA-3461), and stores it on the row (wallet_open_payment_pi), so
//      a PI that later succeeds always has a row that names it;
//   5. confirms it with use_stripe_sdk: succeeded settles at once;
//      requires_action hands Stripe.js the client_secret and the account;
//      a decline cancels it and releases the row (the tab is billed again).
//
// Every Stripe call carries an Idempotency-Key named after the card row, so
// a double tap (same request id → the same row) makes one clone, one PI and
// one confirm. One row is one attempt: a new tap after a failure is a new
// request id and a new row.
//
// Settlement afterwards is T2a's (MESITA-3568): the receiver
// (payment_intent.* on the Connect endpoint), the cron (PI_TTL_MS, then
// cancel-then-release) and the guest's poll (pollTabCard) all call the same
// replay-safe RPCs.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { MIN_CHARGE_CENTS } from "./money.ts";
import { moneyState } from "./money-state.ts";
import { type AccountRow, type PaymentSettings } from "./payments.ts";
import { cardRefusal } from "./pay-card.ts";
import { PI_TTL_MS, releasePayment, settleByPaymentIntent, settlePaidPayment } from "./settle-payment.ts";
import { refuse, type TabRefusal } from "./tab.ts";
import { type StripeCall, StripeError } from "./stripe.ts";

export function isPaymentMethodId(v: unknown): v is string {
  return typeof v === "string" && /^pm_[A-Za-z0-9]{8,64}$/.test(v);
}

/** Whether card parts can be paid at this place now, and what the card bill
 *  part earns (the place's own Mesita Payments Cashback, MESITA-3589). Pure. */
export function tabCardRates(args: {
  account: AccountRow | null;
  settings: PaymentSettings;
  livemode: boolean;
  currency: string;
  stripeReady: boolean;
}): { card_available: boolean; card_unavailable_code: string | null; card_back_bps: number; card_minimum_cents: number } {
  const min = MIN_CHARGE_CENTS[args.currency] ?? 0;
  const gate = cardRefusal({
    account: args.account,
    settings: args.settings,
    livemode: args.livemode,
    currency: args.currency,
    cardCents: Math.max(min, 1),
    tipCents: 0,
  });
  const available = args.stripeReady && !gate;
  const cardBack = moneyState(args.settings, { charges_enabled: true }, null).card_cashback_bps;
  return {
    card_available: available,
    card_unavailable_code: available ? null : (gate?.code ?? "not_configured"),
    card_back_bps: available ? cardBack : 0,
    card_minimum_cents: min,
  };
}

/** The card the guest chose is on their own platform customer. */
export async function ownCard(stripe: StripeCall, customer: string | null, pmId: string): Promise<boolean> {
  if (!customer) return false;
  try {
    const pm = await stripe("GET", `payment_methods/${encodeURIComponent(pmId)}`);
    const owner = typeof pm.customer === "string" ? pm.customer : (pm.customer as { id?: string } | null)?.id ?? null;
    return owner === customer && pm.type === "card";
  } catch (err) {
    if (err instanceof StripeError && (err.code === "resource_missing" || err.httpStatus === 404)) return false;
    throw err;
  }
}

/** What the guest's screen does next with a card part. */
export type CardStep =
  | { status: "succeeded"; payment_intent_id: string }
  // MESITA-3856: held for the waiter; captured when they sign.
  | { status: "held"; payment_intent_id: string }
  | { status: "processing"; payment_intent_id: string }
  | {
    status: "requires_action";
    payment_intent_id: string;
    client_secret: string;
    stripe_account: string;
    publishable_key: string;
  };

type Rpc = Pick<SupabaseClient, "rpc">;

export type CardRow = {
  id: string;
  status: string;
  stripe_account_id: string | null;
  stripe_payment_intent_id: string | null;
  card_cents: number;
  tip_cents: number;
  created_at: string;
  held_at?: string | null;
};

const CARD_ROW_COLUMNS = "id, status, stripe_account_id, stripe_payment_intent_id, card_cents, tip_cents, created_at, held_at";

export async function readCardRow(admin: SupabaseClient, paymentId: string): Promise<CardRow | null> {
  const { data, error } = await admin.from("wallet_payments").select(CARD_ROW_COLUMNS).eq("id", paymentId).maybeSingle();
  if (error) throw new Error(`card_row_read: ${error.message}`);
  return (data as CardRow | null) ?? null;
}

function stripeCode(err: unknown): string {
  if (err instanceof StripeError) return (err.code || err.type || "stripe_error").slice(0, 64);
  return "stripe_unreachable";
}

async function cancelQuietly(stripe: StripeCall, account: string, piId: string, paymentId: string): Promise<void> {
  try {
    await stripe("POST", `payment_intents/${encodeURIComponent(piId)}/cancel`, {}, {
      stripeAccount: account,
      idempotencyKey: `tabcard-cancel:${paymentId}:${piId}`,
    });
  } catch (err) {
    console.error("[tab-card] cancel_failed", JSON.stringify({ payment_id: paymentId, code: stripeCode(err) }));
  }
}

/** A PaymentIntent's state as the guest's next step. Settles a succeeded
 *  one, releases one that can no longer pay (the trigger bills the tab
 *  again). */
async function stepOf(
  admin: Rpc,
  stripe: StripeCall,
  row: { id: string; account: string },
  pi: Record<string, unknown>,
  publishableKey: string | null,
): Promise<{ ok: true; step: CardStep } | TabRefusal> {
  const piId = String(pi.id);
  switch (pi.status) {
    case "succeeded":
      await settlePaidPayment(admin, row.id, piId);
      return { ok: true, step: { status: "succeeded", payment_intent_id: piId } };
    case "processing":
      return { ok: true, step: { status: "processing", payment_intent_id: piId } };
    case "requires_capture": {
      // MESITA-3856: the bank held it; the bill's ten minutes start now.
      const { data, error } = await admin.rpc("wallet_card_held", { p_payment_id: row.id });
      if (error) throw new Error(`wallet_card_held: ${error.message}`);
      if ((data as { decision?: string } | null)?.decision === "cancel") {
        await cancelQuietly(stripe, row.account, piId, row.id);
        await releasePayment(admin, row.id, "failed", "hold_late");
        return refuse(409, "closed", "That payment was cancelled. Tap again to start over.");
      }
      return { ok: true, step: { status: "held", payment_intent_id: piId } };
    }
    case "requires_action":
    case "requires_confirmation": {
      const secret = typeof pi.client_secret === "string" ? pi.client_secret : null;
      if (!publishableKey || !secret) {
        // The bank asks for a check the app cannot show yet: nothing was
        // charged; the guest chooses again.
        await cancelQuietly(stripe, row.account, piId, row.id);
        await releasePayment(admin, row.id, "failed", "needs_auth_unavailable");
        return refuse(409, "card_needs_auth", "This card needs a bank check we can't show yet. Choose another way to pay.");
      }
      return {
        ok: true,
        step: { status: "requires_action", payment_intent_id: piId, client_secret: secret, stripe_account: row.account, publishable_key: publishableKey },
      };
    }
    case "canceled":
      await releasePayment(admin, row.id, "failed", "pi_canceled");
      return refuse(409, "card_declined", "The card payment was cancelled. Choose again.");
    default: {
      // requires_payment_method: declined (or a failed 3-D Secure).
      const last = (pi.last_payment_error ?? {}) as Record<string, unknown>;
      const decline = String(last.decline_code ?? last.code ?? "declined").slice(0, 64);
      await cancelQuietly(stripe, row.account, piId, row.id);
      await releasePayment(admin, row.id, "failed", decline);
      return refuse(409, "card_declined", "Your card was declined. Try another card or another way to pay.", { decline_code: decline });
    }
  }
}

/** Steps 3–5 for a card row pay_tab_open_parts opened (or the same tap's
 *  row again). A thrown error is the door's 5xx: the row stays `opening`
 *  (no PI) and the cron fails it after ten minutes, or `open` (a PI) and
 *  the cron reads it. */
export async function runTabCard(
  admin: SupabaseClient,
  stripe: StripeCall,
  args: {
    paymentId: string;
    customer: string;
    platformPm: string;
    currency: string;
    placeId: string;
    placeName: string | null;
    consumerId: string;
    tabId: string;
    publishableKey: string | null;
    /** MESITA-3856: a guest tab's card is held (manual capture) until the waiter signs. */
    hold?: boolean;
  },
): Promise<{ ok: true; step: CardStep } | TabRefusal> {
  const row = await readCardRow(admin, args.paymentId);
  if (!row || !row.stripe_account_id) throw new Error("card_row_missing");
  const account = row.stripe_account_id;
  const ref = { id: row.id, account };

  if (row.stripe_payment_intent_id) {
    // The same tap again: read where its PI stands.
    if (row.status !== "open") {
      return row.status === "paid"
        ? { ok: true, step: { status: "succeeded", payment_intent_id: row.stripe_payment_intent_id } }
        : refuse(409, "closed", "That payment was cancelled. Tap again to start over.");
    }
    const pi = await stripe("GET", `payment_intents/${encodeURIComponent(row.stripe_payment_intent_id)}`, undefined, { stripeAccount: account });
    return await stepOf(admin, stripe, ref, pi, args.publishableKey);
  }
  if (row.status !== "opening") return refuse(409, "closed", "That payment was cancelled. Tap again to start over.");

  let pi: Record<string, unknown>;
  try {
    const cloned = await stripe("POST", "payment_methods", { customer: args.customer, payment_method: args.platformPm }, {
      stripeAccount: account,
      idempotencyKey: `tabcard-clone:${row.id}`,
    });
    const metadata = {
      mesita_kind: "wallet_payment",
      payment_id: row.id,
      place_id: args.placeId,
      consumer_id: args.consumerId,
      tab_id: args.tabId,
      card_cents: String(row.card_cents),
      tip_cents: String(row.tip_cents),
    };
    pi = await stripe("POST", "payment_intents", {
      amount: row.card_cents + row.tip_cents,
      currency: args.currency,
      payment_method: String(cloned.id),
      payment_method_types: ["card"],
      ...(args.hold ? { capture_method: "manual" } : {}),
      description: `Mesita · ${(args.placeName ?? "place").slice(0, 200)}`,
      metadata,
    }, { stripeAccount: account, idempotencyKey: `tabcard-pi:${row.id}` });
  } catch (err) {
    const code = stripeCode(err);
    console.error("[tab-card] start_failed", JSON.stringify({ payment_id: row.id, code }));
    await releasePayment(admin, row.id, "failed", code);
    return refuse(502, "card_failed", "Couldn't start the card payment. Try again.", { stripe_code: code });
  }
  const piId = String(pi.id);

  const { data: opened, error: openErr } = await admin.rpc("wallet_open_payment_pi", { p_payment_id: row.id, p_payment_intent: piId });
  if (openErr || !(opened as { ok?: boolean } | null)?.ok) {
    // Nobody could settle a PI the row does not name: cancel it, release.
    console.error("[tab-card] pi_write", JSON.stringify({ payment_id: row.id, error: openErr?.message ?? JSON.stringify(opened) }));
    await cancelQuietly(stripe, account, piId, row.id);
    await releasePayment(admin, row.id, "failed", "pi_write");
    return refuse(502, "card_failed", "Couldn't start the card payment. Try again.");
  }

  let confirmed: Record<string, unknown>;
  try {
    confirmed = await stripe("POST", `payment_intents/${encodeURIComponent(piId)}/confirm`, { use_stripe_sdk: true }, {
      stripeAccount: account,
      idempotencyKey: `tabcard-confirm:${row.id}`,
    });
  } catch (err) {
    if (err instanceof StripeError && err.type === "card_error") {
      // A decline: Stripe left the PI requires_payment_method. Read it for
      // the decline code, then cancel and release.
      const after = await stripe("GET", `payment_intents/${encodeURIComponent(piId)}`, undefined, { stripeAccount: account });
      return await stepOf(admin, stripe, ref, { ...after, status: after.status === "succeeded" ? "succeeded" : "requires_payment_method" }, args.publishableKey);
    }
    throw err;
  }
  return await stepOf(admin, stripe, ref, confirmed, args.publishableKey);
}

/** The guest's poll: an open card row's PI as the next step (a 3-D Secure
 *  challenge the guest has not finished, or one that just went through).
 *  Past PI_TTL_MS it is T2a's cancel-then-release. Answers null when there
 *  is nothing to do. Never throws for Stripe: the poll must still answer. */
export async function pollTabCard(
  admin: SupabaseClient,
  stripe: StripeCall,
  row: CardRow,
  publishableKey: string | null,
  nowMs: number,
): Promise<{ step: CardStep | null; refusal: TabRefusal | null }> {
  if (row.status !== "open" || !row.stripe_payment_intent_id || !row.stripe_account_id) return { step: null, refusal: null };
  try {
    // MESITA-3856: a held card lives as long as its bill, not PI_TTL_MS.
    if (row.held_at || nowMs - Date.parse(row.created_at) >= PI_TTL_MS) {
      await settleByPaymentIntent(admin, stripe, {
        id: row.id,
        stripe_checkout_session_id: null,
        stripe_account_id: row.stripe_account_id,
        stripe_payment_intent_id: row.stripe_payment_intent_id,
        created_at: row.created_at,
      }, nowMs);
      return { step: null, refusal: null };
    }
    const pi = await stripe("GET", `payment_intents/${encodeURIComponent(row.stripe_payment_intent_id)}`, undefined, {
      stripeAccount: row.stripe_account_id,
    });
    const r = await stepOf(admin, stripe, { id: row.id, account: row.stripe_account_id }, pi, publishableKey);
    return r.ok ? { step: r.step, refusal: null } : { step: null, refusal: r };
  } catch (err) {
    console.error("[tab-card] poll_failed", JSON.stringify({ payment_id: row.id, code: stripeCode(err) }));
    return { step: null, refusal: null };
  }
}
