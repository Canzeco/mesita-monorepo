// MESITA-2995 / MESITA-3092 — Premier's money rules: what a guest is charged,
// who may buy (one subscription per place), what an upgrade's unused paid
// days are worth (Manual cover is not paid time), which key addresses
// Stripe, and the factor a paid tier earns in the Area score. Pure only.

import { assertEquals } from "jsr:@std/assert@1";
import {
  boostAmountCents,
  chargeKey,
  chargeOutcome,
  creditCents,
  extraDays,
  inEarlyWindow,
  intervalEnd,
  canResume,
  type Manual,
  parseBoostStart,
  PREMIER_TIERS,
  type Period,
  type Pledge,
  pledgeCheckoutParams,
  quote,
  quotes,
  renewalChargeParams,
  runEndAtOrAbove,
  staleChargeAction,
  viewerOf,
} from "./boost.ts";
import { premierFactor } from "./area-score.ts";
import { boostLivemode, boostStripeKey, isAllowedReturnUrl, paymentsLivemode, paymentsStripeKey, StripeError } from "./stripe.ts";

const DAY = 86_400_000;

/** Reads a nested value from Stripe params without `any`. */
function at(o: unknown, ...path: (string | number)[]): unknown {
  let v = o;
  for (const k of path) v = (v as Record<string | number, unknown> | undefined)?.[k];
  return v;
}
const T0 = Date.parse("2026-11-01T00:00:00Z");

function pledge(over: Partial<Pledge> & { id: string }): Pledge {
  return {
    place_id: "place",
    consumer_id: `c-${over.id}`,
    tier: "boost_2x",
    billing_interval: "month",
    amount_cents: 1000,
    status: "ready",
    queued_at: new Date(T0).toISOString(),
    stripe_payment_method_id: "pm_x",
    stripe_checkout_session_id: null,
    pending_tier: null,
    pending_interval: null,
    pending_amount_cents: null,
    quoted_period_id: null,
    quoted_credit_cents: 0,
    livemode: false,
    created_at: new Date(T0).toISOString(),
    ended_at: null,
    ended_reason: null,
    checkout_kind: null,
    notice_dismissed_at: null,
    ...over,
  };
}

function period(over: Partial<Period> & { id: string }): Period {
  return {
    place_id: "place",
    backing_id: null,
    granted_by: null,
    tier: 1,
    billing_interval: "month",
    starts_at: new Date(T0).toISOString(),
    ends_at: new Date(T0 + 30 * DAY).toISOString(),
    price_cents: 1000,
    credit_cents: 0,
    extra_days: 0,
    charged_cents: 1000,
    stripe_payment_intent_id: null,
    stripe_checkout_session_id: null,
    status: "paid",
    created_at: new Date(T0).toISOString(),
    remaining_at_cover_sec: null,
    covered_until: null,
    ...over,
  };
}

const PAYER = pledge({ id: "a" });

Deno.test("premier: two plans, yearly only, Pro $99 · Max $999 (MESITA-3285)", () => {
  assertEquals(boostAmountCents("boost_2x"), 9900);
  assertEquals(boostAmountCents("boost_5x"), 99900);
  assertEquals(PREMIER_TIERS, ["boost_2x", "boost_5x"]);
  const q = quote({ tier: "boost_2x", running: null, charging: false, viewer: "stranger", subscription: null, now: T0 });
  assertEquals(q.new_ends_at, intervalEnd(new Date(T0), "year").toISOString(), "a new plan runs a year");
  const all = quotes({ running: null, charging: false, viewer: "stranger", subscription: null, now: T0 });
  assertEquals(Object.keys(all.boost_2x), ["year"], "no monthly quote");
});

Deno.test("premier: monthly is refused at the door, even from an old build (MESITA-3285)", () => {
  const ok = { place_id: "11111111-1111-4111-8111-111111111111", tier: "boost_2x", return_url: "https://business.mesita.ai/x" };
  const month = parseBoostStart({ ...ok, interval: "month" });
  assertEquals(month.ok ? null : month.code, "interval_retired");
  const none = parseBoostStart(ok);
  assertEquals(none.ok ? none.start.interval : null, "year");
});

