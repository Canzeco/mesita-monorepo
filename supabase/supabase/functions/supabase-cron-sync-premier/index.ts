// Supabase Edge Function — supabase-cron-sync-premier (internal)
//
// MESITA-2995 / MESITA-3092: keeps Premier periods true to Stripe. pg_cron
// calls it every 5 minutes (job `sync-premier`):
//   1. Checkouts a payer never came back from are settled through the same
//      confirmPledge as business-web-get-premier (a paid one starts its period);
//   2. charges in flight are settled (held payments captured, renewals asked
//      again with the same key; past 24 h cancelled and declined);
//   3. every place's subscription whose period ended is renewed: one charge
//      to the payer's card; a decline ends the subscription (R6);
//   4. Refill packs a guest bought and never came back for (MESITA-3168) are
//      settled through the same settleRefillPurchase as
//      consumer-web-get-premier-refill: paid → days added, expired → closed,
//      refused → refunded in TEST or left refund_needed;
//   5. tiers are recomputed (also its own pg_cron job, recompute-premier).
//
// There is no Stripe webhook: the EF name is the ACL and no caller prefix is
// Stripe's (Rules §2), so Mesita polls.
//
// Body: { limit?: number }  (default 100, max 500)
// Auth: verify_jwt = true + requireInternalRequest (the pg_cron vault key).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { requireInternalRequest } from "../_shared/request.ts";
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
import { PURCHASE_COLUMNS, type RefillPurchase, settleRefillPurchase } from "../_shared/premier-purchase.ts";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
/** A Checkout younger than this is still the guest's to finish. */
const CHECKOUT_GRACE_MS = 2 * 60_000;

serveJson("supabase-cron-sync-premier", async (req) => {
  const ctx = requireInternalRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const body = await readJsonOr<{ limit?: number }>(req, {});
  const limit = Math.min(Math.max(Number(body.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const key = boostStripeKey();
  if (!key) return json({ ok: true, skipped: "no_stripe_key" });
  const stripe = stripeClient(key);
  const livemode = boostLivemode();
  const counts = { checkouts: 0, settled: 0, renewed: 0, refills: 0, failed: 0 };

  // 1. Checkouts left behind.
  const older = new Date(Date.now() - CHECKOUT_GRACE_MS).toISOString();
  const { data: open, error: openErr } = await admin
    .from("place_backings")
    .select(PLEDGE_COLUMNS)
    .not("checkout_kind", "is", null)
    .not("stripe_checkout_session_id", "is", null)
    .in("status", ["open", "ready"])
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

  // 3. Renewals: every place with a subscription.
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

  // 4. Refill packs left behind.
  const { data: packs, error: packErr } = await admin
    .from("premier_refill_purchases")
    .select(PURCHASE_COLUMNS)
    .in("status", ["open", "paid"])
    .eq("livemode", livemode)
    .lt("created_at", older)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (packErr) return json({ ok: false, error: `refills_read: ${packErr.message}` }, 500);
  const sweptAt = Date.now();
  for (const purchase of (packs ?? []) as RefillPurchase[]) {
    try {
      if ((await settleRefillPurchase(admin, stripe, purchase, sweptAt)) !== purchase.status) counts.refills++;
    } catch (err) {
      counts.failed++;
      console.error("[supabase-cron-sync-premier] refill", purchase.id, err);
    }
  }

  // 5. Tiers follow time.
  const { error: recErr } = await admin.rpc("recompute_due_place_boosts");
  if (recErr) console.error("[supabase-cron-sync-premier] recompute", recErr.message);

  return json({ ok: true, ...counts });
});
