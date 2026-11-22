// Supabase Edge Function — consumer-web-buy-voucher
//
// MESITA-3303: a signed-in guest buys one voucher at a place. One Stripe
// Checkout on the place's own connected account (a direct charge; Mesita's
// fee is the application fee), one `opening` row in wallet_purchases under
// the guest's request_id, then the row reads `open` with its session. The
// credit lands when Stripe says paid: on the next Wallet read today, on the
// webhook receiver or the cron from W2b. Stripe stays in test mode until
// Pato flips it.
//
// MESITA-3552: with `card_pm_id` (a card saved on the guest's own platform
// customer, payments mode) there is no Checkout: the card is copied to the
// place's account and charged there with a PaymentIntent, in one tap
// (_shared/voucher-card.ts). Every gate below runs the same either way.
//
// MESITA-3841: a BASKET. `items: [{ voucher, qty }]` buys several vouchers
// with ONE charge, all or nothing (the old `voucher` field is a basket of
// one). Small, Medium and Big take qty 1..5; Welcome and VIP at most 1. Every gate
// runs per voucher; the place cap counts the whole basket. One row per unit:
// the lead under request_id, the others pointing to it (basket_lead_id).
//
// MESITA-4065: a SAVED CARD IS REQUIRED. The Stripe Checkout branch is gone:
// the Offers page is the checkout (pick vouchers, pick a card, Pay) and a
// guest with no card adds one in the app first. Without `card_pm_id` the
// answer is 409 card_required; an old bundle's `return_url` is ignored.
// Validation order: body shape (400 bad_body + field), then the card gate
// (voucherBuyGate), then the place and voucher gates. A replay of the same
// request_id never opens a second PaymentIntent.
//
// Body: { place_id: uuid, voucher: voucher_200|voucher_1000|voucher_welcome|…,
//         items?: [{ voucher, qty }] (in place of voucher),
//         request_id: uuid (one per basket and card; every retry after an
//           unknown outcome carries the same),
//         card_pm_id: pm_… (a card saved on the guest's own customer) }
// Response: { ok: true, purchase_id, card: { status: succeeded | processing |
//   requires_action, payment_intent_id, client_secret?, stripe_account?,
//   publishable_key? } }
// Refusals (stable `code`):
//   400 bad_body (+field) · 401 sign_in · 409 card_required (add a card in the app)
//   404 card_not_found (not the guest's saved card: list the cards again)
//   409 card_declined (+decline_code) | card_needs_auth | closed | in_progress
//   404 place · 409 no_account | currency_mismatch | paused | not_available |
//   not_yet | needs_card_payments | needs_instagram | voucher_retired |
//   not_vip | welcome_used | below_minimum | place_cap (MESITA-3947)
//   502 card_failed | stripe_unreachable · 503 payments not configured
// The client secret of a bank check is returned, never logged.
//
// MESITA-4384: EXPRESS PAY (Apple Pay / Google Pay through Stripe's Express
// Checkout Element; "express" never means a Connect Express account). The
// body carries `express: true` INSTEAD of `card_pm_id` (both, or a non-bool
// express → 400 bad_body field=express). The same gates run; then the rows
// open with pay_source 'express' and ONE PaymentIntent on the place's
// account for the server's own amount, card only, with NO payment method and
// NO confirm. The browser confirms it with the client secret, then sends the
// SAME body (same request_id) again to settle; the replay branches on the
// lead row's pay_source (an express replay needs no card) and never cancels
// a PaymentIntent still waiting for the wallet (expressStepOf).
//   Example (open, and the settle re-call):
//     { "place_id": "…", "items": [{ "voucher": "voucher_1000", "qty": 1 }],
//       "request_id": "…", "express": true }
//   Response: { ok: true, purchase_id, express: { status:
//     requires_payment_method | requires_action, payment_intent_id,
//     client_secret, stripe_account, publishable_key, amount_cents (Stripe's
//     units), decline_code?, error? } }, or once paid { status: succeeded,
//     payment_intent_id, pay_with: apple_pay | google_pay | express } or
//     { status: processing, payment_intent_id }.
//   Refusals beyond the card path's: 409 disabled (the kill switch
//   app_config.money_config.express_wallets is []), 409 closed (cancelled or
//   timed out: start over), 503 payments_unavailable.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { readCustomer } from "../_shared/boost.ts";
import { isUuid } from "../_shared/place-id.ts";
import { readAccount } from "../_shared/payments.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { ownCard } from "../_shared/tab-card.ts";
import { expressBodyGate, openVoucherCard, readFollowerVouchers, readRequestRow, runVoucherCard, voucherBuyGate } from "../_shared/voucher-card.ts";
import { readMoneyConfig } from "../_shared/money-config.ts";
import { purchaseStore } from "../_shared/purchase-pi.ts";
import {
  basketUnits,
  buyRefusal,
  parseBasket,
  sameUnits,
  readVipGuest,
  vipRefusal,
  voucherOffer,
} from "../_shared/vouchers.ts";
import { paymentsLivemode, paymentsPublishableKey, paymentsStripeKey, stripeClient } from "../_shared/stripe.ts";

