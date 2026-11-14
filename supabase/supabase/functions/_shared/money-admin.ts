// W3 (MESITA-3307): the owner's money page and the operator's refunds.
//
//   maskGuest        who paid, as the owner sees it: the guest's name, else
//                    the email's local part cut to two characters; never the
//                    email itself.
//   refundPurchase   one voucher purchase, full or partial, through Stripe on
//                    the place's connected account.
//   refundPayment    one payment: its card part (card + tip) through Stripe
//                    first, then its credit part given back as credit.
//
// Every Stripe refund starts as a wallet_refund_attempts row whose id is the
// Idempotency-Key, carries Stripe-Account, and returns Mesita's fee with the
// money (refund_application_fee) only on a charge from before MESITA-3461
// that carried one (fee_collected = application_fee); since then the refund
// RPC writes the refunded share of the fee, so it is never billed. The ledger is
// written by the same RPCs the Connect receiver calls, with the cumulative
// amount, so the receiver's later delivery of the same refund is a no-op.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { type StripeCall, StripeError } from "./stripe.ts";
import { errorMessage } from "./errors.ts";
import { toStripeAmount } from "./money.ts";
import { purchasesByPaymentIntent, spreadGone } from "./purchase-pi.ts";

// ── Masking ───────────────────────────────────────────────────────────────

export function maskGuest(name: string | null | undefined, email: string | null | undefined): string {
  const n = (name ?? "").trim();
  if (n) return n;
  const local = (email ?? "").split("@")[0].trim();
  if (!local) return "Guest";
  return `${local.slice(0, 2)}•••`;
}

// ── Refunds ───────────────────────────────────────────────────────────────

export type RefundDeps = { admin: SupabaseClient; stripe: StripeCall; actor: string | null };

export type PurchaseRow = {
  id: string;
  consumer_id: string | null;
  place_id: string;
  amount_cents: number;
  bonus_cents: number;
  refunded_cents: number;
  application_fee_cents: number;
  fee_collected: string;
  stripe_account_id: string;
  stripe_payment_intent_id: string | null;
  voucher: string | null;
  story_activated_at: string | null;
  status: string;
  paid_at: string | null;
  livemode: boolean;
  currency: string;
  created_at: string;
};

export const PURCHASE_COLUMNS =
  "id, consumer_id, place_id, amount_cents, bonus_cents, refunded_cents, application_fee_cents, fee_collected, stripe_account_id, stripe_payment_intent_id, voucher, story_activated_at, status, paid_at, livemode, currency, created_at";

export type PaymentRow = {
  id: string;
  consumer_id: string | null;
  place_id: string;
  credit_cents: number;
  card_cents: number;
  tip_cents: number;
  refunded_cents: number;
  credit_refunded_cents: number;
  application_fee_cents: number;
  fee_collected: string;
  stripe_account_id: string | null;
  stripe_payment_intent_id: string | null;
  status: string;
  paid_at: string | null;
  livemode: boolean;
  currency?: string | null;
  /** The part paid outside Mesita (MESITA-3545); its tip was paid at the
   *  table, never on Stripe. */
  outside_cents?: number;
};

export const PAYMENT_COLUMNS =
  "id, consumer_id, place_id, credit_cents, card_cents, tip_cents, refunded_cents, credit_refunded_cents, application_fee_cents, fee_collected, stripe_account_id, stripe_payment_intent_id, status, paid_at, livemode, outside_cents, currency";

/** Whether refunding this payment needs Stripe: a card part (card + tip)
 *  not all back yet. An outside bill never does: its tip was paid at the
 *  table (MESITA-3545). */
export function paymentNeedsStripe(row: PaymentRow): boolean {
  if ((row.outside_cents ?? 0) > 0) return false;
  return row.card_cents + row.tip_cents > row.refunded_cents;
}

export type RefundResult =
  | { ok: true; card_refunded_cents: number; credit_refunded_cents: number; status: string | null }
  | { ok: false; code: "nothing_to_refund" | "refund_failed"; stripe_code?: string; error: string };

/** Only a charge from before MESITA-3461 carried Stripe's application fee. */
export function withApplicationFee(row: { application_fee_cents: number; fee_collected: string }): boolean {
  return row.fee_collected === "application_fee" && row.application_fee_cents > 0;
}

