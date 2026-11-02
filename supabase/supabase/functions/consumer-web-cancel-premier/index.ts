// Supabase Edge Function — consumer-web-cancel-premier
//
// MESITA-3092: the payer stops renewing their place's Premier. The period
// already paid runs out; nothing renews it, and their saved card is
// detached. A Checkout of theirs still open is abandoned the same way. No
// verification: it is the payer's own subscription. Anyone else gets "not
// found".
//
// Body: { place_id: uuid }  (or { backing_id: uuid }, builds before
//       MESITA-3092, one release)
// Response: { ok: true }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { boostStripeKey, leavePledge, type Pledge, PLEDGE_COLUMNS, readPledge, stripeClient } from "../_shared/boost.ts";
import { isUuid } from "../_shared/place-id.ts";

serveJson("consumer-web-cancel-premier", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const userId = authRes.user.id;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { place_id: placeId, backing_id: backingId } = bodyRes.body;
  if (!isUuid(placeId) && !isUuid(backingId)) {
    return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  }

  const admin = adminClient(envRes.env);
  const requestId = crypto.randomUUID();
  try {
    let pledge: Pledge | null;
    if (isUuid(placeId)) {
      const { data, error } = await admin
        .from("place_backings")
        .select(PLEDGE_COLUMNS)
        .eq("place_id", placeId)
        .eq("consumer_id", userId)
        .in("status", ["open", "ready"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`pledge_read: ${error.message}`);
      pledge = data as Pledge | null;
    } else {
      pledge = await readPledge(admin, backingId as string);
    }
    if (!pledge || pledge.consumer_id !== userId || pledge.status === "ended") {
      return json({ ok: false, error: "Subscription not found" }, 404);
    }
    const key = boostStripeKey();
    if (!key && (pledge.stripe_payment_method_id || pledge.checkout_kind)) {
      return json({ ok: false, error: "Payments are not available right now" }, 503);
    }
    await leavePledge(admin, key ? stripeClient(key) : null, pledge, pledge.status === "ready" ? "stopped" : "left");
    console.error("[premier] stopped", JSON.stringify({ place_id: pledge.place_id, consumer_id: userId, backing_id: pledge.id }));
    return json({ ok: true });
  } catch (err) {
    console.error("[premier] cancel", JSON.stringify({ request_id: requestId, consumer_id: userId, error: String(err) }));
    return json({ ok: false, error: "Couldn't stop renewing. Try again.", request_id: requestId }, 500);
  }
});
