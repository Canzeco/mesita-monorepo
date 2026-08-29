// Supabase Edge Function — consumer-web-remove-card (product caller)
//
// Authenticated. Detaches one saved card. TWO guards, both mandatory:
//
//   403 card_not_yours        — the payment_method_id arrives from the client,
//                               so ownership is re-read from Stripe. Without
//                               this any authed guest could detach a
//                               stranger's card by guessing an id.
//   409 card_backs_subscription — removing the card a live Premium draws on
//                               would lapse the subscription at the next
//                               renewal with nothing telling the guest why.
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
import {
  backsActiveSubscription,
  cardContext,
  ownedCard,
} from "../_shared/consumer-cards.ts";

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

  const owned = await ownedCard(stripe, customerId, paymentMethodId);
  if (!owned.ok) return owned.response;

  if (
    await backsActiveSubscription(
      admin,
      stripe,
      customerId,
      paymentMethodId,
      authRes.user.id,
    )
  ) {
    return json({
      ok: false,
      error: "This card pays for Premium. Add another card first.",
      code: "card_backs_subscription",
    }, 409);
  }

  try {
    await stripe.paymentMethods.detach(paymentMethodId);
    return json({ ok: true });
  } catch (err) {
    return json(
      { ok: false, error: String(err), code: "stripe_unavailable" },
      502,
    );
  }
});
