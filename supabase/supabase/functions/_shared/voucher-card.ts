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
//      (the Credits Limit first, as Checkout);
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
// A basket (MESITA-3841) is the same machinery on several rows: the lead (the
// tap's request_id, metadata.purchase_id) and its followers, ONE clone, ONE
// PaymentIntent for the sum, stored on every row at once (openPi); a
// succeeded PI credits every row, a decline or a cancel releases every row.
// All or nothing: Stripe charges the sum once or not at all.
//
// Settlement afterwards (a 3-D Secure check finished in the browser) is
// purchase-pi.ts's: the receiver (payment_intent.* with mesita_kind
// wallet_voucher), the cron and the Wallet read all settle by PI; ten
// minutes unfinished → cancel first, then release.

import { toStripeAmount } from "./money.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { MoneyVoucherKey } from "./money-state.ts";
import type { AccountRow } from "./payments.ts";
import { PURCHASE_PI_TTL_MS, type PurchaseStore, purchaseStore, recordPayWith } from "./purchase-pi.ts";
import { type CardStep, isPaymentMethodId } from "./tab-card.ts";
import { type BuyRefusal, openPurchaseRow, REFUSAL_FOR, sameUnits, voucherMetadata, voucherName } from "./vouchers.ts";
import { availableAtFor, type VoucherPlace } from "./wallet.ts";
import { type StripeCall, StripeError } from "./stripe.ts";

export type CardBuyRefusal = { ok: false; status: number; code: string; error: string; detail?: Record<string, unknown> };
export type CardBuyOk = { ok: true; purchase_id: string; card: CardStep };

/** MESITA-4384: express pay's step. The browser confirms the PaymentIntent
 *  (Stripe's Express Checkout Element: Apple Pay / Google Pay), so an open
 *  one answers its client secret and the amount Stripe holds; a settled one
 *  names the wallet that paid. */
export type ExpressStep =
  | { status: "succeeded"; payment_intent_id: string; pay_with: "apple_pay" | "google_pay" | "express" }
  | { status: "processing"; payment_intent_id: string }
  | {
    status: "requires_payment_method" | "requires_action";
    payment_intent_id: string;
    client_secret: string;
    stripe_account: string;
    publishable_key: string;
    amount_cents: number;
    /** The last decline's text, when the wallet's card was declined. */
    decline_code?: string;
    error?: string;
  };
export type ExpressBuyOk = { ok: true; purchase_id: string; express: ExpressStep };

/** How a buy pays: a saved card the server copies and confirms, or express
 *  pay the browser confirms (MESITA-4384). */
export type VoucherSource = { kind: "card"; customer: string; platformPm: string } | { kind: "express" };

/** The express/card choice of a buy body (MESITA-4384): exactly one of
 *  `express: true` and `card_pm_id`. Pure. */
export function expressBodyGate(body: Record<string, unknown>): { ok: true; express: boolean } | { ok: false; status: 400; code: "bad_body"; field: "express"; error: string } {
  const hasCard = body.card_pm_id !== undefined && body.card_pm_id !== null && body.card_pm_id !== "";
  const express = body.express === true;
  if (body.express !== undefined && body.express !== null && body.express !== true && body.express !== false) {
    return { ok: false, status: 400, code: "bad_body", field: "express", error: "express must be true or absent" };
  }
  if (express && hasCard) return { ok: false, status: 400, code: "bad_body", field: "express", error: "Send express or card_pm_id, not both" };
  return { ok: true, express };
}

/** The card gate of a voucher buy (MESITA-4065: no Stripe page, a saved card
 *  is required). Runs after the body shape and before any place, voucher or
 *  row work, so a refusal writes nothing. An old bundle's `return_url` is
 *  ignored; a malformed card id reads as a card that is not the guest's. */
export function voucherBuyGate(
  body: Record<string, unknown>,
): { ok: true; cardPmId: string } | { ok: false; status: 404 | 409; code: "card_required" | "card_not_found"; error: string } {
  const pm = body.card_pm_id;
  if (pm === undefined || pm === null || pm === "") {
    return { ok: false, status: 409, code: "card_required", error: "Add a card to buy credit." };
  }
  if (!isPaymentMethodId(pm)) {
    return { ok: false, status: 404, code: "card_not_found", error: "That card is not saved on your account" };
  }
  return { ok: true, cardPmId: pm };
}

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

