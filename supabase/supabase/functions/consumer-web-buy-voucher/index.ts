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
// Body: { place_id: uuid, voucher: voucher_200|voucher_1000|voucher_welcome|…,
//         request_id: uuid (one per tap; a retry carries the same),
//         return_url: the place page (a Mesita address) }
// Response: { ok: true, url, purchase_id }
//   401 sign_in · 404 place · 409 no_account | currency_mismatch | paused |
//   not_available | not_yet | needs_card_payments | needs_instagram |
//   few_followers (Story: 1,000 Instagram followers or fewer, MESITA-3507) |
//   not_vip (VIP: the guest is not of the VIP class, MESITA-3550) |
//   welcome_used | below_minimum | place_cap (MESITA-3305: the test-mode
//   cap on a place's outstanding credit) | in_progress (+url: a second
//   Welcome buy while the first one's Checkout is open) · 502 checkout_failed

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { paymentsLivemode, paymentsStripeKey, isAllowedReturnUrl, stripeClient } from "../_shared/boost.ts";
import { isUuid } from "../_shared/place-id.ts";
import { MONEY_VOUCHER_KEYS, type MoneyVoucherKey } from "../_shared/money-state.ts";
import { readAccount } from "../_shared/payments.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { buyRefusal, mexicoToday, openVoucherCheckout, readStoryGuest, readVipGuest, storyRefusal, vipRefusal, voucherOffer } from "../_shared/vouchers.ts";

serveJson("consumer-web-buy-voucher", async (req) => {
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
  const { place_id: placeId, voucher, request_id: requestId, return_url: returnUrl } = bodyRes.body;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  if (typeof voucher !== "string" || !(MONEY_VOUCHER_KEYS as readonly string[]).includes(voucher)) {
    return json({ ok: false, error: "voucher must be one of the catalog's keys" }, 400);
  }
  if (!isUuid(requestId)) return json({ ok: false, error: "request_id must be a uuid" }, 400);
  if (typeof returnUrl !== "string" || !isAllowedReturnUrl(returnUrl)) {
    return json({ ok: false, error: "return_url is not a Mesita address" }, 400);
  }

  const admin = adminClient(envRes.env);
  const placeRes = await readVoucherPlace(admin, placeId);
  if (!placeRes.ok) return json({ ok: false, error: placeRes.error }, 500);
  const place = placeRes.place;
  if (!place || place.state !== "active") return json({ ok: false, error: "This place can't sell vouchers" }, 404);

  const livemode = paymentsLivemode();
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

  const res = await openVoucherCheckout(admin, stripeClient(key), {
    consumerId: userId,
    email: authRes.user.email ?? null,
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
