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
// Body: { place_id: uuid, voucher: voucher_200|voucher_1000|voucher_welcome|…,
//         request_id: uuid (one per tap; a retry carries the same),
//         return_url: the place page (a Mesita address),
//         card_pm_id?: pm_… (a saved card) }
// Response: { ok: true, url, purchase_id }
//   with card_pm_id: { ok: true, purchase_id, card: { status: succeeded |
//   processing | requires_action, payment_intent_id, client_secret?,
//   stripe_account?, publishable_key? } }
//   404 card_not_found (not the guest's saved card) · 409 card_declined
//   (+decline_code) | card_needs_auth | closed · 502 card_failed
//   401 sign_in · 404 place · 409 no_account | currency_mismatch | paused |
//   not_available | not_yet | needs_card_payments | needs_instagram |
//   few_followers (Story: 1,000 Instagram followers or fewer, MESITA-3507) |
//   not_vip (VIP: the guest is not of the VIP class, MESITA-3550) |
//   welcome_used | below_minimum | place_cap (MESITA-3305: the test-mode
//   cap on a place's outstanding credit) | in_progress (+url: a second
//   Welcome buy while the first one's Checkout is open) · 502 checkout_failed

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { readCustomer } from "../_shared/boost.ts";
import { isUuid } from "../_shared/place-id.ts";
import { MONEY_VOUCHER_KEYS, type MoneyVoucherKey } from "../_shared/money-state.ts";
import { readAccount } from "../_shared/payments.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { isPaymentMethodId, ownCard } from "../_shared/tab-card.ts";
import { openVoucherCard, readRequestRow, runVoucherCard } from "../_shared/voucher-card.ts";
import { purchaseStore } from "../_shared/purchase-pi.ts";
import { buyRefusal, mexicoToday, openVoucherCheckout, readStoryGuest, readVipGuest, storyRefusal, vipRefusal, voucherOffer } from "../_shared/vouchers.ts";
import { isAllowedReturnUrl, paymentsLivemode, paymentsPublishableKey, paymentsStripeKey, stripeClient } from "../_shared/stripe.ts";

serveJson("consumer-web-buy-voucher", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const userId = user.id;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { place_id: placeId, voucher, request_id: requestId, return_url: returnUrl, card_pm_id: cardPmId } = bodyRes.body;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  if (typeof voucher !== "string" || !(MONEY_VOUCHER_KEYS as readonly string[]).includes(voucher)) {
    return json({ ok: false, error: "voucher must be one of the catalog's keys" }, 400);
  }
  if (!isUuid(requestId)) return json({ ok: false, error: "request_id must be a uuid" }, 400);
  if (typeof returnUrl !== "string" || !isAllowedReturnUrl(returnUrl)) {
    return json({ ok: false, error: "return_url is not a Mesita address" }, 400);
  }
  const withCard = cardPmId !== undefined && cardPmId !== null;
  if (withCard && !isPaymentMethodId(cardPmId)) {
    return json({ ok: false, code: "card_not_found", error: "That card is not saved on your account" }, 404);
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
  if (withCard) {
    const replay = await readRequestRow(admin, userId, requestId);
    if (replay) {
      const key = paymentsStripeKey();
      if (!key) return json({ ok: false, error: "Payments are not available right now" }, 503);
      const stripe = stripeClient(key);
      const customer = await readCustomer(admin, userId, livemode);
      if (!customer || !(await ownCard(stripe, customer, cardPmId as string))) {
        return json({ ok: false, code: "card_not_found", error: "That card is not saved on your account" }, 404);
      }
      if (replay.place_id !== placeId || replay.voucher !== voucher || replay.stripe_checkout_session_id) {
        return json({ ok: false, code: "in_progress", error: "Your purchase is already on its way." }, 409);
      }
      const res = await runVoucherCard(purchaseStore(admin), stripe, {
        purchaseId: replay.id,
        customer,
        platformPm: cardPmId as string,
        currency: replay.currency,
        placeId,
        placeName: place.name ?? null,
        consumerId: userId,
        voucher: voucher as MoneyVoucherKey,
        publishableKey: paymentsPublishableKey(livemode),
        nowMs: Date.now(),
      });
      if (!res.ok) return json({ ok: false, code: res.code, error: res.error, ...(res.detail ?? {}) }, res.status);
      return json({ ok: true, purchase_id: res.purchase_id, card: res.card });
    }
  }

  const [offer, account] = await Promise.all([voucherOffer(admin, place, userId, livemode), readAccount(admin, placeId)]);
  const refusal = buyRefusal(offer, voucher as MoneyVoucherKey, account);
  if (refusal) return json({ ok: false, code: refusal.code, error: refusal.error }, refusal.status);
  if (!account) return json({ ok: false, code: "no_account", error: "This place has not connected payments yet" }, 409);
  // Story's own gate: the guest's Instagram above the follower floor (MESITA-3507).
  if (voucher === "voucher_story") {
    const story = storyRefusal(voucher, await readStoryGuest(admin, userId));
    if (story) return json({ ok: false, code: story.code, error: story.error }, story.status);
  }
  // VIP's own gate: the VIP class (MESITA-3550); one each visit is the offer's.
  if (voucher === "voucher_vip") {
    const vip = vipRefusal(voucher, await readVipGuest(admin, userId), mexicoToday(new Date()));
    if (vip) return json({ ok: false, code: vip.code, error: vip.error }, vip.status);
  }

  const key = paymentsStripeKey();
  if (!key) return json({ ok: false, error: "Payments are not available right now" }, 503);

  const stripe = stripeClient(key);

  if (withCard) {
    // A saved card: it must be on this guest's own customer, never an id
    // the browser made up.
    const customer = await readCustomer(admin, userId, livemode);
    if (!customer || !(await ownCard(stripe, customer, cardPmId as string))) {
      return json({ ok: false, code: "card_not_found", error: "That card is not saved on your account" }, 404);
    }
    const card = await openVoucherCard(admin, stripe, {
      consumerId: userId,
      place,
      account,
      voucher: voucher as MoneyVoucherKey,
      currency: offer.currency,
      requestId,
      livemode,
      customer,
      platformPm: cardPmId as string,
      publishableKey: paymentsPublishableKey(livemode),
      nowMs: Date.now(),
    });
    if (!card.ok) {
      const detail = "detail" in card && card.detail ? card.detail : {};
      console.log("[consumer-web-buy-voucher]", JSON.stringify({ outcome: card.code, place_id: placeId, voucher }));
      return json({ ok: false, code: card.code, error: card.error, ...detail }, card.status);
    }
    console.log("[consumer-web-buy-voucher]", JSON.stringify({ outcome: card.card.status, place_id: placeId, voucher, purchase_id: card.purchase_id }));
    return json({ ok: true, purchase_id: card.purchase_id, card: card.card });
  }

  const res = await openVoucherCheckout(admin, stripe, {
    consumerId: userId,
    email: user.email ?? null,
    place,
    account,
    voucher: voucher as MoneyVoucherKey,
    currency: offer.currency,
    requestId,
    returnUrl,
    livemode,
    nowSec: Math.floor(Date.now() / 1000),
  });
  if (!res.ok) return json({ ok: false, code: res.code, error: res.error, ...(res.url ? { url: res.url } : {}) }, res.status);
  return json({ ok: true, url: res.url, purchase_id: res.purchase_id });
});
