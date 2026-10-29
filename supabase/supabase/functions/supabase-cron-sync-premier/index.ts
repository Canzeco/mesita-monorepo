// Supabase Edge Function — supabase-cron-sync-premier (internal)
//
// MESITA-2995: keeps Premier periods true to Stripe. pg_cron calls it every
// 5 minutes (job `sync-premier`):
//   1. Checkouts a guest never came back from are settled through the same
//      confirmPledge as consumer-web-get-premier (a paid one starts its period);
//   2. charges in flight are settled (held upgrades captured, renewals asked
//      again with the same key; past 24 h cancelled and declined);
//   3. every place with a ready pledge and no period running is renewed:
//      the line is walked top-down until one card pays;
//   4. tiers are recomputed (also its own pg_cron job, recompute-premier).
//
// There is no Stripe webhook: the EF name is the ACL and no caller prefix is
// Stripe's (Rules §2), so Mesita polls.
//
// Body: { limit?: number }  (default 100, max 500)
// Auth: verify_jwt = true + requireInternalCaller (the pg_cron vault key).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { requireInternalCaller } from "../_shared/internal.ts";
import {
  boostLivemode,
  boostStripeKey,
  confirmPledge,
  type Period,
  PERIOD_COLUMNS,
  type Pledge,
  PLEDGE_COLUMNS,
  renewPlace,
  settleCharging,
  stripeClient,
} from "../_shared/boost.ts";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
/** A Checkout younger than this is still the guest's to finish. */
const CHECKOUT_GRACE_MS = 2 * 60_000;

serveJson("supabase-cron-sync-premier", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const caller = requireInternalCaller(req, envRes.env);
  if (!caller.ok) return caller.response;

  const body = await readJsonOr<{ limit?: number }>(req, {});
  const limit = Math.min(Math.max(Number(body.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const admin = adminClient(envRes.env);
  const key = boostStripeKey();
  if (!key) return json({ ok: true, skipped: "no_stripe_key" });
  const stripe = stripeClient(key);
  const livemode = boostLivemode();
  const counts = { checkouts: 0, settled: 0, renewed: 0, failed: 0 };

  // 1. Checkouts left behind.
  const older = new Date(Date.now() - CHECKOUT_GRACE_MS).toISOString();
  const { data: open, error: openErr } = await admin
    .from("place_backings")
    .select(PLEDGE_COLUMNS)
    .not("stripe_checkout_session_id", "is", null)
    .in("status", ["open", "ready", "failed"])
    .lt("updated_at", older)
    .order("updated_at", { ascending: true })
    .limit(limit);
  if (openErr) return json({ ok: false, error: `checkouts_read: ${openErr.message}` }, 500);
  for (const pledge of (open ?? []) as Pledge[]) {
    try {
      const outcome = await confirmPledge(admin, stripe, pledge, livemode);
      if (outcome !== "pending" && outcome !== "none") counts.checkouts++;
    } catch (err) {
      counts.failed++;
      console.error("[supabase-cron-sync-premier] checkout", pledge.id, err);
    }
  }

  // 2. Charges in flight.
  const { data: charging, error: chErr } = await admin
    .from("place_premier_periods")
    .select(PERIOD_COLUMNS)
    .eq("status", "charging")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (chErr) return json({ ok: false, error: `charging_read: ${chErr.message}` }, 500);
  for (const period of (charging ?? []) as Period[]) {
    try {
      if ((await settleCharging(admin, stripe, period)) !== "unknown") counts.settled++;
    } catch (err) {
      counts.failed++;
      console.error("[supabase-cron-sync-premier] settle", period.id, err);
    }
  }

  // 3. Renewals: every place with someone in line.
  const { data: lined, error: lineErr } = await admin
    .from("place_backings")
    .select("place_id")
    .eq("status", "ready")
    .not("stripe_payment_method_id", "is", null)
    .limit(5000);
  if (lineErr) return json({ ok: false, error: `line_read: ${lineErr.message}` }, 500);
  const places = [...new Set((lined ?? []).map((r: { place_id: string }) => r.place_id))].slice(0, limit);
  for (const placeId of places) {
    try {
      const r = await renewPlace(admin, stripe, placeId);
      if (r === "paid") counts.renewed++;
    } catch (err) {
      counts.failed++;
      console.error("[supabase-cron-sync-premier] renew", placeId, err);
    }
  }

  // 4. Tiers follow time.
  const { error: recErr } = await admin.rpc("recompute_due_place_boosts");
  if (recErr) console.error("[supabase-cron-sync-premier] recompute", recErr.message);

  return json({ ok: true, ...counts });
});