/** The rows one tap pays: the lead, then a basket's followers (MESITA-3841). */
type Units = { id: string; account: string; rows: Array<{ id: string; availableAt: string | null }> };

async function releaseAll(store: PurchaseStore, row: Units, code: string): Promise<void> {
  for (const r of row.rows) await store.release(r.id, code);
}

/** A PaymentIntent's state as the guest's next step. Credits every row of a
 *  succeeded one; fails every row of one that can no longer pay. */
async function stepOf(
  store: PurchaseStore,
  stripe: StripeCall,
  row: Units,
  pi: Record<string, unknown>,
  publishableKey: string | null,
): Promise<{ ok: true; step: CardStep } | CardBuyRefusal> {
  const piId = String(pi.id);
  switch (pi.status) {
    case "succeeded":
      for (const r of row.rows) await store.credit(r.id, piId, r.availableAt);
      return { ok: true, step: { status: "succeeded", payment_intent_id: piId } };
    case "processing":
      return { ok: true, step: { status: "processing", payment_intent_id: piId } };
    case "requires_action":
    case "requires_confirmation": {
      const secret = typeof pi.client_secret === "string" ? pi.client_secret : null;
      if (!publishableKey || !secret) {
        // The bank asks for a check the app cannot show: nothing was charged.
        await cancelQuietly(stripe, row.account, piId, row.id);
        await releaseAll(store, row, "needs_auth_unavailable");
        return refuse(409, "card_needs_auth", "This card needs a bank check we can't show yet. Try another card or pay on Stripe's page.");
      }
      return {
        ok: true,
        step: { status: "requires_action", payment_intent_id: piId, client_secret: secret, stripe_account: row.account, publishable_key: publishableKey },
      };
    }
    case "canceled":
      await releaseAll(store, row, "pi_canceled");
      return refuse(409, "card_declined", "The card payment was cancelled. Try again.");
    default: {
      // requires_payment_method: declined (or a failed 3-D Secure).
      const last = (pi.last_payment_error ?? {}) as Record<string, unknown>;
      const decline = String(last.decline_code ?? last.code ?? "declined").slice(0, 64);
      await cancelQuietly(stripe, row.account, piId, row.id);
      await releaseAll(store, row, `card_declined:${decline}`);
      return refuse(409, "card_declined", "Your card was declined. Try another card.", { decline_code: decline });
    }
  }
}

/** MESITA-4384: an EXPRESS PaymentIntent's state as the guest's next step.
 *  Never stepOf's default branch: a requires_payment_method PI here is the
 *  normal state BEFORE the browser confirms (and after a wallet decline, when
 *  the same PI takes another payment method), so it is kept, with its rows
 *  open, while it is younger than PURCHASE_PI_TTL_MS; the cron's
 *  cancel-then-release clears it after that. A succeeded PI credits every
 *  row and records the wallet (the one writer, purchase-pi.ts). */
