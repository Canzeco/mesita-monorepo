// Supabase Edge Function — consumer-web-set-default-card (product caller)
//
// Authenticated. Points the customer's invoice_settings at one saved card.
// That IS the default — there is no local column mirroring it, so a change
// made here or in the Stripe dashboard reads back identically next list.
//
// Body: { paymentMethodId: string }
// Response: { ok: true, mock?: true }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJson,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { cardContext, ownedCard } from "../_shared/consumer-cards.ts";

type Body = { paymentMethodId?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const paymentMethodId = (bodyRes.body.paymentMethodId ?? "").toString()
    .trim();
  if (!paymentMethodId) {
    return json({ ok: false, error: "paymentMethodId is required" }, 400);
  }

  const admin = adminClient(envRes.env);
  const ctxRes = await cardContext(admin, authRes.user.id, {});
  if (!ctxRes.ok) return ctxRes.response;
  const { stripe, customerId } = ctxRes.ctx;

  // Same ownership re-read as remove: the id is client-supplied either way.
  const owned = await ownedCard(stripe, customerId, paymentMethodId);
  if (!owned.ok) return owned.response;

  try {
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
    return json({ ok: true });
  } catch (err) {
    return json(
      { ok: false, error: String(err), code: "stripe_unavailable" },
      502,
    );
  }
});
