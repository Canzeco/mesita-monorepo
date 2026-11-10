// Supabase Edge Function — supabase-cron-bill-fees (internal)
//
// MESITA-3461: Mesita's 5% billed to each place apart (charge model d5a: the
// charges carry no application fee). pg_cron calls it every hour (job
// `bill-fees`); one tick claims what places owe onto invoices when due
// (MX$500 owed, or weekly), sends them from Mesita's own Stripe account,
// reads back the unpaid ones and holds a place's cards off while one is
// past due (fee-billing.ts).
//
// Body: { limit?: number }  (default 200, max 1000)
// Auth: verify_jwt = true + requireInternalRequest (the pg_cron vault key).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { requireInternalRequest } from "../_shared/request.ts";
import { runFeeBillingTick } from "../_shared/fee-billing.ts";
import { paymentsLivemode, paymentsStripeKey, stripeClient } from "../_shared/stripe.ts";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

serveJson("supabase-cron-bill-fees", async (req) => {
  const ctx = requireInternalRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const key = paymentsStripeKey();
  if (!key) return json({ ok: true, skipped: "no_stripe_key" });
  const body = await readJsonOr<{ limit?: number }>(req, {});
  const limit = Math.min(Math.max(Number(body.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  const report = await runFeeBillingTick({ admin, stripe: stripeClient(key), livemode: paymentsLivemode(), limit });
  console.log("[supabase-cron-bill-fees]", JSON.stringify(report));
  return json({ ok: true, ...report });
});
