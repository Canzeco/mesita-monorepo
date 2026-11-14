// Supabase Edge Function — consumer-web-start-premier-refill
//
// MESITA-3168: a signed-in guest buys an Upgrade pack for a place (one year
// of Mesita Pro for 99 USD or of Mesita Max for 999 USD, MESITA-3919; no owner check). The checks run
// first (premier_refill_check, the same refusals premier_add_days would
// answer); then a purchase row and a Stripe Checkout `payment`, card only.
// Nothing is granted here: the days land when consumer-web-get-premier-refill
// (Checkout's return) or supabase-cron-sync-premier sees the Checkout paid.
//
// Body: { place_id: uuid, tier: 1 | 2, return_url: string }
// Response: { ok: true, url: string, notice?: string }
//         | { ok: false, code: "not_found" | "archived" | "unlisted" | "paid_higher"
//                              | "cap_reached", error }  (HTTP 200)
//         | 503 { ok: false, code: "stripe_unavailable", error }
// `notice`: the place already runs at or above the tier ("This place is
// already has Mesita Max; your Upgrade keeps Mesita Max until Dec 3").
//
// Stripe stays in test mode until Pato flips STRIPE_MODE and STRIPE_ALLOW_LIVE.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { PREMIER_CURRENCY } from "../_shared/boost.ts";
import {
  checkRefill,
  parseRefillStart,
  REFILL_PACK_CENTS,
  REFILL_PACK_DAYS,
  REFILL_REFUSED,
  refillCheckoutParams,
  refillNotice,
} from "../_shared/premier-purchase.ts";
import { boostLivemode, boostStripeKey, stripeClient } from "../_shared/stripe.ts";
import { ensureCustomer } from "../_shared/boost-writes.ts";

serveJson("consumer-web-start-premier-refill", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const userId = user.id;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const parsed = parseRefillStart(bodyRes.body);
  if (!parsed.ok) return json({ ok: false, code: parsed.code, error: parsed.error }, 400);
  const start = parsed.start;

  const check = await checkRefill(admin, start.placeId, start.tier);
  if (check.result !== "ok") {
    const code = check.code ?? "not_found";
    return json({ ok: false, code, error: REFILL_REFUSED[code] ?? "This place can't take an Upgrade right now." });
  }

  const key = boostStripeKey();
  if (!key) return json({ ok: false, code: "stripe_unavailable", error: REFILL_REFUSED.stripe_unavailable }, 503);
  const stripe = stripeClient(key);
  const livemode = boostLivemode();

  const { data: row, error: insertErr } = await admin
    .from("premier_refill_purchases")
    .insert({
      consumer_id: userId,
      place_id: start.placeId,
      tier: start.tier,
      days: REFILL_PACK_DAYS,
      amount_cents: REFILL_PACK_CENTS[start.tier],
      currency: PREMIER_CURRENCY,
      livemode,
    })
    .select("id")
    .single();
  if (insertErr || !row) return json({ ok: false, error: `purchase_insert: ${insertErr?.message ?? "no row"}` }, 500);
  const purchaseId = row.id as string;

  try {
    const customer = await ensureCustomer(admin, stripe, userId, user.email ?? null, livemode);
    const session = await stripe(
      "POST",
      "checkout/sessions",
      refillCheckoutParams({
        customer,
        purchaseId,
        placeId: start.placeId,
        consumerId: userId,
        tier: start.tier,
        placeName: check.name ?? "Mesita place",
        returnUrl: start.returnUrl,
        nowSec: Math.floor(Date.now() / 1000),
      }),
      { idempotencyKey: `refill-checkout:${purchaseId}` },
    );
    const sessionId = String(session.id ?? "");

    // Settling finds the Checkout through this id, so a purchase without it
    // is a payment nobody can grant: retried once, then the session is
    // expired and no url is sent.
    for (let attempt = 0; attempt < 2; attempt++) {
      const { error } = await admin
        .from("premier_refill_purchases")
        .update({ stripe_checkout_session_id: sessionId, updated_at: new Date().toISOString() })
        .eq("id", purchaseId);
      if (!error) {
        const notice = refillNotice(check, start.tier);
        return json({ ok: true, url: session.url, ...(notice ? { notice } : {}) });
      }
      console.error(`[consumer-web-start-premier-refill] session_write attempt ${attempt + 1}:`, error.message);
    }
    try {
      await stripe("POST", `checkout/sessions/${encodeURIComponent(sessionId)}/expire`);
    } catch (err) {
      console.error("[consumer-web-start-premier-refill] expire_failed", JSON.stringify({ purchase_id: purchaseId, session_id: sessionId, error: String(err) }));
    }
  } catch (err) {
    console.error("[consumer-web-start-premier-refill]", err);
  }
  await admin.from("premier_refill_purchases").update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("id", purchaseId).eq("status", "open");
  const requestId = crypto.randomUUID();
  console.error("[consumer-web-start-premier-refill] checkout_failed", JSON.stringify({ request_id: requestId, purchase_id: purchaseId }));
  return json({ ok: false, error: "Couldn't open checkout. Try again.", request_id: requestId }, 502);
});
