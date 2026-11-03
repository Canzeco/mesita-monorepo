// Supabase Edge Function — business-web-get-billing
//
// MESITA-3128. A place's Billing page: its paid Premier (plan, price, next
// charge), the card on it and what it charged. The whole team sees the plan
// and the charges; the card is the payer's own, so Stripe is asked for it
// only when the caller pays (brand, last 4, expiry — never more).
//
// MESITA-3166 (Design D1–D13): it also says what runs and what is charged
// next — the level and until when, the Refill days as rows, the
// subscription's state (running, paused under Refill days, waiting for its
// first charge, charging), the Keep prompt in a run's last 7 days, the moved
// date and the card expiring before the next charge, all dated in the place's
// time zone. `billing.ts` decides; the page only formats.
//
// Body: { place_id: uuid }
// Response: { ok: true, ...BillingView, plan: Plan | null, charges: Charge[] }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/business-request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { requirePlaceAccess } from "../_shared/place-access.ts";
import { boostLivemode, boostStripeKey, readBoostPlace, readLine, runningPeriod, stripeClient, subscriptionOf } from "../_shared/boost.ts";
import { billingView, type Card } from "./billing.ts";

serveJson("business-web-get-billing", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);

  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;

  // Every period since the start: Billing lists what was ever charged.
  const line = await readLine(admin, placeId, { periodsSince: 0 });
  if (!line.ok) return json({ ok: false, error: line.error }, 500);
  const placeRes = await readBoostPlace(admin, placeId);
  if (!placeRes.ok) return json({ ok: false, error: placeRes.error }, 500);

  const sub = subscriptionOf(line.pledges);
  const running = runningPeriod(line.periods, Date.now());
  const payer = sub ? (sub.consumer_id === user.id ? "you" : "team") : null;

  let card: Card | null = null;
  const key = boostStripeKey();
  if (payer === "you" && sub?.stripe_payment_method_id && key && sub.livemode === boostLivemode()) {
    try {
      const pm = await stripeClient(key)("GET", `payment_methods/${encodeURIComponent(sub.stripe_payment_method_id)}`);
      const c = pm.card as Partial<Card> | undefined;
      if (c?.last4) {
        card = { brand: String(c.brand ?? "card"), last4: c.last4, exp_month: Number(c.exp_month), exp_year: Number(c.exp_year) };
      }
    } catch (err) {
      console.error("[business-web-get-billing] payment method:", String(err));
    }
  }

  const charges = line.periods
    .filter((p) => p.backing_id && (p.charged_cents > 0 || p.status === "declined" || p.status === "charging"))
    .map((p) => ({
      id: p.id,
      at: p.created_at,
      tier: p.tier,
      interval: p.billing_interval,
      starts_at: p.starts_at,
      ends_at: p.ends_at,
      amount_cents: p.charged_cents,
      status: p.status === "charging" ? "charging" : p.status === "declined" ? "declined" : "paid",
    }));

  const view = billingView({
    pledges: line.pledges,
    periods: line.periods,
    manual: line.manual,
    timezone: placeRes.place?.timezone,
    viewerId: user.id,
    card,
    now: Date.now(),
  });

  return json({
    ok: true,
    ...view,
    // Builds before MESITA-3166 read `plan`; one release.
    plan: sub
      ? {
        tier: sub.tier,
        interval: sub.billing_interval,
        amount_cents: sub.amount_cents,
        next_charge_at: running?.backing_id === sub.id ? running.ends_at : null,
      }
      : null,
    charges,
  });
});
