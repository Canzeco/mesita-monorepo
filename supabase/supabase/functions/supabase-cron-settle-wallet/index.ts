// Supabase Edge Function — supabase-cron-settle-wallet (internal)
//
// MESITA-3305 (W2b): the money ledger's backstop. pg_cron calls it every 5
// minutes (job `settle-wallet`); one tick settles a bounded batch of open
// voucher purchases and mixed payments against Stripe on their connected
// accounts (settle-cron.ts), gives up on rows Stripe will never confirm
// (needs_review), fails stale `opening` rows, sweeps the waiter's charges
// tells guests whose Pending credit turned Available (Me › Notifications,
// MESITA-3293) and logs the needs_review count. The Connect receiver is the primary
// path; the wallet read is the third.
//
// Body: {}  (the bounds come from app_config.money_config)
// Auth: verify_jwt = true + requireInternalCaller (the pg_cron vault key).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { requireInternalCaller } from "../_shared/internal.ts";
import { boostLivemode, boostStripeKey, stripeClient } from "../_shared/boost.ts";
import { readAppConfig } from "../_shared/write-config.ts";
import { runSettleTick, settleConfigFrom } from "../_shared/settle-cron.ts";

serveJson("supabase-cron-settle-wallet", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const caller = requireInternalCaller(req, envRes.env);
  if (!caller.ok) return caller.response;

  const key = boostStripeKey();
  if (!key) return json({ ok: true, skipped: "no_stripe_key" });
  const admin = adminClient(envRes.env);
  const cfgRes = await readAppConfig(admin, "money_config", "money_config_read");
  const cfg = settleConfigFrom(cfgRes.ok ? (cfgRes.row as { money_config?: unknown } | null)?.money_config : null);

  const report = await runSettleTick({ admin, stripe: stripeClient(key), livemode: boostLivemode(), now: () => Date.now() }, cfg);
  console.log("[supabase-cron-settle-wallet]", JSON.stringify(report));
  return json({ ok: true, ...report });
});