/** One Stripe refund of a direct charge, keyed by a fresh attempt row. */
async function stripeRefund(
  deps: RefundDeps,
  target: { purchase_id?: string; payment_id?: string },
  args: { paymentIntent: string; account: string; amount: number; withFee: boolean; currency?: string | null },
): Promise<{ ok: true } | { ok: false; stripe_code: string; error: string }> {
  const { data, error } = await deps.admin
    .from("wallet_refund_attempts")
    .insert({ ...target, amount_cents: args.amount, created_by: deps.actor })
    .select("id")
    .single();
  if (error || !data) throw new Error(`wallet_refund_attempts: ${error?.message ?? "no row"}`);
  const attemptId = (data as { id: string }).id;
  try {
    const refund = await deps.stripe(
      "POST",
      "refunds",
      {
        payment_intent: args.paymentIntent,
        amount: toStripeAmount(args.amount, args.currency),
        ...(args.withFee ? { refund_application_fee: true } : {}),
        metadata: { attempt_id: attemptId },
      },
      { idempotencyKey: attemptId, stripeAccount: args.account },
    );
    await deps.admin
      .from("wallet_refund_attempts")
      .update({ status: "done", stripe_refund_id: String(refund.id ?? ""), updated_at: new Date().toISOString() })
      .eq("id", attemptId);
    return { ok: true };
  } catch (err) {
    const code = err instanceof StripeError ? (err.code || err.type || String(err.httpStatus)) : "network";
    await deps.admin
      .from("wallet_refund_attempts")
      .update({ status: "failed", error_code: code, updated_at: new Date().toISOString() })
      .eq("id", attemptId);
    return { ok: false, stripe_code: code, error: errorMessage(err) };
  }
}

async function rpcOk(admin: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  const res = (data ?? {}) as Record<string, unknown>;
  if (res.ok !== true) throw new Error(`${fn}: ${String(res.code ?? "failed")}`);
  return res;
}

/** A voucher purchase: `amount` (default all that is left) back to the card.
 *
 *  A purchase in a basket (MESITA-3841; several rows on one PaymentIntent)
 *  refunds THE BASKET's charge: `amount` (default all that is left on the
 *  whole basket) comes off the shared charge and the new cumulative total is
 *  spread over the basket's rows in order, the Connect receiver's rule
 *  (spreadGone), so the receiver's later delivery of the same refund is a
 *  no-op and the two never count one peso twice. */
export async function refundPurchase(deps: RefundDeps, row: PurchaseRow, amount?: number): Promise<RefundResult> {
  if (row.stripe_payment_intent_id) {
    const basket = await purchasesByPaymentIntent<PurchaseRow>(deps.admin, row.stripe_payment_intent_id, PURCHASE_COLUMNS);
    if (basket.length > 1) return await refundBasket(deps, row, basket, amount);
  }
  const left = row.amount_cents - row.refunded_cents;
  const want = Math.min(amount ?? left, left);
  if (!row.paid_at || want <= 0 || !row.stripe_payment_intent_id) {
    return { ok: false, code: "nothing_to_refund", error: "Nothing left to refund on this purchase" };
  }
  const r = await stripeRefund(deps, { purchase_id: row.id }, {
    paymentIntent: row.stripe_payment_intent_id,
    account: row.stripe_account_id,
    amount: want,
    withFee: withApplicationFee(row),
    currency: row.currency,
  });
  if (!r.ok) return { ok: false, code: "refund_failed", stripe_code: r.stripe_code, error: r.error };
  const total = row.refunded_cents + want;
  const res = await rpcOk(deps.admin, "wallet_refund_purchase", { p_purchase_id: row.id, p_amount_refunded: total });
  return { ok: true, card_refunded_cents: want, credit_refunded_cents: 0, status: (res.status as string) ?? null };
}

