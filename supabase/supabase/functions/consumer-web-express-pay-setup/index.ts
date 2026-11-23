// Supabase Edge Function — consumer-web-express-pay-setup
//
// MESITA-4384: what the Apple Pay / Google Pay button needs before it draws
// on the Offers sheet (Stripe's Express Checkout Element in deferred mode;
// "express" never means a Connect Express account). Runs the place and
// voucher gates the buy runs, the kill switch, and the payment method
// domain check; writes NO purchase rows (only the account's domain stamps).
// The buy itself is consumer-web-buy-voucher with `express: true`.
//
// Body: { place_id: uuid, voucher | items: [{ voucher, qty }] }
//   Example: { "place_id": "…", "items": [{ "voucher": "voucher_1000", "qty": 1 }] }
// Response 200:
//   { ok: true, available: true, wallets: ["apple_pay", "google_pay"],
//     publishable_key, stripe_account, amount_cents (Stripe's units, the
//     PaymentIntent's own toStripeAmount), currency, country, label }
//   { ok: true, available: false, code } — a business refusal; the sheet
//     shows no express slot and the card path stays as today. Codes: the
//     buy's (no_account, currency_mismatch, paused, not_available, not_yet,
//     needs_card_payments, needs_instagram, not_vip, needs_visit,
//     welcome_used, below_minimum, voucher_retired) plus disabled (the kill switch
//     app_config.money_config.express_wallets is []) and domains_inactive
//     (mesita.ai is not an active wallet domain on the place's account, or
//     the 1.5 s check timed out).
// Misuse: 400 bad_body (+field) · 401 sign_in · 404 place · 503 payments not
//   configured.
//
// MESITA-4708: vouchers only. The bill mode (MESITA-4386, `bill`) is gone
// with the card part of a bill: `bill` answers { ok: true, available: false,
// code: "cards_off" }.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { readAccount } from "../_shared/payments.ts";
import { readVoucherPlace } from "../_shared/wallet.ts";
import { readMoneyConfig } from "../_shared/money-config.ts";
import { basketUnits, buyRefusal, catalogLines, parseBasket, readVipGuest, vipRefusal, voucherName, voucherOffer } from "../_shared/vouchers.ts";
import { toStripeAmount } from "../_shared/money.ts";
import { walletDomainsForSetup } from "../_shared/pm-domains.ts";
import { expressLabel, expressWalletsFor } from "../_shared/express-pay.ts";
import { paymentsLivemode, paymentsPublishableKey, paymentsStripeKey, stripeClient } from "../_shared/stripe.ts";

serveJson("consumer-web-express-pay-setup", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { place_id: placeId } = bodyRes.body;
  if (!isUuid(placeId)) return json({ ok: false, code: "bad_body", field: "place_id", error: "place_id must be a Mesita place id" }, 400);
  if (bodyRes.body.bill !== undefined) return json({ ok: true, available: false, code: "cards_off" });
  const basket = parseBasket(bodyRes.body);
  if (!basket.ok) {
    if (basket.code === "voucher_retired") return json({ ok: true, available: false, code: basket.code });
    return json({ ok: false, code: "bad_body", field: "items", error: basket.error }, 400);
  }
  const units = basketUnits(basket.items);
  const kinds = basket.items.map((i) => i.voucher);
  const no = (code: string) => json({ ok: true, available: false, code });

  const config = await readMoneyConfig(admin);
  if (config.express_wallets.length === 0) return no("disabled");

  const placeRes = await readVoucherPlace(admin, placeId);
  if (!placeRes.ok) return json({ ok: false, error: placeRes.error }, 500);
  const place = placeRes.place;
  if (!place || place.state !== "active") return json({ ok: false, error: "This place can't sell vouchers" }, 404);

  const livemode = paymentsLivemode();
  const [offer, account] = await Promise.all([voucherOffer(admin, place, user.id, livemode), readAccount(admin, placeId)]);
  for (const k of kinds) {
    const refusal = buyRefusal(offer, k, account);
    if (refusal) return no(refusal.code);
  }
  // No account that can charge: refused before any Stripe call.
  if (!account || !account.charges_enabled || account.livemode !== livemode) return no("no_account");
  // VIP's own gate, the same as the buy door's (MESITA-4640): the class and a
  // follower count read within the hour (MESITA-4659: not_vip or vip_recheck).
  if (kinds.includes("voucher_vip")) {
    const vip = vipRefusal("voucher_vip", await readVipGuest(admin, user.id), new Date(), !livemode);
    if (vip) return no(vip.code);
  }

  const key = paymentsStripeKey();
  const publishableKey = paymentsPublishableKey(livemode);
  if (!key || !publishableKey) return json({ ok: false, error: "Payments are not available right now" }, 503);

  const domains = await walletDomainsForSetup(admin, stripeClient(key), {
    placeId,
    accountId: account.stripe_account_id,
    livemode,
    nowMs: Date.now(),
  });
  const wallets = expressWalletsFor(config.express_wallets, domains);
  if (wallets.length === 0) return no("domains_inactive");

  const lines = catalogLines(offer.currency);
  const totalCents = units.reduce((sum, k) => sum + lines[k].price_cents, 0);
  const country = (account.account_country ?? "MX").toUpperCase();
  return json({
    ok: true,
    available: true,
    wallets,
    publishable_key: publishableKey,
    stripe_account: account.stripe_account_id,
    amount_cents: toStripeAmount(totalCents, offer.currency),
    currency: offer.currency,
    country,
    label: expressLabel(units.length > 1 ? `${units.length} vouchers` : voucherName(units[0], offer.currency), place.name ?? null),
  });
});
