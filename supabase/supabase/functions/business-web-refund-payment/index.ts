// Supabase Edge Function — business-web-refund-payment
//
// MESITA-3381: the place's owner refunds one voucher purchase or one payment
// of their own place, full or partial, from Business › Payments. The same
// path as the operator's admin-web-refund-payment (MESITA-3307): each Stripe
// refund is keyed by a wallet_refund_attempts row (Idempotency-Key) with
// Stripe-Account on the place's connected account; a payment refunds its card
// part (card + tip) first, then its credit part as credit at once. The guest's
// credit reverses by wallet_refund_purchase's rule. The owner and Mesita staff
// only: an editor gets 403 `forbidden`, a row of another place 404 `gone`.
//
// Body: { place_id: uuid, kind: "purchase" | "payment", id: uuid, amount_cents?: int }
// Response: { ok, card_refunded_cents, credit_refunded_cents, status }
// Errors: 400 shape · 403 forbidden · 404 gone · 409 nothing_to_refund,
//         not_configured · 502 refund_failed (+stripe_code) · 503 not_configured

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { canManage, requirePlaceAccess } from "../_shared/place-access.ts";
import { isUuid } from "../_shared/place-id.ts";
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
import { paymentsLivemode, paymentsStripeKey, stripeClient } from "../_shared/stripe.ts";

serveJson("business-web-refund-payment", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { place_id: placeId, kind, id, amount_cents: amount } = bodyRes.body;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  if ((kind !== "purchase" && kind !== "payment") || !isUuid(id)) {
    return json({ ok: false, error: "kind must be purchase or payment and id a uuid" }, 400);
  }
  if (amount !== undefined && amount !== null && (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0)) {
    return json({ ok: false, code: "amount_required", error: "amount_cents must be a positive integer" }, 400);
  }

  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;
  if (!canManage(access.role)) {
    return json({ ok: false, code: "forbidden", error: "Only the place's owner refunds its payments" }, 403);
  }

  const key = paymentsStripeKey();
  const livemode = paymentsLivemode();
  const table = kind === "purchase" ? "wallet_purchases" : "wallet_payments";
  const { data, error } = await admin
    .from(table)
    // Widened to string: the literal union is too complex for the client's types.
    .select((kind === "purchase" ? PURCHASE_COLUMNS : PAYMENT_COLUMNS) as string)
    .eq("id", id)
    .eq("place_id", placeId)
    .maybeSingle();
  if (error) return json({ ok: false, error: `${table}: ${error.message}` }, 500);
  if (!data) return json({ ok: false, code: "gone", error: "No such row" }, 404);
  const row = data as unknown as PurchaseRow | PaymentRow;
  if (row.place_id !== placeId) return json({ ok: false, code: "gone", error: "No such row" }, 404);
  if (row.livemode !== livemode) {
    return json({ ok: false, code: "not_configured", error: "This row belongs to the other Stripe mode" }, 409);
  }

  const deps = { admin, stripe: key ? stripeClient(key) : null, actor: user.id };
  // An outside bill (MESITA-3545) never needs Stripe: its tip was paid at the table.
  const needsStripe = kind === "purchase" || paymentNeedsStripe(row as PaymentRow);
  if (needsStripe && !deps.stripe) {
    return json({ ok: false, code: "not_configured", error: "Stripe is not configured" }, 503);
  }
  const stripe = deps.stripe ?? (() => Promise.reject(new Error("stripe not configured")));
  const res: RefundResult = kind === "purchase"
    ? await refundPurchase({ ...deps, stripe }, row as PurchaseRow, amount ?? undefined)
    : await refundPayment({ ...deps, stripe }, row as PaymentRow, amount ?? undefined);

  console.log(
    "money_refund_owner",
    JSON.stringify({ kind, id, place_id: placeId, actor: user.id, ok: res.ok, ...(res.ok ? {} : { code: res.code }) }),
  );
  if (!res.ok) {
    const status = res.code === "refund_failed" ? 502 : 409;
    return json({ ok: false, code: res.code, stripe_code: res.stripe_code ?? null, error: res.error }, status);
  }
  return json(res);
});
