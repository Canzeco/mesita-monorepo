// Supabase Edge Function — consumer-web-cancel-plan
//
// MESITA-3870. Me › Plan's Cancel: Pro stops renewing. The month already paid
// runs out (plan_paid_until), then the guest is on Free; nothing is refunded.
// Upgrade (consumer-web-start-plan) turns the renewal back on until then.
//
// Body: {}
// Response: { ok: true, paid_until: string | null }
//         | { ok: false, code: "not_subscribed" | "stripe_unavailable", error }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { boostLivemode, boostStripeKey, stripeClient } from "../_shared/stripe.ts";
import { PLAN_COLUMNS, type PlanRow, syncPlan } from "../_shared/guest-plan.ts";

serveJson("consumer-web-cancel-plan", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const key = boostStripeKey();
  if (!key) return json({ ok: false, code: "stripe_unavailable", error: "Payments are not available right now." }, 503);
  const stripe = stripeClient(key);
  const livemode = boostLivemode();

  const { data, error } = await admin.from("consumers").select(PLAN_COLUMNS).eq("id", user.id).maybeSingle();
  if (error) return json({ ok: false, error: error.message }, 500);
  const row = (data ?? null) as PlanRow | null;
  const subId = row && typeof row.plan_stripe_subscription === "string" && row.plan_livemode === livemode
    ? row.plan_stripe_subscription
    : null;
  if (!subId) return json({ ok: false, code: "not_subscribed", error: "You're not paying for Pro." });

  try {
    await stripe("POST", `subscriptions/${encodeURIComponent(subId)}`, { cancel_at_period_end: true });
    const fresh = await syncPlan(admin, stripe, user.id, subId, livemode);
    return json({ ok: true, paid_until: fresh.plan_paid_until ?? null });
  } catch (err) {
    const requestId = crypto.randomUUID();
    console.error("[consumer-web-cancel-plan] cancel_failed", JSON.stringify({ request_id: requestId, consumer_id: user.id, error: String(err) }));
    return json({ ok: false, error: "Couldn't cancel. Try again.", request_id: requestId }, 502);
  }
});
