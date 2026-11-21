// Supabase Edge Function — consumer-web-add-card
//
// MESITA-3523, in-app since MESITA-4065: Add a card. Creates a SetupIntent on
// the guest's platform customer (created once, shared with Premier:
// premier_customers) and answers its client secret; the app confirms it with
// Stripe's Payment Element inside its own sheet (no Stripe page; Mesita never
// sees the number). Nothing is charged. Cards live in the PAYMENTS mode
// (PAYMENTS_STRIPE_MODE, MESITA-3573), the mode a bill's card part and a
// voucher buy read them in; list and remove follow it. Premier's own refill
// keeps STRIPE_MODE.
//
// Body: {} (an old bundle's `return_url` is refused: 400 update_app)
// Response: { ok: true, client_secret, publishable_key, setup_intent_id, test_mode }
// Refusals (stable `code`):
//   400 update_app — an old app bundle asked for Stripe's page: reload Mesita
//   401 sign_in
//   409 too_many (+max) — three cards are saved: remove one in Payment methods (MESITA-4590; one card under MESITA-4168)
//   502 setup_failed (+ref) — Stripe did not create the SetupIntent: retry, up to 2
//   503 payments_unavailable — Stripe keys missing for this mode
// The client secret is never logged.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { addCardCheck, cardSetupIntentParams, listCards } from "../_shared/cards.ts";
import { errorMessage } from "../_shared/errors.ts";
import { paymentsLivemode, paymentsPublishableKey, paymentsStripeKey, stripeClient } from "../_shared/stripe.ts";
import { ensureCustomer } from "../_shared/boost-writes.ts";

serveJson("consumer-web-add-card", async (req) => {
  const ctx = await requireConsumerRequest(req, { signIn: "Sign in to save a card" });
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  if ("return_url" in bodyRes.body) {
    return json({ ok: false, code: "update_app", error: "Reload Mesita to add a card." }, 400);
  }

  const livemode = paymentsLivemode();
  const key = paymentsStripeKey();
  const publishableKey = paymentsPublishableKey(livemode);
  if (!key || !publishableKey) {
    return json({ ok: false, code: "payments_unavailable", error: "Cards are not available right now" }, 503);
  }
  const userId = user.id;
  const stripe = stripeClient(key);
  try {
    const customer = await ensureCustomer(admin, stripe, userId, user.email ?? null, livemode);
    const check = addCardCheck((await listCards(stripe, customer, new Set())).length);
    if (!check.ok) return json(check, check.status);
    const si = await stripe("POST", "setup_intents", cardSetupIntentParams({ customer, consumerId: userId }));
    const secret = typeof si.client_secret === "string" ? si.client_secret : null;
    const id = typeof si.id === "string" ? si.id : null;
    if (!secret || !id) throw new Error("setup_intent: no client_secret");
    console.log("[consumer-web-add-card]", JSON.stringify({ outcome: "setup_intent", setup_intent_id: id, livemode }));
    return json({ ok: true, client_secret: secret, publishable_key: publishableKey, setup_intent_id: id, test_mode: !livemode });
  } catch (err) {
    const ref = crypto.randomUUID();
    console.error("[consumer-web-add-card]", JSON.stringify({ outcome: "setup_failed", ref, error: errorMessage(err) }));
    return json({ ok: false, code: "setup_failed", ref, error: "Couldn't open the card form. Try again." }, 502);
  }
});
