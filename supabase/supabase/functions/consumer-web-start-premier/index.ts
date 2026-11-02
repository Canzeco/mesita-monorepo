// Supabase Edge Function — consumer-web-start-premier
//
// MESITA-3092: one Paid subscription per place. What choosing a plan takes
// comes from the server's quote (_shared/boost.ts `quote`):
//   - buy: no subscription and no paid period run → a new pledge and a
//     Checkout `payment` at full price, held until it is confirmed;
//   - change (the payer, or the former payer above their running level):
//     an upgrade pays now minus the unused paid days (Checkout `payment`, or
//     no Checkout when the credit covers it on the saved card); at or below
//     the running level the new terms apply at the next renewal;
//   - resume (the former payer at or below the running level): a Checkout
//     `setup` saves a card; the first charge is at the running period's end;
//   - update_card (`kind: "update_card"`, the payer): a Checkout `setup`
//     replaces the saved card.
// A previous Checkout of the caller's pledge is settled first (paid ones
// confirmed, open ones expired), so a payment is never orphaned.
//
// Body: { place_id: uuid, tier: "boost_2x" | "boost_5x",
//         interval?: "month" | "year", return_url: string }
//     | { place_id: uuid, kind: "update_card", return_url: string }
// Response: { ok: true, url: string | null, outcome?: "updated" | "confirmed" }
//         | { ok: false, code: "covered_by_mesita" | "premier_taken" | "charging"
//                              | "not_payer" | "lost", error }  (HTTP 200)
//
// Stripe stays in test mode until Pato flips STRIPE_MODE and STRIPE_ALLOW_LIVE.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import {
  boostAmountCents,
  boostLivemode,
  boostStripeKey,
  type CheckoutKind,
  chargingPeriod,
  claimWithoutCheckout,
  confirmPledge,
  ensureCustomer,
  type Pledge,
  parseBoostStart,
  pledgeCheckoutParams,
  PREMIER_CURRENCY,
  type Quote,
  quote,
  readBoostPlace,
  readLine,
  readPledge,
  runningManual,
  runningPeriod,
  stripeClient,
  subscriptionOf,
  TIER_RANK,
  viewerOf,
} from "../_shared/boost.ts";

const refuse = (code: string, error: string) => json({ ok: false, code, error });

