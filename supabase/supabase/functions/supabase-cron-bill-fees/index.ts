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
// Auth: verify_jwt = true + requireInternalCaller (the pg_cron vault key).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { requireInternalCaller } from "../_shared/internal.ts";
import { boostLivemode, boostStripeKey, stripeClient } from "../_shared/boost.ts";
import { runFeeBillingTick } from "../_shared/fee-billing.ts";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

serveJson("supabase-cron-bill-fees", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const caller = requireInternalCaller(req, envRes.env);
  if (!caller.ok) return caller.response;

  const key = boostStripeKey();
  if (!key) return json({ ok: true, skipped: "no_stripe_key" });
  const body = await readJsonOr<{ limit?: number }>(req, {});
  const limit = Math.min(Math.max(Number(body.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  const report = await runFeeBillingTick({ admin: adminClient(envRes.env), stripe: stripeClient(key), livemode: boostLivemode(), limit });
  console.log("[supabase-cron-bill-fees]", JSON.stringify(report));
  return json({ ok: true, ...report });
});
