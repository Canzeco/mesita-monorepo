// Supabase Edge Function — consumer-web-start-boost
//
// MESITA-1998 (Pato, 2026-10-25): anyone backs a place's Boost from its
// three dots. Opens one Stripe Checkout (subscription) for the signed-in
// guest and records the backing as `open`; consumer-web-get-boost
// confirms it when Checkout sends the guest back.
//
// Body: { place_id: uuid, tier: "boost_2x" | "boost_5x" | "boost_10x",
//         interval?: "month" | "year",
//         return_url: string }   return_url: the place screen (_shared/boost.ts)
// Response: { ok: true, url }   the Checkout page
//
// Backers are anonymous (MESITA-2928): no name is asked for or stored.
// Many guests may back one place; one guest may hold several backings.
// Stripe stays in test mode until Pato flips STRIPE_MODE and STRIPE_ALLOW_LIVE.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import {
  openBackingCheckout,
  parseBoostStart,
  readBoostPlace,
  BOOST_CURRENCY,
  boostAmountCents,
  boostStripeKey,
  stripeClient,
} from "../_shared/boost.ts";

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
  const parsed = parseBoostStart(bodyRes.body);
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);
  const start = parsed.start;

  const key = boostStripeKey();
  if (!key) return json({ ok: false, error: "Payments are not available right now" }, 503);

  const admin = adminClient(envRes.env);
  const placeRes = await readBoostPlace(admin, start.placeId);
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
      amount_cents: boostAmountCents(start.tier, start.interval),
      currency: BOOST_CURRENCY,
      status: "open",
    })
    .select("id")
    .single();
  if (insErr || !row) {
    return json({ ok: false, error: `backing_insert: ${insErr?.message ?? "no row"}` }, 500);
  }

  const reply = await openBackingCheckout(admin, stripeClient(key), start, {
    backingId: row.id,
    consumerId: authRes.user.id,
    placeName: String(place.name ?? "Mesita place"),
  });
  return json(reply.body, reply.status);
});