async function refundBasket(deps: RefundDeps, row: PurchaseRow, rows: PurchaseRow[], amount?: number): Promise<RefundResult> {
  const total = rows.reduce((sum, r) => sum + r.amount_cents, 0);
  const refunded = rows.reduce((sum, r) => sum + r.refunded_cents, 0);
  const left = total - refunded;
  const want = Math.min(amount ?? left, left);
  if (!row.paid_at || want <= 0 || !row.stripe_payment_intent_id) {
    return { ok: false, code: "nothing_to_refund", error: "Nothing left to refund on this purchase" };
  }
  const r = await stripeRefund(deps, { purchase_id: row.id }, {
    paymentIntent: row.stripe_payment_intent_id,
    account: row.stripe_account_id,
    amount: want,
    withFee: rows.some(withApplicationFee),
    currency: row.currency,
  });
  if (!r.ok) return { ok: false, code: "refund_failed", stripe_code: r.stripe_code, error: r.error };
  let status: string | null = null;
  for (const share of spreadGone(rows, refunded + want)) {
    const before = rows.find((x) => x.id === share.id)!;
    if (share.cents <= before.refunded_cents) continue;
    const res = await rpcOk(deps.admin, "wallet_refund_purchase", { p_purchase_id: share.id, p_amount_refunded: share.cents });
    if (share.id === row.id || status === null) status = (res.status as string) ?? status;
  }
  console.log("[money-admin] refund_basket", JSON.stringify({ purchase_id: row.id, rows: rows.length, refunded_cents: want }));
  return { ok: true, card_refunded_cents: want, credit_refunded_cents: 0, status };
}

/** How a payment refund splits: the card part (card + tip) first, then the
 *  credit part. Pure. */
export function splitPaymentRefund(row: PaymentRow, amount?: number): { card: number; credit: number } {
  const cardLeft = row.card_cents + row.tip_cents - row.refunded_cents;
  const creditLeft = row.credit_cents - row.credit_refunded_cents;
  const want = Math.max(0, Math.min(amount ?? cardLeft + creditLeft, cardLeft + creditLeft));
  const card = Math.min(want, cardLeft);
  return { card, credit: Math.min(want - card, creditLeft) };
}

/** A payment: its card part through Stripe, then its credit part as credit
 *  (a credit-only payment makes no Stripe call). */
export async function refundPayment(deps: RefundDeps, row: PaymentRow, amount?: number): Promise<RefundResult> {
  // An outside bill refunds whole (MESITA-3545): the credit part back, the
  // cashback reversed, no Stripe. A partial amount is not offered for it.
  if ((row.outside_cents ?? 0) > 0) {
    if (!row.paid_at || row.status === "refunded" || row.status === "needs_review") {
      return { ok: false, code: "nothing_to_refund", error: "Nothing left to refund on this payment" };
    }
    const res = await rpcOk(deps.admin, "wallet_refund_outside", { p_payment_id: row.id });
    console.log("[money-admin] refund_outside", JSON.stringify({
      payment_id: row.id,
      credit_refunded_cents: res.credit_refunded_cents ?? 0,
      cashback_reversed_cents: res.cashback_reversed_cents ?? 0,
      uncovered_cents: res.uncovered_cents ?? 0,
    }));
    return {
      ok: true,
      card_refunded_cents: 0,
      credit_refunded_cents: Number(res.credit_refunded_cents ?? 0),
      status: (res.status as string) ?? null,
    };
  }
  const { card, credit } = splitPaymentRefund(row, amount);
  if (!row.paid_at || card + credit <= 0) {
    return { ok: false, code: "nothing_to_refund", error: "Nothing left to refund on this payment" };
  }
  let status: string | null = null;
  if (card > 0) {
    if (!row.stripe_payment_intent_id || !row.stripe_account_id) {
      return { ok: false, code: "refund_failed", error: "The card part has no Stripe charge" };
    }
    const r = await stripeRefund(deps, { payment_id: row.id }, {
      paymentIntent: row.stripe_payment_intent_id,
      account: row.stripe_account_id,
      amount: card,
      withFee: withApplicationFee(row),
      currency: row.currency,
    });
    if (!r.ok) return { ok: false, code: "refund_failed", stripe_code: r.stripe_code, error: r.error };
    const total = row.refunded_cents + card;
    const res = await rpcOk(deps.admin, "wallet_refund_payment", { p_payment_id: row.id, p_amount_refunded: total });
    status = (res.status as string) ?? null;
  }
  if (credit > 0) {
    const { data, error } = await deps.admin
      .from("wallet_refund_attempts")
      .insert({ payment_id: row.id, amount_cents: credit, created_by: deps.actor })
      .select("id")
      .single();
    if (error || !data) throw new Error(`wallet_refund_attempts: ${error?.message ?? "no row"}`);
    const res = await rpcOk(deps.admin, "wallet_refund_credit", { p_attempt_id: (data as { id: string }).id });
    status = (res.status as string) ?? status;
  }
  return { ok: true, card_refunded_cents: card, credit_refunded_cents: credit, status };
}
