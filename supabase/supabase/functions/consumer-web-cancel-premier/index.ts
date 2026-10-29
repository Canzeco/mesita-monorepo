// Supabase Edge Function — consumer-web-cancel-premier
//
// MESITA-2995: a guest leaves a place's Premier line. A backup leaves at
// once; the payer keeps the period they already paid for, and the next
// renewal charges whoever is next in line. Their saved card is detached.
// Only the caller's own pledge (any other id is "not found").
//
// Body: { backing_id: uuid }
// Response: { ok: true }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { boostStripeKey, leavePledge, readPledge, stripeClient } from "../_shared/boost.ts";
import { isUuid } from "../_shared/place-id.ts";

serveJson("consumer-web-cancel-premier", async (req) => {
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
  if (!isUuid(backingId)) return json({ ok: false, error: "backing_id must be a pledge id" }, 400);

  const admin = adminClient(envRes.env);
  try {
    const pledge = await readPledge(admin, backingId);
    if (!pledge || pledge.consumer_id !== authRes.user.id || pledge.status === "ended") {
      return json({ ok: false, error: "Pledge not found" }, 404);
    }
    const key = boostStripeKey();
    if (!key && (pledge.stripe_payment_method_id || pledge.stripe_checkout_session_id)) {
      return json({ ok: false, error: "Payments are not available right now" }, 503);
    }
    await leavePledge(admin, key ? stripeClient(key) : null, pledge);
    return json({ ok: true });
  } catch (err) {
    console.error("[consumer-web-cancel-premier]", err);
    return json({ ok: false, error: "Couldn't leave. Try again." }, 500);
  }
});
