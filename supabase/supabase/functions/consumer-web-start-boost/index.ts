// Supabase Edge Function — consumer-web-start-boost
//
// MESITA-2995: a guest pledges for a place's Premier (or changes their own
// pledge). One pledge per guest per place. What it takes comes from the
// server's quote (_shared/boost.ts `quote`):
//   - pays now (no period running, or a level above it): Stripe Checkout
//     `payment`, held until consumer-web-get-boost confirms the quote;
//   - waits (at or below the running level): Checkout `setup`, saves the card;
//   - an edit of a pledge whose card is saved: no Checkout, written at once.
// A previous Checkout of this pledge is settled first (paid ones confirmed,
// open ones expired), so a payment is never orphaned.
//
// Body: { place_id: uuid, tier: "boost_2x" | "boost_5x" | "boost_10x",
//         interval?: "month" | "year", return_url: string }
// Response: { ok: true, url: string | null, outcome?: "updated" | "confirmed" }
//
// Backers are anonymous (MESITA-2928). Stripe stays in test mode until Pato
// flips STRIPE_MODE and STRIPE_ALLOW_LIVE.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import {
  boostAmountCents,
  boostLivemode,
  boostStripeKey,
  BOOST_CURRENCY,
  chargingPeriod,
  claimWithoutCheckout,
  confirmPledge,
  ensureCustomer,
  type Pledge,
  parseBoostStart,
  pledgeCheckoutParams,
  quote,
  readBoostPlace,
  readLine,
  readPledge,
  runningPeriod,
  stripeClient,
} from "../_shared/boost.ts";

serveJson("consumer-web-start-boost", async (req) => {
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
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);
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
    return json({ ok: false, error: "This place can't be backed" }, 404);
  }

  try {
    let line = await readLine(admin, start.placeId);
    if (!line.ok) return json({ ok: false, error: line.error }, 500);
    let mine = line.pledges.find((p) => p.consumer_id === userId) ?? null;

    // Settle this pledge's previous Checkout before anything else.
    if (mine?.stripe_checkout_session_id) {
      const outcome = await confirmPledge(admin, stripe, mine, livemode);
      if (outcome === "pending") {
        try {
          await stripe("POST", `checkout/sessions/${encodeURIComponent(mine.stripe_checkout_session_id)}/expire`);
        } catch (err) {
          console.error("[consumer-web-start-boost] expire_previous", mine.id, String(err));
        }
        await confirmPledge(admin, stripe, mine, livemode);
      }
      line = await readLine(admin, start.placeId);
      if (!line.ok) return json({ ok: false, error: line.error }, 500);
      mine = line.pledges.find((p) => p.consumer_id === userId) ?? null;
    }

    const now = Date.now();
    const running = runningPeriod(line.periods, now);
    const q = quote({
      tier: start.tier,
      interval: start.interval,
      running,
      charging: chargingPeriod(line.periods) != null,
      pledges: line.pledges,
      mine,
      now,
    });
    const amount = boostAmountCents(start.tier, start.interval);

    if (q.checkout === "none" && mine) {
      if (q.role === "payer" && running && running.backing_id !== mine.id) {
        const outcome = await claimWithoutCheckout(admin, mine, start.tier, start.interval, q, running.id, livemode);
        return json({ ok: true, url: null, outcome: outcome === "confirmed" ? "confirmed" : "updated" });
      }
      // An edit: the new terms apply at the next renewal.
      const { error } = await admin
        .from("place_backings")
        .update({ tier: start.tier, billing_interval: start.interval, amount_cents: amount, updated_at: new Date().toISOString() })
        .eq("id", mine.id);
      if (error) return json({ ok: false, error: `pledge_update: ${error.message}` }, 500);
      return json({ ok: true, url: null, outcome: "updated" });
    }

    const customer = await ensureCustomer(admin, stripe, userId, authRes.user.email ?? null, livemode);
    const quoted = { quoted_period_id: running?.id ?? null, quoted_credit_cents: q.credit_cents };

    let pledge: Pledge;
    let inserted = false;
    if (mine) {
      const { error } = await admin
        .from("place_backings")
        .update({
          pending_tier: start.tier,
          pending_interval: start.interval,
          pending_amount_cents: amount,
          ...quoted,
          updated_at: new Date().toISOString(),
        })
        .eq("id", mine.id);
      if (error) return json({ ok: false, error: `pledge_update: ${error.message}` }, 500);
      pledge = (await readPledge(admin, mine.id))!;
    } else {
      const { data, error } = await admin
        .from("place_backings")
        .insert({
          place_id: start.placeId,
          consumer_id: userId,
          tier: start.tier,
          billing_interval: start.interval,
          amount_cents: amount,
          currency: BOOST_CURRENCY,
          status: "open",
          livemode,
          ...quoted,
        })
        .select("id")
        .single();
      if (error || !data) {
        return json({ ok: false, error: `pledge_insert: ${error?.message ?? "no row"}` }, error?.code === "23505" ? 409 : 500);
      }
      inserted = true;
      pledge = (await readPledge(admin, data.id))!;
    }

    const session = await stripe(
      "POST",
      "checkout/sessions",
      pledgeCheckoutParams({
        kind: q.checkout === "payment" ? "payment" : "setup",
        customer,
        backingId: pledge.id,
        placeId: start.placeId,
        consumerId: userId,
        tier: start.tier,
        interval: start.interval,
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
      console.error(`[consumer-web-start-boost] session_write attempt ${attempt + 1}:`, error.message);
    }
    try {
      await stripe("POST", `checkout/sessions/${encodeURIComponent(sessionId)}/expire`);
    } catch (err) {
      console.error("[consumer-web-start-boost] expire_failed", JSON.stringify({ backing_id: pledge.id, session_id: sessionId, error: String(err) }));
    }
    if (inserted) await admin.from("place_backings").delete().eq("id", pledge.id).eq("status", "open");
    return json({ ok: false, error: "Couldn't open checkout. Try again." }, 502);
  } catch (err) {
    console.error("[consumer-web-start-boost]", err);
    return json({ ok: false, error: "Couldn't open checkout. Try again." }, 502);
  }
});