Deno.test("premier: the operator's prices reach the quote, and its price is what the Checkout carries (MESITA-3043)", () => {
  const prices = { boost_2x: 1500, boost_5x: 20000 };
  assertEquals(boostAmountCents("boost_5x", prices), 20000);
  const q = quote({ tier: "boost_2x", running: null, charging: false, viewer: "stranger", subscription: null, now: T0, prices });
  assertEquals([q.price_cents, q.charge_cents], [1500, 1500]);
  const pay = pledgeCheckoutParams({
    mode: "payment",
    kind: "buy",
    customer: "cus_1",
    backingId: "b1",
    placeId: "p1",
    consumerId: "c1",
    tier: "boost_2x",
    interval: "year",
    quote: q,
    placeName: "Cafe",
    returnUrl: "https://mesita.ai/x",
    nowSec: 1000,
  });
  assertEquals(at(pay, "metadata", "price_cents"), "1500");
  assertEquals(at(pay, "line_items", 0, "price_data", "unit_amount"), 1500);
});

Deno.test("premier: 2X → 5X credit at day 0 and mid-period, from a legacy month or a year (MESITA-3041, MESITA-3285)", () => {
  for (const [interval, price2] of [["month", 1000], ["year", 9900]] as const) {
    const price5 = boostAmountCents("boost_5x");
    const ends = new Date(intervalEnd(new Date(T0), interval)).toISOString();
    const running = period({ id: "p", backing_id: "a", tier: 1, billing_interval: interval, price_cents: price2, ends_at: ends });
    const length = intervalEnd(new Date(T0), interval).getTime() - T0;
    for (const at of [0, Math.floor(length / 2)]) {
      const q = quote({ tier: "boost_5x", running, charging: false, viewer: "payer", subscription: PAYER, now: T0 + at });
      const credit = Math.floor((price2 * (length - at)) / length);
      assertEquals([q.price_cents, q.credit_cents, q.charge_cents], [price5, credit, price5 - credit], `${interval} +${at}`);
    }
  }
});

Deno.test("premier: periods are calendar months and years (like the SQL)", () => {
  assertEquals(intervalEnd(new Date("2026-01-31T00:00:00Z"), "month").toISOString(), "2026-03-03T00:00:00.000Z");
  assertEquals(intervalEnd(new Date("2026-11-01T00:00:00Z"), "month").toISOString(), "2026-12-01T00:00:00.000Z");
  assertEquals(intervalEnd(new Date("2026-11-01T00:00:00Z"), "year").toISOString(), "2027-11-01T00:00:00.000Z");
  assertEquals(intervalEnd(new Date("2026-11-01T00:00:00Z"), "month", 12).toISOString(), "2026-12-13T00:00:00.000Z");
});

Deno.test("premier: credit is the unused share of a paid period; a grant credits nothing", () => {
  const p = period({ id: "p" });
  assertEquals(creditCents(p, T0), 1000);
  assertEquals(creditCents(p, T0 + 15 * DAY), 500);
  assertEquals(creditCents(p, T0 + 30 * DAY), 0);
  assertEquals(creditCents(null, T0), 0);
  assertEquals(creditCents(period({ id: "g", price_cents: 0, charged_cents: 0 }), T0 + DAY), 0);
  assertEquals(creditCents(period({ id: "y", billing_interval: "year", price_cents: 10000, ends_at: new Date(T0 + 365 * DAY).toISOString() }), T0 + 73 * DAY), 8000);
});

Deno.test("premier: a half-used legacy $10 monthly 2X upgraded to a year of 5X ($999) costs $994 today", () => {
  const running = period({ id: "p", backing_id: "a" });
  const q = quote({
    tier: "boost_5x",
    running,
    charging: false,
    viewer: "payer",
    subscription: PAYER,
    now: T0 + 15 * DAY,
  });
  assertEquals(q.charge_cents, 99400);
  assertEquals(q.credit_cents, 500);
  assertEquals(q.kind, "change");
  assertEquals(q.checkout, "payment");
});

