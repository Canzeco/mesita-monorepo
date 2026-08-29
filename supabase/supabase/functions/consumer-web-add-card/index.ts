// Supabase Edge Function — consumer-web-add-card (product caller)
//
// Authenticated. Opens a Stripe-hosted Checkout Session in `setup` mode and
// returns its URL. The card number is typed on Stripe's page and never
// touches Mesita — that is the whole point, and it is what keeps this
// codebase out of PCI scope. Same redirect shape the Premium subscribe flow
// already uses (decision: Pato, 2026-08-29 — hosted over inline Elements).
//
// Body: { successUrl?: string, cancelUrl?: string }
// Response: { ok: true, setup_url: string, mock?: true }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJsonOr,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { cardContext } from "../_shared/consumer-cards.ts";

type Body = { successUrl?: string; cancelUrl?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const body = await readJsonOr<Body>(req, {});
  const origin = req.headers.get("origin") ?? "";
  const successUrl = body.successUrl ?? `${origin}/me?cards=added`;
  const cancelUrl = body.cancelUrl ?? `${origin}/me?cards=cancelled`;

  const admin = adminClient(envRes.env);
  // Mock hands back the success URL directly, so the sheet still reopens and
  // the flow is walkable with no Stripe secret at all.
  const ctxRes = await cardContext(admin, authRes.user.id, {
    setup_url: successUrl,
  });
  if (!ctxRes.ok) return ctxRes.response;
  const { stripe, customerId } = ctxRes.ctx;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "setup",
      customer: customerId,
      currency: "mxn",
      payment_method_types: ["card"],
      metadata: { consumer_id: authRes.user.id, mesita_kind: "consumer_card" },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    if (!session.url) {
      return json(
        {
          ok: false,
          error: "Stripe returned no setup URL",
          code: "stripe_unavailable",
        },
        502,
      );
    }
    return json({ ok: true, setup_url: session.url });
  } catch (err) {
    return json(
      { ok: false, error: String(err), code: "stripe_unavailable" },
      502,
    );
  }
});