async function expressStepOf(
  store: PurchaseStore,
  stripe: StripeCall,
  row: Units,
  pi: Record<string, unknown>,
  ctx: { publishableKey: string | null; amount: number; createdAt: string; nowMs: number },
): Promise<{ ok: true; step: ExpressStep } | CardBuyRefusal> {
  const piId = String(pi.id);
  switch (pi.status) {
    case "succeeded": {
      for (const r of row.rows) await store.credit(r.id, piId, r.availableAt);
      const wallet = await recordPayWith(store, stripe, { leadId: row.id, account: row.account, pi });
      return { ok: true, step: { status: "succeeded", payment_intent_id: piId, pay_with: wallet ?? "express" } };
    }
    case "processing":
      return { ok: true, step: { status: "processing", payment_intent_id: piId } };
    case "canceled":
      await releaseAll(store, row, "pi_canceled");
      return refuse(409, "closed", "That payment was cancelled. Tap again to start over.");
    default: {
      // requires_payment_method | requires_action | requires_confirmation.
      if (ctx.nowMs - Date.parse(ctx.createdAt) >= PURCHASE_PI_TTL_MS) {
        // Too old to take a payment now; the cron cancels it, then releases.
        return refuse(409, "closed", "That payment timed out. Tap again to start over.");
      }
      const secret = typeof pi.client_secret === "string" ? pi.client_secret : null;
      if (!ctx.publishableKey || !secret) return refuse(503, "payments_unavailable", "Payments are not available right now");
      const last = (pi.last_payment_error ?? null) as Record<string, unknown> | null;
      const decline = last ? String(last.decline_code ?? last.code ?? "declined").slice(0, 64) : null;
      return {
        ok: true,
        step: {
          status: pi.status === "requires_action" ? "requires_action" : "requires_payment_method",
          payment_intent_id: piId,
          client_secret: secret,
          stripe_account: row.account,
          publishable_key: ctx.publishableKey,
          amount_cents: typeof pi.amount === "number" ? pi.amount : ctx.amount,
          ...(decline ? { decline_code: decline, error: "Your bank declined it. Try another way to pay." } : {}),
        },
      };
    }
  }
}

/** MESITA-4384: open an express purchase's PaymentIntent: the server's own
 *  amount, card only (Apple Pay and Google Pay are cards), NO payment method
 *  and NO confirm; the row names it before the browser ever sees it. */
async function openExpressIntent(
  store: PurchaseStore,
  stripe: StripeCall,
  ref: Units,
  args: {
    currency: string;
    placeId: string;
    placeName: string | null;
    consumerId: string;
    voucher: MoneyVoucherKey;
    publishableKey: string | null;
    amount: number;
    count: number;
    followerKeys: MoneyVoucherKey[];
  },
): Promise<ExpressBuyOk | CardBuyRefusal> {
  if (!args.publishableKey) {
    await releaseAll(store, ref, "no_publishable_key");
    return refuse(503, "payments_unavailable", "Payments are not available right now");
  }
  const amount = toStripeAmount(args.amount, args.currency);
  let pi: Record<string, unknown>;
  try {
    pi = await stripe("POST", "payment_intents", {
      amount,
      currency: args.currency,
      payment_method_types: ["card"],
      description: `${args.count > 1 ? `${args.count} vouchers` : voucherName(args.voucher, args.currency)} · ${(args.placeName ?? "Mesita place")}`.slice(0, 250),
      metadata: {
        ...voucherMetadata({
          purchaseId: ref.id,
          placeId: args.placeId,
          consumerId: args.consumerId,
          voucher: args.voucher,
          currency: args.currency,
          ...(args.followerKeys.length > 0 ? { followers: args.followerKeys } : {}),
        }),
        mesita_pay_with: "express",
      },
    }, { stripeAccount: ref.account, idempotencyKey: `voucherexpress-pi:${ref.id}` });
  } catch (err) {
    if (inFlight(err)) return refuse(409, "in_progress", "Your purchase is already on its way.");
    const code = stripeCode(err);
    console.error("[voucher-card] express_start_failed", JSON.stringify({ purchase_id: ref.id, code }));
    await releaseAll(store, ref, code);
    return refuse(502, "card_failed", "Couldn't start the payment. Try again.", { stripe_code: code });
  }
  const piId = String(pi.id);
  if (!(await store.openPi(ref.id, piId))) {
    await cancelQuietly(stripe, ref.account, piId, ref.id);
    await releaseAll(store, ref, "pi_write");
    return refuse(502, "card_failed", "Couldn't start the payment. Try again.");
  }
  const secret = typeof pi.client_secret === "string" ? pi.client_secret : null;
  if (!secret) {
    await cancelQuietly(stripe, ref.account, piId, ref.id);
    await releaseAll(store, ref, "no_client_secret");
    return refuse(502, "card_failed", "Couldn't start the payment. Try again.");
  }
  return {
    ok: true,
    purchase_id: ref.id,
    express: {
      status: "requires_payment_method",
      payment_intent_id: piId,
      client_secret: secret,
      stripe_account: ref.account,
      publishable_key: args.publishableKey,
      amount_cents: amount,
    },
  };
}