// MESITA-3092 R2: one subscription per place.
Deno.test("premier: nobody else can buy while a subscription stands or a paid period runs", () => {
  const running = period({ id: "p", backing_id: "a" });
  for (const [label, args] of [
    ["running and renewing", { running, subscription: PAYER }],
    ["running, payer stopped", { running, subscription: null }],
    ["between periods", { running: null, subscription: PAYER }],
  ] as const) {
    const q = quote({ tier: "boost_5x", charging: false, viewer: "stranger", now: T0 + DAY, ...args });
    assertEquals([q.kind, q.blocked_by, q.charge_cents, q.checkout], ["blocked", "taken", 0, "none"], label);
  }
});

Deno.test("premier: the payer is the guest of the place's ready pledge, never the running period's pledge", () => {
  const running = period({ id: "p", backing_id: "old" });
  const pledges = [pledge({ id: "old", consumer_id: "c-old", status: "ended", ended_reason: "taken_over" }), pledge({ id: "new", consumer_id: "c-new" })];
  const subscription = pledges[1];
  assertEquals(viewerOf({ consumerId: "c-new", subscription, running, pledges }), "payer");
  assertEquals(viewerOf({ consumerId: "c-old", subscription, running, pledges }), "stranger");
});

Deno.test("premier: the former payer resumes at or below their level ($0 now, renews at the end) and only after stopping", () => {
  const running = period({ id: "p", backing_id: "a", tier: 2, ends_at: new Date(T0 + 20 * DAY).toISOString() });
  const stopped = [pledge({ id: "a", consumer_id: "c-a", status: "ended", ended_reason: "stopped" })];
  const viewer = viewerOf({ consumerId: "c-a", subscription: null, running, pledges: stopped });
  assertEquals(viewer, "former_payer");
  assertEquals(canResume({ viewer, running, pledges: stopped, charging: false }), true);
  const q = quote({ tier: "boost_2x", running, charging: false, viewer, subscription: null, now: T0 });
  assertEquals([q.kind, q.charge_cents, q.checkout, q.renews_at], ["resume", 0, "setup", running.ends_at]);
  // Above their level it is an upgrade with their own credit.
  const up = quote({ tier: "boost_5x", running: period({ id: "p", backing_id: "a", tier: 1 }), charging: false, viewer, subscription: null, now: T0 });
  assertEquals([up.kind, up.checkout], ["change", "payment"]);
  for (const reason of ["taken_over", "stopped_by_place", "declined"] as const) {
    const ended = [pledge({ id: "a", consumer_id: "c-a", status: "ended", ended_reason: reason })];
    assertEquals(canResume({ viewer, running, pledges: ended, charging: false }), false, reason);
  }
  assertEquals(canResume({ viewer, running, pledges: stopped, charging: true }), false, "charging");
});

Deno.test("premier: credit above the new price is never lost — it becomes extra days", () => {
  // A fresh yearly period stored at $1,500 upgraded to a year of 5X ($999):
  // $501 left over becomes 183 days.
  const running = period({
    id: "p",
    backing_id: "a",
    billing_interval: "year",
    price_cents: 150000,
    ends_at: new Date(T0 + 365 * DAY).toISOString(),
  });
  const q = quote({ tier: "boost_5x", running, charging: false, viewer: "former_payer", subscription: null, now: T0 });
  assertEquals(q.charge_cents, 0);
  assertEquals(q.credit_cents, 99900);
  assertEquals(q.extra_days, 183);
  assertEquals(q.checkout, "setup");
  assertEquals(extraDays(0, 10000, "month", T0), 0);
});

Deno.test("premier: a charge under 50 cents is not charged (Stripe's minimum)", () => {
  // 5X yearly ($999) with $998.60 of credit left: a 40-cent charge becomes 0.
  const running = period({ id: "p", backing_id: "a", tier: 1, price_cents: 99860 });
  const q = quote({ tier: "boost_5x", running, charging: false, viewer: "payer", subscription: PAYER, now: T0 });
  assertEquals(q.charge_cents, 0);
  assertEquals(q.checkout, "none", "the payer's saved card: no Checkout");
});

