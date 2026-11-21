// Supabase Edge Function — consumer-web-list-cards
//
// MESITA-3523: the signed-in guest's saved cards, read from Stripe (their
// platform customer, _shared/cards.ts). A guest with no customer yet has no
// cards and gets none created by a read.
//
// Body: {}
// Response: { ok: true, test_mode, cards: [{ id, brand, last4, exp_month,
//             exp_year, in_use }], pay_method: card|apple_pay|google_pay|null }
//   pay_method (MESITA-4526): the guest's default way to pay; checkout
//   preselects a stored Apple Pay / Google Pay from it.
//   401 sign_in · 503 (Stripe not configured) · 502 cards_failed

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { readCustomer } from "../_shared/boost.ts";
import { listCards, premierCards, readPayMethod } from "../_shared/cards.ts";
import { errorMessage } from "../_shared/errors.ts";
import { paymentsLivemode, paymentsStripeKey, stripeClient } from "../_shared/stripe.ts";

serveJson("consumer-web-list-cards", async (req) => {
  const ctx = await requireConsumerRequest(req, { signIn: "Sign in to see your cards" });
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;
  const userId = user.id;
  const livemode = paymentsLivemode();

  const payMethodRead = readPayMethod(admin, userId);
  const customer = await readCustomer(admin, userId, livemode);
  if (!customer) return json({ ok: true, test_mode: !livemode, cards: [], pay_method: await payMethodRead });
  const key = paymentsStripeKey();
  if (!key) return json({ ok: false, error: "Cards are not available right now" }, 503);
  try {
    const cards = await listCards(stripeClient(key), customer, await premierCards(admin, userId));
    return json({ ok: true, test_mode: !livemode, cards, pay_method: await payMethodRead });
  } catch (err) {
    console.error("[consumer-web-list-cards]", JSON.stringify({ error: errorMessage(err) }));
    return json({ ok: false, code: "cards_failed", error: "Couldn't load your cards" }, 502);
  }
});
