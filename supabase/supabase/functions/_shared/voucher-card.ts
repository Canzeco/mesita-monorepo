// Buying a voucher with a saved card, in one tap (MESITA-3552).
//
// The guest's card lives on Mesita's platform customer in the PAYMENTS mode
// (saved cards, MESITA-3523/3573). A voucher is a direct charge on the
// place's connected account (no application fee, MESITA-3461), so the card
// is copied there first. The machinery is the bill's card part's
// (tab-card.ts, MESITA-3563), on a wallet_purchases row instead of a
// wallet_payments one:
//
//   1. the EF checks the card is on the caller's own customer (ownCard) and
//      runs every voucher gate the Checkout path runs;
//   2. openPurchaseRow opens ONE `opening` row under the tap's request_id
//      (the test-mode cap first, as Checkout);
//   3. the card is cloned to the place's account;
//   4. the PaymentIntent is created there UNCONFIRMED (card only, the
//      Checkout's metadata: mesita_kind wallet_voucher, purchase_id, …) and
//      stored on the row (opening → open), so a PI that later succeeds always
//      has a row that names it;
//   5. it is confirmed with use_stripe_sdk: succeeded credits at once
//      (wallet_credit_purchase, the Checkout path's RPC); requires_action
//      hands Stripe.js the client_secret and the account; a decline cancels
//      it and fails the row (refusal card_declined + decline_code).
//
// Every Stripe call carries an Idempotency-Key named after the purchase id.
// A double tap carries the same request_id, so it finds the same row and
// makes one clone, one PI and one confirm. A new tap after a failure is a new
// request_id and a new row.
//
// Settlement afterwards (a 3-D Secure check finished in the browser) is
// purchase-pi.ts's: the receiver (payment_intent.* with mesita_kind
// wallet_voucher), the cron and the Wallet read all settle by PI; ten
// minutes unfinished → cancel first, then release.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { MoneyVoucherKey } from "./money-state.ts";
import type { AccountRow } from "./payments.ts";
import { type PurchaseStore, purchaseStore } from "./purchase-pi.ts";
import { type CardStep } from "./tab-card.ts";
import { type BuyRefusal, openPurchaseRow, REFUSAL_FOR, voucherMetadata, voucherName } from "./vouchers.ts";
import { availableAtFor, type VoucherPlace } from "./wallet.ts";
import { type StripeCall, StripeError } from "./stripe.ts";

export type CardBuyRefusal = { ok: false; status: number; code: string; error: string; detail?: Record<string, unknown> };
export type CardBuyOk = { ok: true; purchase_id: string; card: CardStep };

function refuse(status: number, code: string, error: string, detail?: Record<string, unknown>): CardBuyRefusal {
  return { ok: false, status, code, error, ...(detail ? { detail } : {}) };
}

function stripeCode(err: unknown): string {
  if (err instanceof StripeError) return (err.code || err.type || "stripe_error").slice(0, 64);
  return "stripe_unreachable";
}

/** The twin request is still talking to Stripe under the same key. */
function inFlight(err: unknown): boolean {
  return err instanceof StripeError && (err.code === "idempotency_key_in_use" || err.httpStatus === 409);
}

const PAID = new Set(["paid", "refunded", "partly_refunded", "needs_review"]);

async function cancelQuietly(stripe: StripeCall, account: string, piId: string, purchaseId: string): Promise<void> {
  try {
    await stripe("POST", `payment_intents/${encodeURIComponent(piId)}/cancel`, {}, {
      stripeAccount: account,
      idempotencyKey: `vouchercard-cancel:${purchaseId}:${piId}`,
    });
  } catch (err) {
    console.error("[voucher-card] cancel_failed", JSON.stringify({ purchase_id: purchaseId, code: stripeCode(err) }));
  }
}

/** A PaymentIntent's state as the guest's next step. Credits a succeeded
 *  one; fails the row of one that can no longer pay. */
