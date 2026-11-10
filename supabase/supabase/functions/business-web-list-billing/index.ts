// Supabase Edge Function — business-web-list-billing
//
// MESITA-3130. What the caller pays, on every place: the Account page's
// "What you pay". Each place's Billing (business-web-get-billing) is the
// team's view of one place; this is the payer's view of all of them, read
// only by `consumer_id = caller`, so it asks for no place access. A payer who
// left a place, was removed, handed it over or let the claim expire still
// sees the subscription here, and stops it or replaces its card through the
// payer doors of business-web-{cancel,start}-premier.
//
// With `session_id` (Stripe Checkout's return from Update card) it first
// settles the caller's own pledge, as business-web-get-premier does.
//
// Body: { session_id?: string }
// Response: { ok: true, subscriptions: Subscription[] }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { placeAccess } from "../_shared/place-access.ts";
import {
  boostLivemode,
  boostStripeKey,
  confirmPledge,
  type Pledge,
  PLEDGE_COLUMNS,
  readLine,
  runningPeriod,
  stripeClient,
  subscriptionOf,
} from "../_shared/boost.ts";

const LIMIT = 50;

serveJson("business-web-list-billing", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const sessionId = typeof bodyRes.body.session_id === "string" ? bodyRes.body.session_id : null;

  const read = () =>
    admin
      .from("place_backings")
      .select(PLEDGE_COLUMNS)
      .eq("consumer_id", user.id)
      .in("status", ["open", "ready"])
      .order("created_at", { ascending: false })
      .limit(LIMIT);

  let res = await read();
  if (res.error) return json({ ok: false, error: `pledges_read: ${res.error.message}` }, 500);
  let pledges = (res.data ?? []) as Pledge[];

  let outcome: string | undefined;
  if (sessionId) {
    outcome = "none";
    const own = pledges.find((p) => p.stripe_checkout_session_id === sessionId);
    const key = boostStripeKey();
    if (own && key) {
      try {
        outcome = await confirmPledge(admin, stripeClient(key), own, boostLivemode());
      } catch (err) {
        // The reply says pending; the cron settles it.
        console.error("[business-web-list-billing] confirm", JSON.stringify({ backing_id: own.id, error: String(err) }));
        outcome = "pending";
      }
      res = await read();
      if (res.error) return json({ ok: false, error: `pledges_read: ${res.error.message}` }, 500);
      pledges = (res.data ?? []) as Pledge[];
    }
  }

  // Only the subscriptions: an `open` pledge is a Checkout still in flight.
  const subs = pledges.filter((p) => p.status === "ready");
  const placeIds = [...new Set(subs.map((p) => p.place_id))];

  const names = new Map<string, { name: string | null; photo: string | null }>();
  if (placeIds.length) {
    const { data, error } = await admin.from("profiles").select("id, name, photos").in("id", placeIds);
    if (error) return json({ ok: false, error: `profiles_read: ${error.message}` }, 500);
    for (const row of (data ?? []) as Array<{ id: string; name: string | null; photos: string[] | null }>) {
      names.set(row.id, { name: row.name, photo: row.photos?.[0] ?? null });
    }
  }

  const now = Date.now();
  try {
    const subscriptions = await Promise.all(subs.map(async (sub) => {
      const [line, access] = await Promise.all([readLine(admin, sub.place_id), placeAccess(admin, user, sub.place_id)]);
      if (!line.ok) throw new Error(line.error);
      const running = runningPeriod(line.periods, now);
      // Still the place's one subscription, and the period it paid for.
      const current = subscriptionOf(line.pledges)?.id === sub.id;
      const paidUntil = current && running?.backing_id === sub.id ? running.ends_at : null;
      return {
        id: sub.id,
        place_id: sub.place_id,
        name: names.get(sub.place_id)?.name ?? null,
        photo: names.get(sub.place_id)?.photo ?? null,
        tier: sub.tier,
        interval: sub.billing_interval,
        amount_cents: sub.amount_cents,
        ends_at: paidUntil,
        renews: !!sub.stripe_payment_method_id,
        pending: sub.pending_tier ? { tier: sub.pending_tier, interval: sub.pending_interval } : null,
        runs_place: !!access,
      };
    }));
    return json({ ok: true, subscriptions, ...(outcome === undefined ? {} : { outcome }) });
  } catch (err) {
    console.error("[business-web-list-billing] read", JSON.stringify({ consumer_id: user.id, error: String(err) }));
    return json({ ok: false, error: "Billing didn't load. Try again." }, 500);
  }
});
