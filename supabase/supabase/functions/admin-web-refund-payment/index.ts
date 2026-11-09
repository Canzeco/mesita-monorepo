// Supabase Edge Function — admin-web-refund-payment
//
// MESITA-3307 (W3): an operator refunds one voucher purchase or one payment,
// full or partial. A purchase goes back to the card on the place's connected
// account. A payment refunds its card part (card + tip) through Stripe first,
// then its credit part as credit at once; a credit-only payment never calls
// Stripe; an outside bill (MESITA-3545) refunds whole through
// wallet_refund_outside, no Stripe. Each Stripe refund is keyed by a wallet_refund_attempts row
// (Idempotency-Key) with Stripe-Account, and refund_application_fee on a
// charge from before MESITA-3461 that carried one. The
// operator sees Stripe's decline code; the guest never does. Super-admin only.
//
// Body: { kind: "purchase" | "payment", id: uuid, amount_cents?: int }
// Response: { ok, card_refunded_cents, credit_refunded_cents, status }
// Errors: 400 shape · 404 gone · 409 nothing_to_refund, not_configured
//         (the row is in the other Stripe mode) · 502 refund_failed
//         (+stripe_code) · 503 not_configured

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/auth.ts";
import { isUuid } from "../_shared/place-id.ts";
import { paymentsLivemode, paymentsStripeKey, stripeClient } from "../_shared/boost.ts";
import {
  PAYMENT_COLUMNS,
  paymentNeedsStripe,
  type PaymentRow,
  PURCHASE_COLUMNS,
  type PurchaseRow,
  type RefundResult,
  refundPayment,
  refundPurchase,
} from "../_shared/money-admin.ts";

serveJson("admin-web-refund-payment", async (req) => {
  const ctx = await requireAdminRequest(req, "POST");
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { kind, id, amount_cents: amount } = bodyRes.body;
  if ((kind !== "purchase" && kind !== "payment") || !isUuid(id)) {
    return json({ ok: false, error: "kind must be purchase or payment and id a uuid" }, 400);
  }
  if (amount !== undefined && amount !== null && (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0)) {
    return json({ ok: false, code: "amount_required", error: "amount_cents must be a positive integer" }, 400);
  }

  const key = paymentsStripeKey();
  const livemode = paymentsLivemode();
  const deps = { admin, stripe: key ? stripeClient(key) : null, actor: user.id };

  const table = kind === "purchase" ? "wallet_purchases" : "wallet_payments";
  const { data, error } = await admin
    .from(table)
    // Widened to string: the literal union is too complex for the client's types.
    .select((kind === "purchase" ? PURCHASE_COLUMNS : PAYMENT_COLUMNS) as string)
    .eq("id", id)
    .maybeSingle();
  if (error) return json({ ok: false, error: `${table}: ${error.message}` }, 500);
  if (!data) return json({ ok: false, code: "gone", error: "No such row" }, 404);
  const row = data as unknown as PurchaseRow | PaymentRow;
  if (row.livemode !== livemode) {
    return json({ ok: false, code: "not_configured", error: "This row belongs to the other Stripe mode" }, 409);
  }

  // An outside bill (MESITA-3545) never needs Stripe: its tip was paid at the table.
  const needsStripe = kind === "purchase" || paymentNeedsStripe(row as PaymentRow);
  if (needsStripe && !deps.stripe) {
    return json({ ok: false, code: "not_configured", error: "Stripe is not configured" }, 503);
  }
  const stripe = deps.stripe ?? (() => Promise.reject(new Error("stripe not configured")));
  const res: RefundResult = kind === "purchase"
    ? await refundPurchase({ ...deps, stripe }, row as PurchaseRow, amount ?? undefined)
    : await refundPayment({ ...deps, stripe }, row as PaymentRow, amount ?? undefined);

  console.log("money_refund", JSON.stringify({ kind, id, actor: user.id, ok: res.ok, ...(res.ok ? {} : { code: res.code }) }));
  if (!res.ok) {
    const status = res.code === "refund_failed" ? 502 : 409;
    return json({ ok: false, code: res.code, stripe_code: res.stripe_code ?? null, error: res.error }, status);
  }
  return json(res);
});
