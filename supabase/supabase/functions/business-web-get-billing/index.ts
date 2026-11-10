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
// MESITA-3185: also what Stripe already holds for the caller, read-only: their
// saved cards and the receipt of each charge they paid. A failed read leaves
// the page working without them.
//
// Body: { place_id: uuid }
// Response: { ok: true, ...BillingView, plan: Plan | null, cards: SavedCard[], charges: Charge[] }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { requirePlaceAccess } from "../_shared/place-access.ts";
import {
  boostLivemode,
  boostStripeKey,
  readBoostPlace,
  readCustomer,
  readLine,
  runningPeriod,
  stripeClient,
  subscriptionOf,
} from "../_shared/boost.ts";
import { loadPremierPrices } from "../_shared/discovery-config.ts";
import { billingView, type Card, receiptsByIntent, type SavedCard, savedCards } from "./billing.ts";

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

  let cards: SavedCard[] = [];
  let receipts = new Map<string, string>();
  if (key) {
    try {
      const customer = await readCustomer(admin, user.id, boostLivemode());
      if (customer) {
        const stripe = stripeClient(key);
        const id = encodeURIComponent(customer);
        const [methods, paid] = await Promise.all([
          stripe("GET", `customers/${id}/payment_methods`, { type: "card", limit: 20 }),
          stripe("GET", "charges", { customer, limit: 100 }),
        ]);
        cards = savedCards(methods.data, payer === "you" ? sub?.stripe_payment_method_id : null);
        receipts = receiptsByIntent(paid.data);
      }
    } catch (err) {
      console.error("[business-web-get-billing] saved cards and receipts:", String(err));
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
      receipt_url: (p.stripe_payment_intent_id && receipts.get(p.stripe_payment_intent_id)) || null,
    }));

  // Keep's first charge is a price (MESITA-3043): no read, no page.
  let prices: Awaited<ReturnType<typeof loadPremierPrices>>;
  try {
    prices = await loadPremierPrices(admin);
  } catch (err) {
    console.error("[business-web-get-billing] prices:", String(err));
    return json({ ok: false, error: "Premier prices are not available right now" }, 500);
  }

  const view = billingView({
    pledges: line.pledges,
    periods: line.periods,
    manual: line.manual,
    timezone: placeRes.place?.timezone,
    viewerId: user.id,
    card,
    now: Date.now(),
    prices,
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
    cards,
    charges,
  });
});
