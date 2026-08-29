// Supabase Edge Function — consumer-web-list-cards (product caller)
//
// Authenticated. The Cards wallet's read: this consumer's saved cards, newest
// Stripe order, with `is_default` DERIVED from the customer's
// invoice_settings — never from a local column, because there isn't one.
// Stripe is the only store (see _shared/consumer-cards.ts).
//
// Body: {}
// Response: { ok: true, cards: CardSummary[], mock?: true }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import {
  cardContext,
  defaultPaymentMethodId,
  toCardSummary,
} from "../_shared/consumer-cards.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  // Mock returns an EMPTY list, never an invented Visa: a fake card in a
  // wallet is a lie the guest can act on.
  const ctxRes = await cardContext(admin, authRes.user.id, { cards: [] });
  if (!ctxRes.ok) return ctxRes.response;
  const { stripe, customerId } = ctxRes.ctx;

  try {
    const [list, defaultId] = await Promise.all([
      stripe.paymentMethods.list({ customer: customerId, type: "card" }),
      defaultPaymentMethodId(stripe, customerId),
    ]);
    return json({
      ok: true,
      cards: list.data.map((pm) => toCardSummary(pm, defaultId)),
    });
  } catch (err) {
    return json(
      { ok: false, error: String(err), code: "stripe_unavailable" },
      502,
    );
  }
});
