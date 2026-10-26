// Supabase Edge Function — supabase-cron-sync-boosts (internal)
//
// MESITA-1998: keeps Boost backings true to Stripe. pg_cron calls it
// hourly (job `sync-boosts`); it re-reads every subscription whose
// period ends within the hour (a renewal moves the end forward, a failed
// card or a cancellation changes the status) and writes it back, which
// fires the trigger that recomputes the place's tier. Checkouts left open
// for a day are dropped.
//
// There is no Stripe webhook: the EF name is the ACL and no caller prefix
// is Stripe's (Rules §2), so Mesita polls instead.
//
// Body: { limit?: number }  (default 100, max 500)
// Auth: verify_jwt = true + requireInternalCaller (the pg_cron vault key).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJsonOr, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { requireInternalCaller } from "../_shared/internal.ts";
import { boostStripeKey, stripeClient, subscriptionPatch } from "../_shared/boost.ts";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const OPEN_TTL_MS = 24 * 3600_000;

Deno.serve(async (req) => {
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

  const stale = new Date(Date.now() - OPEN_TTL_MS).toISOString();
  const { count: dropped } = await admin
    .from("place_backings")
    .delete({ count: "exact" })
    .eq("status", "open")
    .lt("created_at", stale);

  const key = boostStripeKey();
  if (!key) return json({ ok: true, synced: 0, dropped: dropped ?? 0, skipped: "no_stripe_key" });

  const soon = new Date(Date.now() + 3600_000).toISOString();
  const { data: due, error } = await admin
    .from("place_backings")
    .select("id, stripe_subscription_id")
    .not("stripe_subscription_id", "is", null)
    .in("status", ["active", "trialing", "past_due", "incomplete", "unpaid"])
    .lt("current_period_end", soon)
    .order("current_period_end", { ascending: true })
    .limit(limit);
  if (error) return json({ ok: false, error: `due_read: ${error.message}` }, 500);

  const stripe = stripeClient(key);
  let synced = 0;
  let failed = 0;
  for (const row of due ?? []) {
    try {
      const sub = await stripe("GET", `subscriptions/${encodeURIComponent(row.stripe_subscription_id!)}`);
      await admin.from("place_backings").update(subscriptionPatch(sub)).eq("id", row.id);
      synced++;
    } catch (err) {
      failed++;
      console.error("[supabase-cron-sync-boosts]", row.id, err);
    }
  }
  return json({ ok: true, synced, failed, dropped: dropped ?? 0 });
});
