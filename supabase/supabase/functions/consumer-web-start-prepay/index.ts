// Supabase Edge Function — consumer-web-start-prepay
//
// MESITA-3097: a guest prepays money at one place (Mesita Prepay). Opens a
// Stripe Checkout `payment` on Mesita's own account for the amount, in the
// place's currency; Mesita owes the place. Nothing is credited here: the
// balance lands when consumer-web-get-wallet sees the Checkout paid.
//
// Body: { place_id: uuid, amount_cents: integer, return_url: string }
// Response: { ok: true, url: string }
//         | 409 { ok: false, code: "prepay_off" } where the place doesn't take prepayments
//
// Stripe stays in test mode until Pato flips STRIPE_MODE and STRIPE_ALLOW_LIVE.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { boostLivemode, boostStripeKey, ensureCustomer, stripeClient } from "../_shared/boost.ts";
import { checkPrepayAmount, parsePrepayStart, prepayCheckoutParams, readPrepayPlace } from "../_shared/wallet.ts";

serveJson("consumer-web-start-prepay", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const userId = authRes.user.id;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const parsed = parsePrepayStart(bodyRes.body);
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);
  const start = parsed.start;

  const admin = adminClient(envRes.env);
  const placeRes = await readPrepayPlace(admin, start.placeId);
  if (!placeRes.ok) return json({ ok: false, error: placeRes.error }, 500);
  const place = placeRes.place;
  if (!place || place.state !== "active") return json({ ok: false, error: "This place can't take prepayments" }, 404);
  if (place.prepay_enabled !== true) {
    return json({ ok: false, code: "prepay_off", error: "This place doesn't take prepayments yet" }, 409);
  }
  const currency = String(place.currency ?? "").toLowerCase();
  const amountError = checkPrepayAmount(start.amountCents, currency);
  if (amountError) return json({ ok: false, error: amountError }, 400);

  const key = boostStripeKey();
  if (!key) return json({ ok: false, error: "Payments are not available right now" }, 503);
  const stripe = stripeClient(key);
  const livemode = boostLivemode();

  const { data: row, error: insertErr } = await admin
    .from("wallet_purchases")
    .insert({
      consumer_id: userId,
      place_id: start.placeId,
      amount_cents: start.amountCents,
      currency,
      livemode,
    })
    .select("id")
    .single();
  if (insertErr || !row) return json({ ok: false, error: `purchase_insert: ${insertErr?.message ?? "no row"}` }, 500);
  const purchaseId = row.id as string;

  try {
    const customer = await ensureCustomer(admin, stripe, userId, authRes.user.email ?? null, livemode);
    const session = await stripe(
      "POST",
      "checkout/sessions",
      prepayCheckoutParams({
        customer,
        purchaseId,
        placeId: start.placeId,
        consumerId: userId,
        amountCents: start.amountCents,
        currency,
        placeName: String(place.name ?? "Mesita place"),
        returnUrl: start.returnUrl,
        nowSec: Math.floor(Date.now() / 1000),
      }),
      { idempotencyKey: `wallet-checkout:${purchaseId}` },
    );
    const sessionId = String(session.id ?? "");

    // Settling finds the Checkout through this id, so a purchase without it
    // is a payment nobody can credit: retried once, then the session is
    // expired and no url is sent.
    for (let attempt = 0; attempt < 2; attempt++) {
      const { error } = await admin
        .from("wallet_purchases")
        .update({ stripe_checkout_session_id: sessionId, updated_at: new Date().toISOString() })
        .eq("id", purchaseId);
      if (!error) return json({ ok: true, url: session.url });
      console.error(`[consumer-web-start-prepay] session_write attempt ${attempt + 1}:`, error.message);
    }
    try {
      await stripe("POST", `checkout/sessions/${encodeURIComponent(sessionId)}/expire`);
    } catch (err) {
      console.error("[consumer-web-start-prepay] expire_failed", JSON.stringify({ purchase_id: purchaseId, session_id: sessionId, error: String(err) }));
    }
  } catch (err) {
    console.error("[consumer-web-start-prepay]", err);
  }
  await admin.from("wallet_purchases").update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("id", purchaseId).eq("status", "open");
  return json({ ok: false, error: "Couldn't open checkout. Try again." }, 502);
});
