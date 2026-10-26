// Supabase Edge Function — consumer-web-start-spotlight
//
// MESITA-1998 (Pato, 2026-10-25): anyone backs a place's Spotlight from its
// three dots. Opens one Stripe Checkout (subscription) for the signed-in
// guest and records the backing as `open`; consumer-web-get-spotlight
// confirms it when Checkout sends the guest back.
//
// Body: { place_id: uuid, tier: "spotlight" | "spotlight_plus",
//         interval?: "month" | "year", show_name?: boolean,
//         return_url: string }   return_url: the place screen (_shared/spotlight.ts)
// Response: { ok: true, url }   the Checkout page
//
// Many guests may back one place; one guest may hold several backings.
// Stripe stays in test mode until Pato flips STRIPE_MODE and STRIPE_ALLOW_LIVE.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import {
  checkoutParams,
  parseSpotlightStart,
  readSpotlightPlace,
  SPOTLIGHT_CURRENCY,
  spotlightAmountCents,
  spotlightStripeKey,
  stripeClient,
} from "../_shared/spotlight.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const parsed = parseSpotlightStart(bodyRes.body);
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);
  const start = parsed.start;

  const key = spotlightStripeKey();
  if (!key) return json({ ok: false, error: "Payments are not available right now" }, 503);

  const admin = adminClient(envRes.env);
  const placeRes = await readSpotlightPlace(admin, start.placeId);
  if (!placeRes.ok) return json({ ok: false, error: placeRes.error }, 500);
  const place = placeRes.place;
  if (!place || place.state !== "active") {
    return json({ ok: false, error: "This place can't be backed" }, 404);
  }

  const { data: row, error: insErr } = await admin
    .from("place_backings")
    .insert({
      place_id: start.placeId,
      consumer_id: authRes.user.id,
      tier: start.tier,
      billing_interval: start.interval,
      amount_cents: spotlightAmountCents(start.tier, start.interval),
      currency: SPOTLIGHT_CURRENCY,
      show_name: start.showName,
      status: "open",
    })
    .select("id")
    .single();
  if (insErr || !row) {
    return json({ ok: false, error: `backing_insert: ${insErr?.message ?? "no row"}` }, 500);
  }

  try {
    const stripe = stripeClient(key);
    const session = await stripe(
      "POST",
      "checkout/sessions",
      checkoutParams(start, {
        backingId: row.id,
        consumerId: authRes.user.id,
        placeName: String(place.name ?? "Mesita place"),
      }),
    );
    await admin
      .from("place_backings")
      .update({ stripe_checkout_session_id: session.id, livemode: session.livemode === true })
      .eq("id", row.id);
    return json({ ok: true, url: session.url });
  } catch (err) {
    await admin.from("place_backings").delete().eq("id", row.id);
    console.error("[consumer-web-start-spotlight]", err);
    return json({ ok: false, error: "Couldn't open checkout. Try again." }, 502);
  }
});
