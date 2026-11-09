// Supabase Edge Function — consumer-web-list-vouchers
//
// MESITA-3303: what one place offers the caller right now: which vouchers
// are for sale (the owner's switch on, the place's Stripe account able to
// charge, sales not paused), why the others are not, the catalog's prices
// and bonuses, and the caller's credit at the place (Available, Pending,
// Held). The place screen's Vouchers tab reads it; a signed-out caller gets
// the offer with no balance.
//
// Body: { place_id: uuid }
// Response: { ok: true, money: { test_mode, currency, charges_enabled, cashback, vouchers,
//                               sell, unavailable, catalog, balance, paused } }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getOptionalAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { paymentsLivemode } from "../_shared/boost.ts";
import { isUuid } from "../_shared/place-id.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { voucherOffer } from "../_shared/vouchers.ts";

serveJson("consumer-web-list-vouchers", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);

  const admin = adminClient(envRes.env);
  const [{ user }, placeRes] = await Promise.all([getOptionalAuthedUser(req, envRes.env), readVoucherPlace(admin, placeId)]);
  if (!placeRes.ok) return json({ ok: false, error: placeRes.error }, 500);
  if (!placeRes.place) return json({ ok: false, error: "Place not found" }, 404);

  const money = await voucherOffer(admin, placeRes.place, user?.id ?? null, paymentsLivemode());
  return json({ ok: true, money });
});
