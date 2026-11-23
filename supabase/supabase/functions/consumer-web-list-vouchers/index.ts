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
// Response: { ok: true, money: { test_mode, currency, charges_enabled, vouchers,
//                               sell, unavailable, catalog, balance, paused },
//            in_wallet?: boolean (MESITA-3582, signed in only),
//            cashback: null | { welcome_bps, regular_bps, vip_bps, cap_cents,
//                               line: welcome|regular|vip|null } }
//   MESITA-4698: the place's three cashback lines, null where Loyalty Cards
//   is Off (no cashback is earned there); `line` is the one this caller's
//   next bill falls in (null when signed out).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { getOptionalAuthedUser } from "../_shared/auth.ts";
import { isUuid } from "../_shared/place-id.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { voucherOffer } from "../_shared/vouchers.ts";
import { inWallet } from "../_shared/loyalty-cards.ts";
import { paymentsLivemode } from "../_shared/stripe.ts";
import { placeCashbackFor } from "../_shared/cashback.ts";

serveJson("consumer-web-list-vouchers", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);

  const [{ user }, placeRes] = await Promise.all([getOptionalAuthedUser(req, env), readVoucherPlace(admin, placeId)]);
  if (!placeRes.ok) return json({ ok: false, error: placeRes.error }, 500);
  if (!placeRes.place) return json({ ok: false, error: "Place not found" }, 404);

  const livemode = paymentsLivemode();
  const [money, card] = await Promise.all([
    voucherOffer(admin, placeRes.place, user?.id ?? null, livemode),
    user ? inWallet(admin, user.id, placeId, livemode) : Promise.resolve(null),
  ]);
  // in_wallet (MESITA-3582): this place's Loyalty Card is in the caller's
  // Wallet (pinned or holding entries). Absent when signed out; a failed
  // read omits it rather than claim either way.
  if (card && !card.ok) console.error("[consumer-web-list-vouchers] in_wallet", JSON.stringify({ error: card.error }));
  // MESITA-4698: cashback, where credit can be born (placeCashbackFor).
  const cashback = await placeCashbackFor(admin, {
    placeId,
    consumerId: user?.id ?? null,
    livemode,
    loyaltyCards: (money as { loyalty_cards?: boolean }).loyalty_cards === true,
    who: "consumer-web-list-vouchers",
  });
  return json({ ok: true, money: { ...money, cashback }, ...(card && card.ok ? { in_wallet: card.in_wallet } : {}) });
});