serveJson("consumer-web-start-premier", async (req) => {
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
  const parsed = parseBoostStart(bodyRes.body);
  if (!parsed.ok) {
    return json({ ok: false, ...(parsed.code ? { code: parsed.code } : {}), error: parsed.error }, 400);
  }
  const start = parsed.start;

  const key = boostStripeKey();
  if (!key) return json({ ok: false, error: "Payments are not available right now" }, 503);
  const stripe = stripeClient(key);
  const livemode = boostLivemode();

  const admin = adminClient(envRes.env);
  const placeRes = await readBoostPlace(admin, start.placeId);
  if (!placeRes.ok) return json({ ok: false, error: placeRes.error }, 500);
  const place = placeRes.place;
  if (!place || place.state !== "active") {
    return json({ ok: false, error: "This place can't be made Premier" }, 404);
  }

  const requestId = crypto.randomUUID();
  try {
    let line = await readLine(admin, start.placeId);
    if (!line.ok) throw new Error(line.error);
    const liveOf = (pledges: Pledge[]) =>
      pledges.find((p) => p.consumer_id === userId && (p.status === "open" || p.status === "ready")) ?? null;
    let mine = liveOf(line.pledges);

    // Settle this pledge's previous Checkout before anything else.
    if (mine?.checkout_kind && mine.stripe_checkout_session_id) {
      const outcome = await confirmPledge(admin, stripe, mine, livemode);
      if (outcome === "pending") {
        try {
          await stripe("POST", `checkout/sessions/${encodeURIComponent(mine.stripe_checkout_session_id)}/expire`);
        } catch (err) {
          console.error("[consumer-web-start-premier] expire_previous", mine.id, String(err));
        }
        const fresh = await readPledge(admin, mine.id);
        if (fresh) await confirmPledge(admin, stripe, fresh, livemode);
      }
      line = await readLine(admin, start.placeId);
      if (!line.ok) throw new Error(line.error);
      mine = liveOf(line.pledges);
    }

    const now = Date.now();
    const running = runningPeriod(line.periods, now);
    const subscription = subscriptionOf(line.pledges);
    const viewer = viewerOf({ consumerId: userId, subscription, running, pledges: line.pledges });
    const charging = chargingPeriod(line.periods) != null;

    let kind: CheckoutKind;
    let q: Quote;
    if (start.updateCard) {
      if (viewer !== "payer" || !subscription) return refuse("not_payer", "Only the guest who pays can update the card");
      kind = "update_card";
      q = { price_cents: subscription.amount_cents, charge_cents: 0, credit_cents: 0, extra_days: 0, new_ends_at: null, renews_at: null, kind: "change", blocked_by: null, checkout: "setup", covered: false };
    } else {
      q = quote({
        tier: start.tier,
        interval: start.interval,
        running,
        charging,
        viewer,
        subscription,
        now,
        manualTier: runningManual(line.manual, now)?.tier ?? 0,
      });
      if (q.covered) return refuse("covered_by_mesita", "Mesita already gives this place this level or more");
      if (q.blocked_by === "taken") return refuse("premier_taken", "Someone else pays for Premier here");
      if (q.kind === "blocked") return refuse("charging", "A renewal is being charged. Try again in a few minutes.");
      kind = q.kind === "buy" ? "buy" : q.kind === "resume" ? "resume" : "change";
    }
    const amount = boostAmountCents(start.tier, start.interval);

    if (q.checkout === "none" && subscription && viewer === "payer") {
      if (running && TIER_RANK[start.tier] > running.tier) {
        const outcome = await claimWithoutCheckout(admin, subscription, start.tier, start.interval, q, running.id, livemode);
        if (outcome === "covered") return refuse("covered_by_mesita", "Mesita already gives this place this level or more");
        if (outcome === "lost") return refuse("lost", "Premier changed while you were choosing. Look again.");
        return json({ ok: true, url: null, outcome: "confirmed" });
      }
      // A change at or below the running level: applies at the next renewal.
      const { error } = await admin
        .from("place_backings")
        .update({ tier: start.tier, billing_interval: start.interval, amount_cents: amount, updated_at: new Date().toISOString() })
        .eq("id", subscription.id);
      if (error) throw new Error(`pledge_update: ${error.message}`);
      return json({ ok: true, url: null, outcome: "updated" });
    }

    const customer = await ensureCustomer(admin, stripe, userId, authRes.user.email ?? null, livemode);

    // The payer's Checkout rides on their subscription; anything else is a
    // new pledge, which only premier_make_payer can make the subscription.
    let pledge: Pledge;
    let inserted = false;
    if (viewer === "payer" && subscription) {
      const patch: Record<string, unknown> = { checkout_kind: kind, updated_at: new Date().toISOString() };
      if (kind === "change") {
        Object.assign(patch, {
          pending_tier: start.tier,
          pending_interval: start.interval,
          pending_amount_cents: amount,
          quoted_period_id: running?.id ?? null,
          quoted_credit_cents: q.credit_cents,
        });
      }
      const { error } = await admin.from("place_backings").update(patch).eq("id", subscription.id);
      if (error) throw new Error(`pledge_update: ${error.message}`);
      pledge = (await readPledge(admin, subscription.id))!;
    } else {
      if (mine) {
        // An unfinished pledge of the caller's: it is replaced by this one.
        const { error } = await admin
          .from("place_backings")
          .update({ status: "ended", ended_reason: "left", ended_at: new Date().toISOString(), checkout_kind: null, updated_at: new Date().toISOString() })
          .eq("id", mine.id)
          .eq("status", "open");
        if (error) throw new Error(`pledge_replace: ${error.message}`);
      }
      const { data, error } = await admin
        .from("place_backings")
        .insert({
          place_id: start.placeId,
          consumer_id: userId,
          tier: start.tier,
          billing_interval: start.interval,
          amount_cents: amount,
          currency: PREMIER_CURRENCY,
          status: "open",
          livemode,
          checkout_kind: kind,
          quoted_period_id: running?.id ?? null,
          quoted_credit_cents: q.credit_cents,
        })
        .select("id")
        .single();
      if (error || !data) {
        if (error?.code === "23505") return refuse("lost", "Premier changed while you were choosing. Look again.");
        throw new Error(`pledge_insert: ${error?.message ?? "no row"}`);
      }
      inserted = true;
      pledge = (await readPledge(admin, data.id))!;
    }

    const session = await stripe(
      "POST",
      "checkout/sessions",
      pledgeCheckoutParams({
        mode: q.checkout === "payment" ? "payment" : "setup",
        kind,
        customer,
        backingId: pledge.id,
        placeId: start.placeId,
        consumerId: userId,
        tier: start.updateCard ? pledge.tier : start.tier,
        interval: start.updateCard ? pledge.billing_interval : start.interval,
        quote: q,
        placeName: String(place.name ?? "Mesita place"),
        returnUrl: start.returnUrl,
        nowSec: Math.floor(now / 1000),
      }),
    );
    const sessionId = String(session.id ?? "");

    // confirmPledge finds the Checkout through this id, so a row without it
    // is a payment nobody can confirm: retried once, then the session is
    // expired and no url is sent.
    for (let attempt = 0; attempt < 2; attempt++) {
      const { error } = await admin
        .from("place_backings")
        .update({ stripe_checkout_session_id: sessionId, updated_at: new Date().toISOString() })
        .eq("id", pledge.id);
      if (!error) return json({ ok: true, url: session.url });
      console.error(`[consumer-web-start-premier] session_write attempt ${attempt + 1}:`, error.message);
    }
    try {
      await stripe("POST", `checkout/sessions/${encodeURIComponent(sessionId)}/expire`);
    } catch (err) {
      console.error("[consumer-web-start-premier] expire_failed", JSON.stringify({ backing_id: pledge.id, session_id: sessionId, error: String(err) }));
    }
    if (inserted) await admin.from("place_backings").delete().eq("id", pledge.id).eq("status", "open");
    else await admin.from("place_backings").update({ checkout_kind: null, updated_at: new Date().toISOString() }).eq("id", pledge.id);
    return json({ ok: false, error: "Couldn't open checkout. Try again.", request_id: requestId }, 502);
  } catch (err) {
    console.error("[premier] start", JSON.stringify({ request_id: requestId, place_id: start.placeId, consumer_id: userId, error: String(err) }));
    return json({ ok: false, error: "Couldn't open checkout. Try again.", request_id: requestId }, 502);
  }
});
