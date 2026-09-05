// Supabase Edge Function — consumer-web-delete-account
//
// Authenticated. Closes the caller's own consumer account. Tickets are NEVER
// wiped here (Atlas §C / MESITA-1250): visit and reservation rows stay so
// ON DELETE RESTRICT remains honest. THE blessed door is
// `_shared/delete-history-free.ts` — history → `consumers.deleted_at` + auth
// tombstone (phone/email freed for a new uid); history-free → delete auth
// (consumers cascades). Self-contained: verifies the JWT, then writes via
// the service role. Does NOT call any other Edge Function.
//
// BILLING FIRST. consumer_subscriptions would vanish with a hard-delete, and
// even a tombstone must not leave Stripe charging a closed guest. Stripe is
// the system of record for money; it has to be told before we lose ours.
//
// Cancelled immediately, not at period end: the account is closed, there is
// nobody left to serve out the remainder. If Stripe refuses, we ABORT the
// close rather than orphan a live subscription — the user can retry, and
// a retryable error beats billing a ghost.
//
// Local:  supabase functions serve consumer-web-delete-account
// Deploy: supabase functions deploy consumer-web-delete-account

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import { corsPreflight, json, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
} from "../_shared/auth.ts";
import { STRIPE_API_VERSION } from "../_shared/stripe-billing.ts";
import { stripeSecretKey } from "../_shared/stripe-env.ts";
import { deleteConsumerAccount } from "../_shared/delete-history-free.ts";

// Statuses that still bill (or still owe us money). `canceled` / `incomplete_
// expired` are terminal at Stripe already, so there is nothing to cancel.
const BILLABLE_STATUSES = ["active", "trialing", "past_due", "unpaid", "incomplete"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  // Account close is self-only — the JWT identifies which row to
  // tombstone or hard-delete. No body needed.
  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const userId = authRes.user.id;

  const admin = adminClient(envRes.env);

  // ── Stop the money first ─────────────────────────────────────────────────
  // Mock rows (id prefixed `mock_`, the MOCK_SUBSCRIPTION path consumer
  // billing still runs on) have no Stripe counterpart — nothing to cancel.
  const { data: subs, error: subsErr } = await admin
    .from("consumer_subscriptions")
    .select("stripe_subscription_id, status")
    .eq("consumer_id", userId)
    .in("status", BILLABLE_STATUSES);
  if (subsErr) {
    return json({ ok: false, error: `subscription_read: ${subsErr.message}` }, 500);
  }

  const stripeKey = stripeSecretKey();
  const liveSubIds = (subs ?? [])
    .map((s) => (s.stripe_subscription_id ?? "") as string)
    .filter((id) => id && !id.startsWith("mock_"));

  if (liveSubIds.length > 0) {
    if (!stripeKey) {
      // A real subscription on file and no way to reach Stripe: refusing is
      // the only honest option — deleting here bills someone who no longer
      // has an account, and destroys the row that would let us find them.
      return json({
        ok: false,
        error:
          "Can't close the account while a paid subscription is active. Contact support.",
        code: "subscription_cancel_unavailable",
      }, 503);
    }
    const stripe = new Stripe(stripeKey, { apiVersion: STRIPE_API_VERSION });
    for (const subId of liveSubIds) {
      try {
        await stripe.subscriptions.cancel(subId);
      } catch (err) {
        // Already gone at Stripe (manually cancelled, test-data wipe) is a
        // success for our purposes — anything else stops the deletion.
        const code = (err as { code?: string })?.code;
        const status = (err as { statusCode?: number })?.statusCode;
        if (code === "resource_missing" || status === 404) continue;
        return json({
          ok: false,
          error: `subscription_cancel: ${(err as Error).message}`,
          code: "subscription_cancel_failed",
        }, 502);
      }
    }
  }

  const closed = await deleteConsumerAccount(admin, userId);
  if (!closed.ok) {
    return json({ ok: false, error: closed.error }, 500);
  }

  return json({
    ok: true,
    id: userId,
    mode: closed.mode,
    subscriptions_cancelled: liveSubIds.length,
  });
});
