// Supabase Edge Function — consumer-web-delete-account
//
// Authenticated. Closes the caller's own consumer account. Tickets are NEVER
// wiped here (Atlas §C / MESITA-1250): reservation rows stay so ON DELETE
// RESTRICT remains honest. THE blessed door is
// `_shared/delete-history-free.ts` — history → `consumers.deleted_at` + auth
// tombstone (phone/email freed for a new uid); history-free → delete auth
// (consumers cascades). Self-contained: verifies the JWT, then writes via
// the service role. Does NOT call any other Edge Function. First it ends
// the guest's Boost subscriptions in Stripe (MESITA-1998).
//
// Local:  supabase functions serve consumer-web-delete-account
// Deploy: supabase functions deploy consumer-web-delete-account

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
} from "../_shared/auth.ts";
import { deleteConsumerAccount } from "../_shared/delete-history-free.ts";
import { cancelConsumerBackings, boostStripeKey, stripeClient } from "../_shared/boost.ts";

serveJson("consumer-web-delete-account", async (req) => {
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

  // Boost (MESITA-1998): stop every subscription the guest still pays
  // before the account goes, or Stripe keeps billing a deleted member.
  const key = boostStripeKey();
  const stopped = await cancelConsumerBackings(admin, userId, key ? stripeClient(key) : null);
  if (!stopped.ok) {
    return json({ ok: false, error: stopped.error }, 502);
  }

  const closed = await deleteConsumerAccount(admin, userId);
  if (!closed.ok) {
    return json({ ok: false, error: closed.error }, 500);
  }

  return json({
    ok: true,
    id: userId,
    mode: closed.mode,
  });
});