Deno.test("premier: nothing running and no subscription → anyone buys at full price now", () => {
  const q = quote({ tier: "boost_2x", running: null, charging: false, viewer: "stranger", subscription: null, now: T0 });
  assertEquals([q.charge_cents, q.credit_cents, q.kind, q.checkout], [9900, 0, "buy", "payment"]);
  assertEquals(q.new_ends_at, "2027-11-01T00:00:00.000Z");
});

Deno.test("premier: the payer changing at or below the running level keeps the period they bought", () => {
  const running = period({ id: "p", backing_id: "a", tier: 2 });
  const q = quote({ tier: "boost_2x", running, charging: false, viewer: "payer", subscription: PAYER, now: T0 });
  assertEquals([q.charge_cents, q.kind, q.checkout, q.renews_at], [0, "change", "none", running.ends_at]);
});

Deno.test("premier: while a renewal is charging nothing starts", () => {
  const q = quote({ tier: "boost_5x", running: null, charging: true, viewer: "payer", subscription: PAYER, now: T0 });
  assertEquals([q.kind, q.blocked_by, q.charge_cents], ["blocked", "charging", 0]);
});

// MESITA-3092 F2: Manual at or above the paid level pauses the paid period.
Deno.test("premier: credit counts paid time only — frozen while Manual covers, running again after", () => {
  // 10 days used of a $10 month, then Manual 5X for 30 days: the end moved to
  // cover end + 20 days. Mid-cover the credit is still 20 days' worth.
  const coverEnd = T0 + 40 * DAY;
  const p = period({
    id: "p",
    starts_at: new Date(T0).toISOString(),
    ends_at: new Date(coverEnd + 20 * DAY).toISOString(),
    remaining_at_cover_sec: 20 * 86_400,
    covered_until: new Date(coverEnd).toISOString(),
  });
  const length = intervalEnd(new Date(T0), "month").getTime() - T0;
  const twenty = Math.floor((1000 * 20 * DAY) / length);
  assertEquals(creditCents(p, T0 + 25 * DAY), twenty, "mid-cover");
  assertEquals(creditCents(p, coverEnd + 5 * DAY), Math.floor((1000 * 15 * DAY) / length), "5 days after the cover");
  // An early end: covered_until moved back to the day it stopped; the moved
  // end is kept (a gift) but credits nothing.
  const early = { ...p, covered_until: new Date(T0 + 15 * DAY).toISOString() };
  assertEquals(creditCents(early, T0 + 35 * DAY), 0, "paid days used up; the gift days are not credit");
});

Deno.test("premier: only a card decline is a decline; anything else is asked again", () => {
  assertEquals(chargeOutcome({ pi: { status: "succeeded" } }), "paid");
  assertEquals(chargeOutcome({ pi: { status: "requires_action" } }), "declined");
  assertEquals(chargeOutcome({ error: new StripeError("payment_intents", "card_error", "card_declined", 402, "declined") }), "declined");
  assertEquals(chargeOutcome({ error: new StripeError("payment_intents", "api_error", "", 500, "boom") }), "unknown");
  assertEquals(chargeOutcome({ error: new TypeError("network") }), "unknown");
  assertEquals(chargeOutcome({ pi: { status: "processing" } }), "unknown");
});

Deno.test("premier: a charge stuck past 24 h is read before it is cancelled", () => {
  assertEquals(staleChargeAction("succeeded"), "paid");
  assertEquals(staleChargeAction("processing"), "wait");
  assertEquals(staleChargeAction("requires_payment_method"), "cancel");
});

Deno.test("premier: one idempotency key per attempt row", () => {
  assertEquals(chargeKey("period-1"), "premier-charge:period-1");
});

