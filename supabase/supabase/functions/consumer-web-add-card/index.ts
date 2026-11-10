// Supabase Edge Function — consumer-web-add-card
//
// MESITA-3523: Add on the Wallet's Money rail. Opens a Stripe Checkout in
// `setup` mode on the guest's platform customer (created once, shared with
// Premier: premier_customers). Stripe's page types the card; on success it
// returns to `return_url` with `?card=<session id>` and the card is already
// on the customer, so the next list shows it. Nothing is charged.
// Cards live in the PAYMENTS mode (PAYMENTS_STRIPE_MODE, MESITA-3573), the
// mode a bill's card part reads them in (_shared/tab-card.ts); list and
// remove follow it. Premier's own refill keeps STRIPE_MODE.
//
// Body: { return_url: string }
// Response: { ok: true, url, test_mode }
//   400 (return_url not a Mesita address) · 401 sign_in ·
//   409 too_many (+max) · 503 (Stripe not configured) · 502 checkout_failed

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { cardSetupParams, listCards, MAX_CARDS } from "../_shared/cards.ts";
import { errorMessage } from "../_shared/errors.ts";
import { isAllowedReturnUrl, paymentsLivemode, paymentsStripeKey, stripeClient } from "../_shared/stripe.ts";
import { ensureCustomer } from "../_shared/boost-writes.ts";

serveJson("consumer-web-add-card", async (req) => {
  const ctx = await requireConsumerRequest(req, { signIn: "Sign in to save a card" });
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const returnUrl = bodyRes.body.return_url;
  if (typeof returnUrl !== "string" || !isAllowedReturnUrl(returnUrl)) {
    return json({ ok: false, error: "return_url is not a Mesita address" }, 400);
  }

  const key = paymentsStripeKey();
  if (!key) return json({ ok: false, error: "Cards are not available right now" }, 503);
  const userId = user.id;
  const livemode = paymentsLivemode();
  const stripe = stripeClient(key);
  try {
    const customer = await ensureCustomer(admin, stripe, userId, user.email ?? null, livemode);
    const cards = await listCards(stripe, customer, new Set());
    if (cards.length >= MAX_CARDS) {
      return json({ ok: false, code: "too_many", max: MAX_CARDS, error: `You can save up to ${MAX_CARDS} cards` }, 409);
    }
    const session = await stripe(
      "POST",
      "checkout/sessions",
      cardSetupParams({ customer, consumerId: userId, returnUrl, nowSec: Math.floor(Date.now() / 1000) }),
    );
    const url = typeof session.url === "string" ? session.url : null;
    if (!url) throw new Error("checkout: no url");
    console.log("[consumer-web-add-card]", JSON.stringify({ outcome: "opened", livemode }));
    return json({ ok: true, url, test_mode: !livemode });
  } catch (err) {
    console.error("[consumer-web-add-card]", JSON.stringify({ error: errorMessage(err) }));
    return json({ ok: false, code: "checkout_failed", error: "Couldn't open the card page. Try again." }, 502);
  }
});
