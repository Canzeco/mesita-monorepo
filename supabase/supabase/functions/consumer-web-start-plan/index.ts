// Supabase Edge Function — consumer-web-start-plan
//
// MESITA-3870. Me › Plan's Upgrade: a Stripe Checkout for Pro, $2 a month
// (_shared/guest-plan.ts), billed on the guest's own Premier customer in
// Premier's Stripe universe (test until Pato flips STRIPE_MODE). Nothing is
// granted here; consumer-web-get-plan grants Pro when Checkout returns paid.
//
// A guest already on Pro who cancelled gets the renewal back instead
// (`resumed: true`, no Checkout). A guest on Pro is refused (`already_pro`).
//
// Body: { return_url: string }
// Response: { ok: true, url: string } | { ok: true, resumed: true }
//         | { ok: false, code: "already_pro" | "stripe_unavailable", error }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { boostLivemode, boostStripeKey, isAllowedReturnUrl, stripeClient } from "../_shared/stripe.ts";
import { ensureCustomer } from "../_shared/boost-writes.ts";
import { effectivePlan, PLAN_COLUMNS, type PlanRow, planCheckoutParams, syncPlan } from "../_shared/guest-plan.ts";

serveJson("consumer-web-start-plan", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const returnUrl = bodyRes.body.return_url;
  if (typeof returnUrl !== "string" || !isAllowedReturnUrl(returnUrl)) {
    return json({ ok: false, error: "return_url is not a Mesita address" }, 400);
  }

  const key = boostStripeKey();
  if (!key) return json({ ok: false, code: "stripe_unavailable", error: "Payments are not available right now." }, 503);
  const stripe = stripeClient(key);
  const livemode = boostLivemode();

  const { data, error } = await admin.from("consumers").select(PLAN_COLUMNS).eq("id", user.id).maybeSingle();
  if (error) return json({ ok: false, error: error.message }, 500);
  let row = (data ?? null) as PlanRow | null;
  if (!row) return json({ ok: false, code: "no_account", error: "Sign in to change your plan." }, 404);

  try {
    const subId = typeof row.plan_stripe_subscription === "string" && row.plan_livemode === livemode
      ? row.plan_stripe_subscription
      : null;
    if (subId) row = await syncPlan(admin, stripe, user.id, subId, livemode);

    if (effectivePlan(row, Date.now(), livemode) === "premium") {
      const liveSub = typeof row.plan_stripe_subscription === "string" ? row.plan_stripe_subscription : null;
      if (liveSub && row.plan_cancel_at_period_end === true) {
        await stripe("POST", `subscriptions/${encodeURIComponent(liveSub)}`, { cancel_at_period_end: false });
        await syncPlan(admin, stripe, user.id, liveSub, livemode);
        return json({ ok: true, resumed: true });
      }
      return json({ ok: false, code: "already_pro", error: "You're already on Pro." });
    }

    const customer = await ensureCustomer(admin, stripe, user.id, user.email ?? null, livemode);
    const session = await stripe(
      "POST",
      "checkout/sessions",
      planCheckoutParams({ customer, consumerId: user.id, returnUrl, nowSec: Math.floor(Date.now() / 1000) }),
    );
    if (typeof session.url !== "string") throw new Error("checkout: no url");
    return json({ ok: true, url: session.url });
  } catch (err) {
    const requestId = crypto.randomUUID();
    console.error("[consumer-web-start-plan] checkout_failed", JSON.stringify({ request_id: requestId, consumer_id: user.id, error: String(err) }));
    return json({ ok: false, error: "Couldn't open checkout. Try again.", request_id: requestId }, 502);
  }
});
