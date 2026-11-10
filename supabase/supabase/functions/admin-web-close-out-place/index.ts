// Supabase Edge Function — admin-web-close-out-place
//
// MESITA-3307 (W3): an operator closes out a place: every guest's unspent
// credit there goes back to their card. Per guest, the paid purchases newest
// first, each refunding min(cash not yet refunded, floor(remaining unspent ×
// amount / (amount + bonus))) until nothing is left (planCloseOut); a
// purchase with no unspent credit behind it is skipped. Each refund is one
// wallet_refund_attempts row through Stripe and wallet_refund_purchase, the
// same path as a single refund. A failed refund is reported and the walk
// goes on. Super-admin only.
//
// Body: { place_id: uuid }
// Response: { ok, guests, refunds: [{ purchase_id, amount_cents, ok, code?, stripe_code? }], refunded_cents }
// Errors: 400 shape · 503 not_configured

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { planCloseOut, PURCHASE_COLUMNS, type PurchaseRow, refundPurchase } from "../_shared/money-admin.ts";
import { paymentsLivemode, paymentsStripeKey, stripeClient } from "../_shared/stripe.ts";

serveJson("admin-web-close-out-place", async (req) => {
  const ctx = await requireAdminRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);

  const key = paymentsStripeKey();
  if (!key) return json({ ok: false, code: "not_configured", error: "Stripe is not configured" }, 503);
  const stripe = stripeClient(key);
  const livemode = paymentsLivemode();

  const { data, error } = await admin
    .from("wallet_purchases")
    .select(PURCHASE_COLUMNS)
    .eq("place_id", placeId)
    .eq("livemode", livemode)
    .not("paid_at", "is", null)
    .in("status", ["paid", "partly_refunded", "needs_review"])
    .order("created_at", { ascending: false });
  if (error) return json({ ok: false, error: `wallet_purchases: ${error.message}` }, 500);
  const purchases = (data ?? []) as unknown as PurchaseRow[];

  const byGuest = new Map<string, PurchaseRow[]>();
  for (const p of purchases) {
    if (!p.consumer_id) continue;
    const list = byGuest.get(p.consumer_id) ?? [];
    list.push(p);
    byGuest.set(p.consumer_id, list);
  }

  const refunds: { purchase_id: string; amount_cents: number; ok: boolean; code?: string; stripe_code?: string }[] = [];
  let refunded = 0;
  for (const [consumerId, rows] of byGuest) {
    const { data: bal, error: balErr } = await admin.rpc("wallet_balance", {
      p_consumer_id: consumerId,
      p_place_id: placeId,
      p_currency: rows[0].currency,
      p_livemode: livemode,
    });
    if (balErr) return json({ ok: false, error: `wallet_balance: ${balErr.message}`, refunds }, 500);
    const b = (Array.isArray(bal) ? bal[0] : bal) as { available_cents?: number; pending_cents?: number } | null;
    const unspent = Math.max(0, (b?.available_cents ?? 0) + (b?.pending_cents ?? 0));
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const step of planCloseOut(rows, unspent)) {
      const res = await refundPurchase({ admin, stripe, actor: user.id }, byId.get(step.id)!, step.amount);
      if (res.ok) refunded += res.card_refunded_cents;
      refunds.push(res.ok
        ? { purchase_id: step.id, amount_cents: step.amount, ok: true }
        : { purchase_id: step.id, amount_cents: step.amount, ok: false, code: res.code, stripe_code: res.stripe_code });
    }
  }

  console.log("money_close_out", JSON.stringify({ placeId, actor: user.id, guests: byGuest.size, refunds: refunds.length, refunded }));
  return json({ ok: true, guests: byGuest.size, refunds, refunded_cents: refunded });
});