Deno.test("premier: pays-now Checkout holds the card (manual capture) and saves it; setup only saves", () => {
  const q = quote({ tier: "boost_2x", running: null, charging: false, viewer: "stranger", subscription: null, now: T0 });
  const pay = pledgeCheckoutParams({
    mode: "payment",
    kind: "buy",
    customer: "cus_1",
    backingId: "b1",
    placeId: "p1",
    consumerId: "c1",
    tier: "boost_2x",
    interval: "year",
    quote: q,
    placeName: "Cafe",
    returnUrl: "https://mesita.ai/web/place/x?tab=premier",
    nowSec: 1000,
  });
  assertEquals(pay.mode, "payment");
  assertEquals(at(pay, "payment_intent_data", "capture_method"), "manual");
  assertEquals(at(pay, "payment_intent_data", "setup_future_usage"), "off_session");
  assertEquals(at(pay, "line_items", 0, "price_data", "unit_amount"), 9900);
  assertEquals(String(at(pay, "line_items", 0, "price_data", "product_data", "name")).includes("99 USD a year"), true);
  assertEquals(at(pay, "line_items", 0, "price_data", "recurring"), undefined);
  assertEquals(pay.success_url, "https://mesita.ai/web/place/x?tab=premier&boost={CHECKOUT_SESSION_ID}");
  assertEquals(pay.expires_at, 1000 + 31 * 60);
  assertEquals(at(pay, "metadata", "backing_id"), "b1");
  assertEquals(at(pay, "metadata", "kind"), "buy");
  const setup = pledgeCheckoutParams({ ...{
    mode: "setup" as const,
    kind: "resume" as const,
    customer: "cus_1",
    backingId: "b1",
    placeId: "p1",
    consumerId: "c1",
    tier: "boost_2x" as const,
    interval: "year" as const,
    quote: q,
    placeName: "Cafe",
    returnUrl: "https://mesita.ai/x",
    nowSec: 1000,
  } });
  assertEquals([setup.mode, setup.currency, "line_items" in setup], ["setup", "usd", false]);
});

Deno.test("premier: a renewal receipt goes to the guest's email only when there is one", () => {
  const base = {
    amountCents: 1000,
    customer: "cus_1",
    paymentMethod: "pm_1",
    periodId: "per",
    backingId: "b",
    placeId: "p",
    label: "Mesita Pro renewal",
  };
  const withEmail = renewalChargeParams({ ...base, receiptEmail: "g@x.com" });
  assertEquals([withEmail.receipt_email, withEmail.off_session, withEmail.confirm], ["g@x.com", true, true]);
  assertEquals("receipt_email" in renewalChargeParams({ ...base, receiptEmail: null }), false);
});

Deno.test("premier: start refuses a tier that is not one of the three, and a foreign return url", () => {
  const ok = { place_id: "11111111-1111-4111-8111-111111111111", tier: "boost_5x", return_url: "https://mesita.ai/x" };
  assertEquals(parseBoostStart(ok).ok, true);
  assertEquals(parseBoostStart({ ...ok, tier: "boost_3x" }).ok, false);
  // 10X is retired (MESITA-3041): a cached old build gets a code it can read.
  const retired = parseBoostStart({ ...ok, tier: "boost_10x" });
  assertEquals(retired.ok ? null : retired.code, "tier_retired");
  const odd = parseBoostStart({ ...ok, tier: "x".repeat(500) });
  assertEquals(odd.ok ? null : [odd.code, odd.error.length < 120], ["tier_invalid", true]);
  assertEquals(parseBoostStart({ ...ok, return_url: "https://evil.com" }).ok, false);
  assertEquals(isAllowedReturnUrl("https://preview-x.vercel.app/p"), true);
  const card = parseBoostStart({ place_id: ok.place_id, kind: "update_card", return_url: ok.return_url });
  assertEquals(card.ok && card.start.updateCard, true, "update card needs no tier");
});

Deno.test("premier: test mode unless live is set AND allowed; never the other mode's key", () => {
  const env = (vars: Record<string, string>) => (k: string) => vars[k];
  assertEquals(boostStripeKey(env({ STRIPE_SECRET_KEY_TEST: "sk_test" })), "sk_test");
  assertEquals(boostStripeKey(env({ STRIPE_MODE: "live", STRIPE_SECRET_KEY_LIVE: "sk_live" })), null);
  assertEquals(
    boostStripeKey(env({ STRIPE_MODE: "live", STRIPE_ALLOW_LIVE: "true", STRIPE_SECRET_KEY_LIVE: "sk_live", STRIPE_SECRET_KEY_TEST: "sk_test" })),
    "sk_live",
  );
  assertEquals(boostLivemode(env({ STRIPE_MODE: "live" })), false);
  assertEquals(boostLivemode(env({ STRIPE_MODE: "live", STRIPE_ALLOW_LIVE: "true" })), true);
});