serveJson("consumer-web-buy-voucher", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const userId = user.id;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { place_id: placeId, request_id: requestId } = bodyRes.body;
  if (!isUuid(placeId)) return json({ ok: false, code: "bad_body", field: "place_id", error: "place_id must be a Mesita place id" }, 400);
  const basket = parseBasket(bodyRes.body);
  if (!basket.ok) {
    if (basket.code === "voucher_retired") return json({ ok: false, code: basket.code, error: basket.error }, 409);
    return json({ ok: false, code: "bad_body", field: "items", error: basket.error }, 400);
  }
  // One row per unit, the lead first (Welcome leads when it is in it).
  const units = basketUnits(basket.items);
  const voucher = units[0];
  const followers = units.slice(1);
  const kinds = basket.items.map((i) => i.voucher);
  if (!isUuid(requestId)) return json({ ok: false, code: "bad_body", field: "request_id", error: "request_id must be a uuid" }, 400);
  // MESITA-4384: express pay or a saved card, never both.
  const how = expressBodyGate(bodyRes.body);
  if (!how.ok) return json({ ok: false, code: how.code, field: how.field, error: how.error }, how.status);
  const express = how.express;
  // A saved card is required (MESITA-4065) unless the guest pays express.
  let cardPmId = "";
  if (!express) {
    const gate = voucherBuyGate(bodyRes.body);
    if (!gate.ok) return json({ ok: false, code: gate.code, error: gate.error }, gate.status);
    cardPmId = gate.cardPmId;
  }

  const placeRes = await readVoucherPlace(admin, placeId);
  if (!placeRes.ok) return json({ ok: false, error: placeRes.error }, 500);
  const place = placeRes.place;
  if (!place || place.state !== "active") return json({ ok: false, error: "This place can't sell vouchers" }, 404);

  const livemode = paymentsLivemode();

  // The same saved-card tap again (the screen asks once Stripe.js finished
  // a bank check, or after a lost answer): the gates ran when its row was
  // opened, and they would now count that very row (Welcome used, one per
  // visit), so it only reads where its PaymentIntent stands.
  {
    const replay = await readRequestRow(admin, userId, requestId);
    if (replay) {
      const key = paymentsStripeKey();
      if (!key) return json({ ok: false, error: "Payments are not available right now" }, 503);
      const stripe = stripeClient(key);
      // MESITA-4384: the row's pay_source decides; an express replay needs no card.
      const replayExpress = replay.pay_source === "express";
      if (replayExpress !== express) {
        return json({ ok: false, code: "in_progress", error: "Your purchase is already on its way." }, 409);
      }
      let customer: string | null = null;
      if (!replayExpress) {
        customer = await readCustomer(admin, userId, livemode);
        if (!customer || !(await ownCard(stripe, customer, cardPmId))) {
          return json({ ok: false, code: "card_not_found", error: "That card is not saved on your account" }, 404);
        }
      }
      if (
        replay.place_id !== placeId || replay.voucher !== voucher || replay.stripe_checkout_session_id ||
        !sameUnits(await readFollowerVouchers(admin, replay.id), followers)
      ) {
        return json({ ok: false, code: "in_progress", error: "Your purchase is already on its way." }, 409);
      }
      const res = await runVoucherCard(purchaseStore(admin), stripe, {
        purchaseId: replay.id,
        ...(customer ? { customer, platformPm: cardPmId } : {}),
        currency: replay.currency,
        placeId,
        placeName: place.name ?? null,
        consumerId: userId,
        voucher,
        publishableKey: paymentsPublishableKey(livemode),
        nowMs: Date.now(),
      });
      if (!res.ok) return json({ ok: false, code: res.code, error: res.error, ...(res.detail ?? {}) }, res.status);
      if ("express" in res) {
        console.log("[consumer-web-buy-voucher]", JSON.stringify({ outcome: res.express.status, place_id: placeId, voucher, purchase_id: res.purchase_id, express: true, replay: true }));
        return json({ ok: true, purchase_id: res.purchase_id, express: res.express });
      }
      return json({ ok: true, purchase_id: res.purchase_id, card: res.card });
    }
  }

  // MESITA-4384: the kill switch stops a sheet that is already open too.
  if (express && (await readMoneyConfig(admin)).express_wallets.length === 0) {
    return json({ ok: false, code: "disabled", error: "Apple Pay and Google Pay are off right now. Pay with a card." }, 409);
  }
  const [offer, account] = await Promise.all([voucherOffer(admin, place, userId, livemode), readAccount(admin, placeId)]);
  // Every voucher in the basket passes its own gates (MESITA-3841).
  for (const k of kinds) {
    const refusal = buyRefusal(offer, k, account);
    if (refusal) return json({ ok: false, code: refusal.code, error: refusal.error }, refusal.status);
  }
  if (!account) return json({ ok: false, code: "no_account", error: "This place has not connected payments yet" }, 409);
  const key = paymentsStripeKey();
  if (!key) return json({ ok: false, error: "Payments are not available right now" }, 503);

  const stripe = stripeClient(key);

  // VIP's own gate: the VIP class (MESITA-4640) and a follower count read
  // within the hour (MESITA-4659, 409 vip_recheck); one each visit is the offer's.
  if (kinds.includes("voucher_vip")) {
    const vip = vipRefusal("voucher_vip", await readVipGuest(admin, userId), new Date());
    if (vip) {
      return json({ ok: false, code: vip.code, error: vip.error, followers: vip.followers }, vip.status);
    }
  }

  {
    // A saved card: it must be on this guest's own customer, never an id
    // the browser made up. Express pay has no card yet (the wallet brings it).
    let source: { kind: "card"; customer: string; platformPm: string } | { kind: "express" } = { kind: "express" };
    if (!express) {
      const customer = await readCustomer(admin, userId, livemode);
      if (!customer || !(await ownCard(stripe, customer, cardPmId))) {
        return json({ ok: false, code: "card_not_found", error: "That card is not saved on your account" }, 404);
      }
      source = { kind: "card", customer, platformPm: cardPmId };
    }
    const card = await openVoucherCard(admin, stripe, {
      consumerId: userId,
      place,
      account,
      voucher,
      followers,
      currency: offer.currency,
      requestId,
      livemode,
      source,
      publishableKey: paymentsPublishableKey(livemode),
      nowMs: Date.now(),
    });
    if (!card.ok) {
      const detail = "detail" in card && card.detail ? card.detail : {};
      console.log("[consumer-web-buy-voucher]", JSON.stringify({ outcome: card.code, place_id: placeId, voucher, units: units.length }));
      return json({ ok: false, code: card.code, error: card.error, ...detail }, card.status);
    }
    if ("express" in card) {
      console.log("[consumer-web-buy-voucher]", JSON.stringify({ outcome: card.express.status, place_id: placeId, voucher, units: units.length, purchase_id: card.purchase_id, express: true }));
      return json({ ok: true, purchase_id: card.purchase_id, express: card.express });
    }
    console.log("[consumer-web-buy-voucher]", JSON.stringify({ outcome: card.card.status, place_id: placeId, voucher, units: units.length, purchase_id: card.purchase_id }));
    return json({ ok: true, purchase_id: card.purchase_id, card: card.card });
  }
});
