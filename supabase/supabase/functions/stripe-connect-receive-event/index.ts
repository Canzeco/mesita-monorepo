// Supabase Edge Function — stripe-connect-receive-event
//
// MESITA-3305 (W2b): Stripe's Connect webhook, the primary settlement path
// for the money ledger. Stripe posts the events of every connected account
// here (checkout.session.completed, checkout.session.expired,
// charge.refunded, account.updated); the signature on the raw body with
// STRIPE_CONNECT_WEBHOOK_SECRET is the gate (verify_jwt = false: Stripe holds
// no Supabase JWT; never requireInternalCaller). The `stripe` actor is in
// Rules §2's closed caller set.
//
// Answers by failure class (connect-events.ts decides):
//   413 body_too_large · 503 not_configured (no secret) · 400 bad_signature ·
//   400 stale_event · 400 (not an event) ·
//   200 {ok:true, ignored: unknown_account | livemode | replay | unhandled} ·
//   200 {ok:true, outcome} · 500 settle_failed (an RPC or database failure:
//   the event row is deleted, so Stripe retries and the work runs)
// Every log line carries event.id and event.account.
//
// Until Pato creates the Connect endpoint and sets the secret, this door
// answers 503 and the cron and the wallet read settle everything.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, serveJson } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { paymentsLivemode, paymentsStripeKey, stripeClient } from "../_shared/boost.ts";
import { handleConnectEvent, isConnectEvent, MAX_BODY_BYTES, verifyStripeSignature } from "../_shared/connect-events.ts";

serveJson("stripe-connect-receive-event", async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const secret = (Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET") ?? "").trim();
  if (!secret) {
    console.error("[stripe-connect-receive-event] not_configured");
    return json({ ok: false, code: "not_configured", error: "STRIPE_CONNECT_WEBHOOK_SECRET is not set" }, 503);
  }

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return json({ ok: false, code: "body_too_large", error: "Body over 64 KB" }, 413);
  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return json({ ok: false, code: "body_too_large", error: "Body over 64 KB" }, 413);
  }

  const verdict = await verifyStripeSignature(raw, req.headers.get("stripe-signature"), secret, Math.floor(Date.now() / 1000));
  if (!verdict.ok) {
    console.error(`[stripe-connect-receive-event] ${verdict.code}`);
    return json({ ok: false, code: verdict.code, error: verdict.code === "stale_event" ? "Signature older than 5 minutes" : "Bad signature" }, 400);
  }

  let event: unknown;
  try {
    event = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }
  if (!isConnectEvent(event)) return json({ ok: false, error: "Not a Stripe event" }, 400);

  const key = paymentsStripeKey();
  if (!key) return json({ ok: false, code: "not_configured", error: "Stripe isn't set up on this server" }, 503);
  const answer = await handleConnectEvent(
    { admin: adminClient(envRes.env), stripe: stripeClient(key), livemode: paymentsLivemode() },
    event,
  );
  return json(answer.body, answer.status);
});