Deno.test("payments have their own mode: Premier going live never takes payments live (MESITA-3279)", () => {
  const env = (vars: Record<string, string>) => (k: string) => vars[k];
  const keys = { STRIPE_ALLOW_LIVE: "true", STRIPE_SECRET_KEY_LIVE: "sk_live", STRIPE_SECRET_KEY_TEST: "sk_test" };
  // Premier live, payments untouched: payments stay on the test key.
  assertEquals(paymentsStripeKey(env({ ...keys, STRIPE_MODE: "live" })), "sk_test");
  assertEquals(paymentsLivemode(env({ ...keys, STRIPE_MODE: "live" })), false);
  // Payments live, Premier untouched: Premier stays on the test key.
  assertEquals(paymentsStripeKey(env({ ...keys, PAYMENTS_STRIPE_MODE: "live" })), "sk_live");
  assertEquals(paymentsLivemode(env({ ...keys, PAYMENTS_STRIPE_MODE: "live" })), true);
  assertEquals(boostStripeKey(env({ ...keys, PAYMENTS_STRIPE_MODE: "live" })), "sk_test");
  assertEquals(boostLivemode(env({ ...keys, PAYMENTS_STRIPE_MODE: "live" })), false);
  // The same guard: live without STRIPE_ALLOW_LIVE is refused, never the test key.
  assertEquals(paymentsStripeKey(env({ PAYMENTS_STRIPE_MODE: "live", STRIPE_SECRET_KEY_LIVE: "sk_live", STRIPE_SECRET_KEY_TEST: "sk_test" })), null);
  assertEquals(paymentsLivemode(env({ PAYMENTS_STRIPE_MODE: "live" })), false);
});

Deno.test("premier: the factor is the tier's number; a Google stub is never Premier (MESITA-2925)", () => {
  assertEquals(premierFactor({ source: "mesita", premierTier: 0 }), 1);
  assertEquals(premierFactor({ source: "mesita", premierTier: 1 }), 2);
  assertEquals(premierFactor({ source: "mesita", premierTier: 2 }), 5);
  // A tier outside 0..2 earns no paid reach (MESITA-3041).
  assertEquals(premierFactor({ source: "mesita", premierTier: 3 }), 1);
  assertEquals(premierFactor({ source: "mesita" }), 1);
  assertEquals(premierFactor({ source: "google", premierTier: 3 }), 1);
});

// MESITA-3091: Manual Premier is Mesita's free lift; nothing at or below its
// level is for sale, and above it the quote is the plain paid one.
Deno.test("quote: Manual 2X leaves only 5X for sale; Manual 5X leaves nothing", () => {
  const base = { running: null, charging: false, viewer: "stranger" as const, subscription: null, now: T0 };
  const at2 = quote({ ...base, tier: "boost_2x", manualTier: 1 });
  const at5 = quote({ ...base, tier: "boost_5x", manualTier: 1 });
  assertEquals([at2.covered, at2.charge_cents, at2.checkout], [true, 0, "none"]);
  assertEquals([at5.covered, at5.charge_cents, at5.checkout], [false, 99900, "payment"]);
  for (const tier of ["boost_2x", "boost_5x"] as const) {
    assertEquals(quote({ ...base, tier, manualTier: 2 }).covered, true, tier);
  }
  assertEquals(quote({ ...base, tier: "boost_2x" }).covered, false, "no Manual: everything for sale");
});

// MESITA-3165 (Design D7/D11): in the last 7 days of the run of Refill days
// at or above a level, that level may be subscribed to early: a card saved
// now, first charged the day the days end.
function refill(id: string, tier: number, fromDay: number, toDay: number): Manual {
  return {
    id,
    place_id: "place",
    tier,
    starts_at: new Date(T0 + fromDay * DAY).toISOString(),
    ends_at: new Date(T0 + toDay * DAY).toISOString(),
    source: "admin",
    granted_by: null,
  };
}

