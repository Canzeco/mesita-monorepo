// Supabase Edge Function — consumer-web-get-boost
//
// MESITA-1998: a place's Boost as the place screen shows it — its tier,
// how many guests back it (never who: MESITA-2928), and the signed-in guest's own backings (to cancel). With `session_id`
// (Checkout's return, `?boost=`) it first confirms that guest's backing
// from Stripe, so the tier is right the moment they land. A guest who never
// comes back is confirmed by supabase-cron-sync-boosts (MESITA-2857).
//
// Body: { place_id: uuid, session_id?: string }
// Response: { ok: true, tier: 0|1|2, backers: number,
//             mine: Backing[], confirmed?: boolean }
//
// Anonymous callers get the tier and the count; never a Stripe id.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getOptionalAuthedUser, readEFEnv } from "../_shared/auth.ts";
import {
  boostStripeKey,
  confirmBackingFromSession,
  isLiveBacking,
  readBoostPlace,
  stripeClient,
} from "../_shared/boost.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serveJson("consumer-web-get-boost", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const { user } = await getOptionalAuthedUser(req, envRes.env);

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (typeof placeId !== "string" || !UUID_RE.test(placeId)) {
    return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  }
  const sessionId = typeof bodyRes.body.session_id === "string" ? bodyRes.body.session_id : null;

  const admin = adminClient(envRes.env);
  let confirmed: boolean | undefined;

  // Checkout's return: confirm the guest's own backing from Stripe.
  if (sessionId && user) {
    confirmed = false;
    const key = boostStripeKey();
    const { data: open } = await admin
      .from("place_backings")
      .select("id")
      .eq("stripe_checkout_session_id", sessionId)
      .eq("consumer_id", user.id)
      .eq("place_id", placeId)
      .maybeSingle();
    if (key && open) {
      try {
        ({ confirmed } = await confirmBackingFromSession(admin, stripeClient(key), open.id, sessionId));
      } catch (err) {
        console.error("[consumer-web-get-boost] confirm:", err);
      }
    }
  }

  const [placeRes, { data: rows, error }] = await Promise.all([
    readBoostPlace(admin, placeId),
    admin
      .from("place_backings")
      .select("id, consumer_id, tier, billing_interval, amount_cents, status, current_period_end, cancel_at_period_end, created_at")
      .eq("place_id", placeId)
      .order("created_at", { ascending: true }),
  ]);
  if (!placeRes.ok) return json({ ok: false, error: placeRes.error }, 500);
  if (error) return json({ ok: false, error: `backings_read: ${error.message}` }, 500);

  const live = (rows ?? []).filter((r) => isLiveBacking(r));

  const mine = user
    ? (rows ?? [])
      .filter((r) => r.consumer_id === user.id && r.status !== "open")
      .map((r) => ({
        id: r.id,
        tier: r.tier,
        interval: r.billing_interval,
        amount_cents: r.amount_cents,
        status: r.status,
        current_period_end: r.current_period_end,
        cancel_at_period_end: r.cancel_at_period_end,
        live: isLiveBacking(r),
      }))
    : [];

  return json({
    ok: true,
    tier: placeRes.place?.boost_tier ?? 0,
    backers: new Set(live.map((r) => r.consumer_id ?? r.id)).size,
    mine,
    ...(confirmed === undefined ? {} : { confirmed }),
  });
});
