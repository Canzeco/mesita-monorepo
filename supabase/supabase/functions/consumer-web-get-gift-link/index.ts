// Supabase Edge Function — consumer-web-get-gift-link
//
// MESITA-4390 (Pato, 2026-11-18: "if i click to create gift, but i already
// have gift oepns, like show the prev list as a prev step … select current
// and copy or just create new gift"): the sender of an OPEN gift gets its
// link's key again, opened from wallet_gifts.token_sealed
// (_shared/gift-seal.ts), so Send Gift can show the same link once more. Only
// the sender, only while nobody took it and it was not taken back, only in
// this payments mode. A gift sent before MESITA-4390 has no sealed key:
// `token: null`, and it can only be taken back.
//
// Body: { gift_id: uuid }
// Response: { ok: true, gift_id, amount_cents, currency, place_id, token: string | null }
//   400 · 401 sign_in · 404 gone (not the caller's, not open, other mode) · 500

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { isGiftToken } from "../_shared/gift.ts";
import { openGiftToken } from "../_shared/gift-seal.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";

serveJson("consumer-web-get-gift-link", async (req) => {
  const ctx = await requireConsumerRequest(req, { signIn: "Sign in to see your gift" });
  if (ctx instanceof Response) return ctx;
  const { admin, user, env } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const giftId = bodyRes.body.gift_id;
  if (!isUuid(giftId)) return json({ ok: false, error: "gift_id must be a uuid" }, 400);

  const { data, error } = await admin
    .from("wallet_gifts")
    .select("id, place_id, amount_cents, currency, status, livemode, token_sealed")
    .eq("id", giftId)
    .eq("sender_id", user.id)
    .maybeSingle();
  if (error) return json({ ok: false, error: `gift: ${error.message}` }, 500);
  const gift = data as {
    id: string; place_id: string; amount_cents: number; currency: string;
    status: string; livemode: boolean; token_sealed: string | null;
  } | null;
  if (!gift || gift.status !== "open" || gift.livemode !== paymentsLivemode()) {
    return json({ ok: false, code: "gone", error: "That gift isn't open" }, 404);
  }

  const opened = await openGiftToken(gift.token_sealed, env.serviceKey);
  const token = isGiftToken(opened) ? opened : null;
  if (gift.token_sealed && !token) console.error("[consumer-web-get-gift-link] a sealed key did not open");
  const res = json({
    ok: true,
    gift_id: gift.id,
    place_id: gift.place_id,
    amount_cents: gift.amount_cents,
    currency: gift.currency,
    token,
  });
  res.headers.set("Cache-Control", "no-store");
  return res;
});