Deno.test("runEndAtOrAbove: the back-to-back run at or above the tier; a gap, a lower tier or a zero-length row stops it", () => {
  const rows = [refill("a", 2, -1, 3), refill("b", 1, 3, 10), refill("z", 2, 10, 10), refill("c", 2, 12, 20)];
  assertEquals(runEndAtOrAbove(rows, 2, T0), new Date(T0 + 3 * DAY).toISOString(), "5X: only the 5X row; 2X is below");
  assertEquals(runEndAtOrAbove(rows, 1, T0), new Date(T0 + 10 * DAY).toISOString(), "2X: 5X then 2X; the gap at day 10 stops it");
  assertEquals(runEndAtOrAbove([refill("q", 2, 1, 5)], 2, T0), null, "nothing runs now");
  assertEquals(runEndAtOrAbove([], 1, T0), null);
});

Deno.test("quote: subscribe early in the last 7 days of the Refill run; day 8 is still covered", () => {
  const base = { running: null, charging: false, viewer: "stranger" as const, subscription: null, now: T0, manualTier: 1 };
  const day7 = quote({ ...base, tier: "boost_2x", manual: [refill("a", 1, -3, 7)] });
  assertEquals(
    [day7.kind, day7.checkout, day7.covered, day7.charge_cents, day7.renews_at],
    ["resume", "setup", false, 0, new Date(T0 + 7 * DAY).toISOString()],
  );
  const day8 = quote({ ...base, tier: "boost_2x", manual: [refill("a", 1, -3, 8)] });
  assertEquals([day8.kind, day8.covered, day8.checkout], ["blocked", true, "none"]);
  // The run counts every back-to-back row at or above the level.
  const chained = quote({ ...base, manualTier: 2, tier: "boost_2x", manual: [refill("a", 2, -1, 3), refill("b", 1, 3, 9)] });
  assertEquals(chained.covered, true, "5X then 2X runs 9 days: too early");
  // Not without the rows, nor where someone pays or a charge is in flight.
  assertEquals(quote({ ...base, tier: "boost_2x" }).covered, true, "no rows passed: covered as before");
  const rows = [refill("a", 1, -3, 7)];
  assertEquals(quote({ ...base, tier: "boost_2x", manual: rows, charging: true }).covered, true);
  assertEquals(quote({ ...base, tier: "boost_2x", manual: rows, subscription: pledge({ id: "s" }) }).covered, true);
  assertEquals(quote({ ...base, tier: "boost_2x", manual: rows, running: period({ id: "p" }) }).covered, true);
  // Above the Refill level the quote is the plain paid one.
  assertEquals(quote({ ...base, tier: "boost_5x", manual: rows }).checkout, "payment");
});

Deno.test("inEarlyWindow: calendar days in the place's time zone; an unknown zone reads UTC", () => {
  // Now = 2026-11-01 00:00 UTC = Oct 31 18:00 in Mexico City (UTC-6).
  const end = new Date(T0 + 7 * DAY + 3 * 3600_000).toISOString(); // Nov 8 03:00 UTC = Nov 7 21:00 there
  assertEquals(inEarlyWindow(end, T0, "UTC"), true, "Nov 1 → Nov 8: 7 days");
  assertEquals(inEarlyWindow(end, T0, "America/Mexico_City"), true, "Oct 31 → Nov 7: 7 days");
  const later = new Date(T0 + 7 * DAY + 7 * 3600_000).toISOString(); // Nov 8 07:00 UTC = Nov 8 01:00 there
  assertEquals(inEarlyWindow(later, T0, "America/Mexico_City"), false, "Oct 31 → Nov 8: 8 days there");
  assertEquals(inEarlyWindow(later, T0, "UTC"), true);
  assertEquals(inEarlyWindow(later, T0, "Not/AZone"), true, "unknown zone → UTC");
  assertEquals(inEarlyWindow(later, T0, null), true);
});