async function stepOf(
  store: PurchaseStore,
  stripe: StripeCall,
  row: { id: string; account: string; availableAt: string | null },
  pi: Record<string, unknown>,
  publishableKey: string | null,
): Promise<{ ok: true; step: CardStep } | CardBuyRefusal> {
  const piId = String(pi.id);
  switch (pi.status) {
    case "succeeded":
      await store.credit(row.id, piId, row.availableAt);
      return { ok: true, step: { status: "succeeded", payment_intent_id: piId } };
    case "processing":
      return { ok: true, step: { status: "processing", payment_intent_id: piId } };
    case "requires_action":
    case "requires_confirmation": {
      const secret = typeof pi.client_secret === "string" ? pi.client_secret : null;
      if (!publishableKey || !secret) {
        // The bank asks for a check the app cannot show: nothing was charged.
        await cancelQuietly(stripe, row.account, piId, row.id);
        await store.release(row.id, "needs_auth_unavailable");
        return refuse(409, "card_needs_auth", "This card needs a bank check we can't show yet. Try another card or pay on Stripe's page.");
      }
      return {
        ok: true,
        step: { status: "requires_action", payment_intent_id: piId, client_secret: secret, stripe_account: row.account, publishable_key: publishableKey },
      };
    }
    case "canceled":
      await store.release(row.id, "pi_canceled");
      return refuse(409, "card_declined", "The card payment was cancelled. Try again.");
    default: {
      // requires_payment_method: declined (or a failed 3-D Secure).
      const last = (pi.last_payment_error ?? {}) as Record<string, unknown>;
      const decline = String(last.decline_code ?? last.code ?? "declined").slice(0, 64);
      await cancelQuietly(stripe, row.account, piId, row.id);
      await store.release(row.id, `card_declined:${decline}`);
      return refuse(409, "card_declined", "Your card was declined. Try another card.", { decline_code: decline });
    }
  }
}

/** Steps 3–5 for the row openPurchaseRow opened (or the same tap's row
 *  again). A thrown error is the door's 5xx: the row stays `opening` (no PI;
 *  the cron fails it after ten minutes) or `open` (a PI; the cron reads it). */
export async function runVoucherCard(
  store: PurchaseStore,
  stripe: StripeCall,
  args: {
    purchaseId: string;
    customer: string;
    platformPm: string;
    currency: string;
    placeId: string;
    placeName: string | null;
    consumerId: string;
    voucher: MoneyVoucherKey;
    publishableKey: string | null;
    nowMs: number;
  },
): Promise<CardBuyOk | CardBuyRefusal> {
  const row = await store.read(args.purchaseId);
  if (!row || !row.stripe_account_id) throw new Error("purchase_row_missing");
  const account = row.stripe_account_id;
  const ref = { id: row.id, account, availableAt: availableAtFor(args.voucher, args.nowMs) };
  const done = (step: CardStep): CardBuyOk => ({ ok: true, purchase_id: row.id, card: step });
  const closed = () => refuse(409, "closed", "That purchase was cancelled. Tap again to start over.");

  if (row.stripe_payment_intent_id) {
    // The same tap again: read where its PI stands.
    if (PAID.has(row.status)) return done({ status: "succeeded", payment_intent_id: row.stripe_payment_intent_id });
    if (row.status !== "open") return closed();
    const pi = await stripe("GET", `payment_intents/${encodeURIComponent(row.stripe_payment_intent_id)}`, undefined, { stripeAccount: account });
    const r = await stepOf(store, stripe, ref, pi, args.publishableKey);
    return r.ok ? done(r.step) : r;
  }
  if (row.status !== "opening" || row.stripe_checkout_session_id) return closed();

  let pi: Record<string, unknown>;
  try {
    const cloned = await stripe("POST", "payment_methods", { customer: args.customer, payment_method: args.platformPm }, {
      stripeAccount: account,
      idempotencyKey: `vouchercard-clone:${row.id}`,
    });
    pi = await stripe("POST", "payment_intents", {
      amount: row.amount_cents,
      currency: args.currency,
      payment_method: String(cloned.id),
      payment_method_types: ["card"],
      description: `${voucherName(args.voucher)} · ${(args.placeName ?? "Mesita place")}`.slice(0, 250),
      metadata: voucherMetadata({ purchaseId: row.id, placeId: args.placeId, consumerId: args.consumerId, voucher: args.voucher }),
    }, { stripeAccount: account, idempotencyKey: `vouchercard-pi:${row.id}` });
  } catch (err) {
    if (inFlight(err)) return refuse(409, "in_progress", "Your purchase is already on its way.");
    const code = stripeCode(err);
    console.error("[voucher-card] start_failed", JSON.stringify({ purchase_id: row.id, code }));
    await store.release(row.id, code);
    return refuse(502, "card_failed", "Couldn't start the card payment. Try again.", { stripe_code: code });
  }
  const piId = String(pi.id);

  if (!(await store.openPi(row.id, piId))) {
    // Nobody could credit a PI the row does not name: cancel it, release.
    await cancelQuietly(stripe, account, piId, row.id);
    await store.release(row.id, "pi_write");
    return refuse(502, "card_failed", "Couldn't start the card payment. Try again.");
  }

  let confirmed: Record<string, unknown>;
  try {
    confirmed = await stripe("POST", `payment_intents/${encodeURIComponent(piId)}/confirm`, { use_stripe_sdk: true }, {
      stripeAccount: account,
      idempotencyKey: `vouchercard-confirm:${row.id}`,
    });
  } catch (err) {
    if (inFlight(err)) return refuse(409, "in_progress", "Your purchase is already on its way.");
    if (err instanceof StripeError && err.type === "card_error") {
      // A decline: Stripe left the PI requires_payment_method. Read it for
      // the decline code, then cancel and release.
      const after = await stripe("GET", `payment_intents/${encodeURIComponent(piId)}`, undefined, { stripeAccount: account });
      const r = await stepOf(store, stripe, ref, { ...after, status: after.status === "succeeded" ? "succeeded" : "requires_payment_method" }, args.publishableKey);
      return r.ok ? done(r.step) : r;
    }
    throw err;
  }
  const r = await stepOf(store, stripe, ref, confirmed, args.publishableKey);
  return r.ok ? done(r.step) : r;
}