/** Steps 3–5 for the row openPurchaseRow opened (or the same tap's row
 *  again). A thrown error is the door's 5xx: the row stays `opening` (no PI;
 *  the cron fails it after ten minutes) or `open` (a PI; the cron reads it). */
export async function runVoucherCard(
  store: PurchaseStore,
  stripe: StripeCall,
  args: {
    purchaseId: string;
    /** The saved card (pay_source card); unused on an express row. */
    customer?: string;
    platformPm?: string;
    currency: string;
    placeId: string;
    placeName: string | null;
    consumerId: string;
    voucher: MoneyVoucherKey;
    publishableKey: string | null;
    nowMs: number;
  },
): Promise<CardBuyOk | ExpressBuyOk | CardBuyRefusal> {
  const row = await store.read(args.purchaseId);
  if (!row || !row.stripe_account_id) throw new Error("purchase_row_missing");
  const account = row.stripe_account_id;
  const followers = await store.followers(row.id);
  const all = [row, ...followers];
  const ref: Units = {
    id: row.id,
    account,
    rows: all.map((r) => ({ id: r.id, availableAt: availableAtFor(r.voucher ?? args.voucher, args.nowMs) })),
  };
  const done = (step: CardStep): CardBuyOk => ({ ok: true, purchase_id: row.id, card: step });
  const closed = () => refuse(409, "closed", "That purchase was cancelled. Tap again to start over.");

  // MESITA-4384: the lead's pay_source decides the path, never the body.
  const express = row.pay_source === "express";
  const amount = all.reduce((sum, r) => sum + r.amount_cents, 0);
  const expressDone = (step: ExpressStep): ExpressBuyOk => ({ ok: true, purchase_id: row.id, express: step });

  if (row.stripe_payment_intent_id) {
    // The same tap again: read where its PI stands.
    if (all.every((r) => PAID.has(r.status))) {
      if (express) {
        const payWith = row.pay_with === "apple_pay" || row.pay_with === "google_pay" ? row.pay_with : "express";
        return expressDone({ status: "succeeded", payment_intent_id: row.stripe_payment_intent_id, pay_with: payWith });
      }
      return done({ status: "succeeded", payment_intent_id: row.stripe_payment_intent_id });
    }
    if (row.status !== "open" && !PAID.has(row.status)) return closed();
    if (express) {
      const pi = await stripe("GET", `payment_intents/${encodeURIComponent(row.stripe_payment_intent_id)}`, { expand: ["latest_charge"] }, { stripeAccount: account });
      const r = await expressStepOf(store, stripe, ref, pi, {
        publishableKey: args.publishableKey,
        amount: toStripeAmount(amount, args.currency),
        createdAt: row.created_at,
        nowMs: args.nowMs,
      });
      return r.ok ? expressDone(r.step) : r;
    }
    const pi = await stripe("GET", `payment_intents/${encodeURIComponent(row.stripe_payment_intent_id)}`, undefined, { stripeAccount: account });
    const r = await stepOf(store, stripe, ref, pi, args.publishableKey);
    return r.ok ? done(r.step) : r;
  }
  if (row.status !== "opening" || row.stripe_checkout_session_id) return closed();
  if (followers.some((f) => f.status !== "opening")) {
    // A follower the cron already failed: the basket is all or nothing.
    await releaseAll(store, ref, "basket_closed");
    return closed();
  }
  const followerKeys = followers.map((f) => f.voucher as MoneyVoucherKey);
  if (express) return await openExpressIntent(store, stripe, ref, { ...args, amount, count: all.length, followerKeys });
  if (!args.customer || !args.platformPm) throw new Error("card_source_missing");

  let pi: Record<string, unknown>;
  try {
    const cloned = await stripe("POST", "payment_methods", { customer: args.customer, payment_method: args.platformPm }, {
      stripeAccount: account,
      idempotencyKey: `vouchercard-clone:${row.id}`,
    });
    pi = await stripe("POST", "payment_intents", {
      amount: toStripeAmount(amount, args.currency),
      currency: args.currency,
      payment_method: String(cloned.id),
      payment_method_types: ["card"],
      description: `${all.length > 1 ? `${all.length} vouchers` : voucherName(args.voucher, args.currency)} · ${(args.placeName ?? "Mesita place")}`.slice(0, 250),
      metadata: voucherMetadata({
        purchaseId: row.id,
        placeId: args.placeId,
        consumerId: args.consumerId,
        voucher: args.voucher,
        currency: args.currency,
        ...(followerKeys.length > 0 ? { followers: followerKeys } : {}),
      }),
    }, { stripeAccount: account, idempotencyKey: `vouchercard-pi:${row.id}` });
  } catch (err) {
    if (inFlight(err)) return refuse(409, "in_progress", "Your purchase is already on its way.");
    const code = stripeCode(err);
    console.error("[voucher-card] start_failed", JSON.stringify({ purchase_id: row.id, code }));
    await releaseAll(store, ref, code);
    return refuse(502, "card_failed", "Couldn't start the card payment. Try again.", { stripe_code: code });
  }
  const piId = String(pi.id);

  if (!(await store.openPi(row.id, piId))) {
    // Nobody could credit a PI the row does not name: cancel it, release.
    await cancelQuietly(stripe, account, piId, row.id);
    await releaseAll(store, ref, "pi_write");
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
): Promise<RequestRow | null> {
  const { data, error } = await admin.from("wallet_purchases")
    .select("id, voucher, place_id, currency, status, stripe_checkout_session_id, pay_source")
    .eq("consumer_id", consumerId).eq("request_id", requestId)
    .maybeSingle();
  if (error) throw new Error(`purchase_read: ${error.message}`);
  return (data as RequestRow | null) ?? null;
}

/** A tap's lead row as the replay reads it; pay_source 'card' on old rows. */
export type RequestRow = {
  id: string;
  voucher: string | null;
  place_id: string;
  currency: string;
  status: string;
  stripe_checkout_session_id: string | null;
  pay_source: string;
};

/** The vouchers a basket lead's followers hold (MESITA-3841), to tell the
 *  same tap's basket from another one under the same request_id. */
export async function readFollowerVouchers(admin: SupabaseClient, leadId: string): Promise<Array<string | null>> {
  const { data, error } = await admin.from("wallet_purchases").select("voucher").eq("basket_lead_id", leadId);
  if (error) throw new Error(`purchase_followers: ${error.message}`);
  return ((data ?? []) as Array<{ voucher: string | null }>).map((r) => r.voucher);
}

/** The whole saved-card buy after every gate passed: the row (or the same
 *  tap's row again), then runVoucherCard. A basket (MESITA-3841): `voucher`
 *  is the lead's unit and `followers` the rest. */
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
    /** MESITA-4384: a saved card, or express pay (the browser confirms). */
    source: VoucherSource;
    publishableKey: string | null;
    nowMs: number;
    followers?: readonly MoneyVoucherKey[];
  },
): Promise<CardBuyOk | ExpressBuyOk | CardBuyRefusal | BuyRefusal> {
  const opened = await openPurchaseRow(admin, { ...args, paySource: args.source.kind });
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
    if (row.stripe_checkout_session_id || row.voucher !== args.voucher || row.place_id !== args.place.id || row.pay_source !== args.source.kind) {
      return refuse(409, "in_progress", "Your purchase is already on its way.");
    }
    if (!sameUnits(await readFollowerVouchers(admin, row.id), args.followers ?? [])) {
      return refuse(409, "in_progress", "Your purchase is already on its way.");
    }
    purchaseId = row.id;
  } else {
    purchaseId = opened.purchaseId;
  }
  return await runVoucherCard(purchaseStore(admin), stripe, {
    purchaseId,
    ...(args.source.kind === "card" ? { customer: args.source.customer, platformPm: args.source.platformPm } : {}),
    currency: args.currency,
    placeId: args.place.id,
    placeName: args.place.name ?? null,
    consumerId: args.consumerId,
    voucher: args.voucher,
    publishableKey: args.publishableKey,
    nowMs: args.nowMs,
  });
}
