// Supabase Edge Function — consumer-web-cancel-boost
//
// MESITA-1998: a guest stops renewing one of their own Boost backings.
// Stripe keeps it live to the end of the period already paid
// (cancel_at_period_end), so the place keeps what it was paid for; the
// hourly sync then lets it lapse.
//
// Body: { backing_id: uuid }
// Response: { ok: true, current_period_end }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { boostStripeKey, cancelBackingAtPeriodEnd, stripeClient } from "../_shared/boost.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const backingId = bodyRes.body.backing_id;
  if (typeof backingId !== "string" || !UUID_RE.test(backingId)) {
    return json({ ok: false, error: "backing_id must be a backing id" }, 400);
  }

  const admin = adminClient(envRes.env);
  const { data: row, error } = await admin
    .from("place_backings")
    .select("id, stripe_subscription_id")
    .eq("id", backingId)
    .eq("consumer_id", authRes.user.id)
    .maybeSingle();
  if (error) return json({ ok: false, error: `backing_read: ${error.message}` }, 500);
  if (!row?.stripe_subscription_id) return json({ ok: false, error: "Backing not found" }, 404);

  const key = boostStripeKey();
  if (!key) return json({ ok: false, error: "Payments are not available right now" }, 503);

  const reply = await cancelBackingAtPeriodEnd(admin, stripeClient(key), {
    id: row.id,
    stripe_subscription_id: row.stripe_subscription_id,
  });
  return json(reply.body, reply.status);
});