/** The row a tap's request_id already opened, if any. */
export async function readRequestRow(
  admin: SupabaseClient,
  consumerId: string,
  requestId: string,
): Promise<{ id: string; voucher: string | null; place_id: string; currency: string; status: string; stripe_checkout_session_id: string | null } | null> {
  const { data, error } = await admin.from("wallet_purchases")
    .select("id, voucher, place_id, currency, status, stripe_checkout_session_id")
    .eq("consumer_id", consumerId).eq("request_id", requestId)
    .maybeSingle();
  if (error) throw new Error(`purchase_read: ${error.message}`);
  return (data as { id: string; voucher: string | null; place_id: string; currency: string; status: string; stripe_checkout_session_id: string | null } | null) ?? null;
}

/** The whole saved-card buy after every gate passed: the row (or the same
 *  tap's row again), then runVoucherCard. */
export async function openVoucherCard(
  admin: SupabaseClient,
  stripe: StripeCall,
  args: {
    consumerId: string;
    place: VoucherPlace;
    account: AccountRow;
    voucher: MoneyVoucherKey;
    currency: string;
    requestId: string;
    livemode: boolean;
    customer: string;
    platformPm: string;
    publishableKey: string | null;
    nowMs: number;
  },
): Promise<CardBuyOk | CardBuyRefusal | BuyRefusal> {
  const opened = await openPurchaseRow(admin, args);
  if (!opened.ok) return opened;
  let purchaseId: string;
  if (opened.duplicate) {
    const row = await readRequestRow(admin, args.consumerId, args.requestId);
    if (!row) {
      // Welcome's once-per-guest index refused it, not the request id.
      if (args.voucher !== "voucher_welcome") return refuse(409, "in_progress", "Your purchase is already on its way.");
      const { data: w, error: wErr } = await admin.from("wallet_purchases").select("id")
        .eq("consumer_id", args.consumerId).eq("place_id", args.place.id)
        .eq("voucher", "voucher_welcome").in("status", ["opening", "open"]).limit(1);
      if (wErr) throw new Error(`welcome_read: ${wErr.message}`);
      if ((w ?? []).length > 0) return refuse(409, "in_progress", "Your Welcome voucher is already on its way.");
      return { ok: false, status: 409, ...REFUSAL_FOR.used };
    }
    if (row.stripe_checkout_session_id || row.voucher !== args.voucher || row.place_id !== args.place.id) {
      return refuse(409, "in_progress", "Your purchase is already on its way.");
    }
    purchaseId = row.id;
  } else {
    purchaseId = opened.purchaseId;
  }
  return await runVoucherCard(purchaseStore(admin), stripe, {
    purchaseId,
    customer: args.customer,
    platformPm: args.platformPm,
    currency: args.currency,
    placeId: args.place.id,
    placeName: args.place.name ?? null,
    consumerId: args.consumerId,
    voucher: args.voucher,
    publishableKey: args.publishableKey,
    nowMs: args.nowMs,
  });
}
