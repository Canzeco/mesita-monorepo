// MESITA-2995 — Premier's money rules: what a guest is charged, who pays
// next, what an upgrade's unused days are worth, which key addresses Stripe,
// and the factor a paid tier earns in the Area score. Pure functions only.

import { assertEquals } from "jsr:@std/assert@1";
import {
  boostAmountCents,
  boostLivemode,
  boostStripeKey,
  chargeKey,
  chargeOutcome,
  creditCents,
  extraDays,
  intervalEnd,
  isAllowedReturnUrl,
  ladder,
  lineView,
  parseBoostStart,
  type Period,
  type Pledge,
  pledgeCheckoutParams,
  quote,
  renewalChargeParams,
  staleChargeAction,
  StripeError,
} from "./boost.ts";
import { premierFactor } from "./area-score.ts";

const DAY = 86_400_000;
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
    ...over,
  };
}

Deno.test("premier: $10 · $50 · $200 a month, a year for the price of ten months", () => {
  assertEquals(boostAmountCents("boost_2x", "month"), 1000);
  assertEquals(boostAmountCents("boost_5x", "month"), 5000);
  assertEquals(boostAmountCents("boost_10x", "month"), 20000);
  assertEquals(boostAmountCents("boost_2x", "year"), 10000);
  assertEquals(boostAmountCents("boost_5x", "year"), 50000);
  assertEquals(boostAmountCents("boost_10x", "year"), 200000);
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

Deno.test("premier: Pato's example — a half-used $10 2X upgraded to 5X costs $45 today", () => {
  const running = period({ id: "p", backing_id: "a" });
  const q = quote({
    tier: "boost_5x",
    interval: "month",
    running,
    charging: false,
    pledges: [pledge({ id: "a" })],
    mine: pledge({ id: "a" }),
    now: T0 + 15 * DAY,
  });
  assertEquals(q.charge_cents, 4500);
  assertEquals(q.credit_cents, 500);
  assertEquals(q.role, "payer");
  assertEquals(q.checkout, "payment");
});

Deno.test("premier: another guest upgrading gets the place's credit too", () => {
  const running = period({ id: "p", backing_id: "a" });
  const q = quote({
    tier: "boost_5x",
    interval: "month",
    running,
    charging: false,
    pledges: [pledge({ id: "a" })],
    mine: null,
    now: T0 + 15 * DAY,
  });
  assertEquals([q.charge_cents, q.credit_cents, q.role, q.checkout], [4500, 500, "payer", "payment"]);
});

Deno.test("premier: credit above the new price is never lost — it becomes extra days", () => {
  // A fresh yearly 2X ($100) upgraded to monthly 5X ($50): $50 left over.
  const running = period({
    id: "p",
    backing_id: "a",
    billing_interval: "year",
    price_cents: 10000,
    ends_at: new Date(T0 + 365 * DAY).toISOString(),
  });
  const q = quote({ tier: "boost_5x", interval: "month", running, charging: false, pledges: [], mine: null, now: T0 });
  assertEquals(q.charge_cents, 0);
  assertEquals(q.credit_cents, 5000);
  assertEquals(q.extra_days, 30);
  assertEquals(q.checkout, "setup");
  assertEquals(extraDays(0, 5000, "month", T0), 0);
});

Deno.test("premier: a charge under 50 cents is not charged (Stripe's minimum)", () => {
  // 5X monthly ($50) with $49.60 of credit left: a 40-cent charge becomes 0.
  const running = period({ id: "p", backing_id: "a", tier: 1, price_cents: 4960 });
  const q = quote({ tier: "boost_5x", interval: "month", running, charging: false, pledges: [], mine: null, now: T0 });
  assertEquals(q.charge_cents, 0);
  assertEquals(q.checkout, "setup");
});

Deno.test("premier: nothing running → the pledge pays its full price now", () => {
  const q = quote({ tier: "boost_2x", interval: "year", running: null, charging: false, pledges: [], mine: null, now: T0 });
  assertEquals([q.charge_cents, q.role, q.position, q.checkout], [10000, "payer", 0, "payment"]);
  assertEquals(q.new_ends_at, "2027-11-01T00:00:00.000Z");
});

Deno.test("premier: at or below the running level → a backup, $0 today, numbered in line", () => {
  const running = period({ id: "p", backing_id: "a", tier: 2 });
  const pledges = [
    pledge({ id: "a", tier: "boost_5x" }),
    pledge({ id: "b", tier: "boost_5x", queued_at: new Date(T0 + DAY).toISOString() }),
    pledge({ id: "c", tier: "boost_2x" }),
  ];
  const at5 = quote({ tier: "boost_5x", interval: "month", running, charging: false, pledges, mine: null, now: T0 + 2 * DAY });
  assertEquals([at5.charge_cents, at5.role, at5.position, at5.checkout], [0, "backup", 2, "setup"]);
  const at2 = quote({ tier: "boost_2x", interval: "month", running, charging: false, pledges, mine: null, now: T0 + 2 * DAY });
  assertEquals(at2.position, 3);
});

Deno.test("premier: a backup with a saved card changes level with no Checkout", () => {
  const running = period({ id: "p", backing_id: "a", tier: 3 });
  const mine = pledge({ id: "b", tier: "boost_2x" });
  const q = quote({ tier: "boost_5x", interval: "month", running, charging: false, pledges: [pledge({ id: "a", tier: "boost_10x" }), mine], mine, now: T0 });
  assertEquals([q.role, q.checkout], ["backup", "none"]);
});

Deno.test("premier: the payer lowering their level keeps paying the period they bought", () => {
  const running = period({ id: "p", backing_id: "a", tier: 2 });
  const mine = pledge({ id: "a", tier: "boost_5x" });
  const q = quote({ tier: "boost_2x", interval: "month", running, charging: false, pledges: [mine], mine, now: T0 });
  assertEquals([q.charge_cents, q.role, q.checkout], [0, "payer", "none"]);
});

Deno.test("premier: while a charge is in flight nobody jumps the line", () => {
  const q = quote({ tier: "boost_10x", interval: "month", running: null, charging: true, pledges: [], mine: null, now: T0 });
  assertEquals(q.role, "backup");
  assertEquals(q.charge_cents, 0);
});

Deno.test("premier: the ladder is level first, then whoever got in line first; a re-pledge goes to the back", () => {
  const pledges = [
    pledge({ id: "early2", tier: "boost_2x", queued_at: new Date(T0).toISOString() }),
    pledge({ id: "late5", tier: "boost_5x", queued_at: new Date(T0 + 5 * DAY).toISOString() }),
    pledge({ id: "repledged5", tier: "boost_5x", queued_at: new Date(T0 + 9 * DAY).toISOString() }),
    pledge({ id: "failed", tier: "boost_10x", status: "failed" }),
    pledge({ id: "nocard", tier: "boost_10x", stripe_payment_method_id: null }),
  ];
  assertEquals(ladder(pledges).map((p) => p.id), ["late5", "repledged5", "early2"]);
});

Deno.test("premier: the line shows the payer first at the period's level, then backups; names never", () => {
  const running = period({ id: "p", backing_id: "a", tier: 2 });
  const pledges = [
    pledge({ id: "a", tier: "boost_2x", consumer_id: "ca" }), // lowered after paying 5X
    ...Array.from({ length: 6 }, (_, i) =>
      pledge({ id: `b${i}`, consumer_id: `cb${i}`, queued_at: new Date(T0 + (i + 1) * DAY).toISOString() })
    ),
  ];
  const view = lineView(pledges, running, "cb5");
  assertEquals(view.line[0], { tier: 2, interval: "month", role: "payer", position: 0, mine: false });
  assertEquals(view.line.slice(1, 5).map((r) => r.position), [1, 2, 3, 4]);
  // The caller is Backup 6: shown pinned past the top five.
  assertEquals(view.line.at(-1), { tier: 1, interval: "month", role: "backup", position: 6, mine: true });
  assertEquals(view.more, 1);
  assertEquals(JSON.stringify(view).includes("cb"), false);
});

Deno.test("premier: only a card decline moves to the next pledge; anything else is asked again", () => {
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
  const q = quote({ tier: "boost_2x", interval: "month", running: null, charging: false, pledges: [], mine: null, now: T0 });
  const pay = pledgeCheckoutParams({
    kind: "payment",
    customer: "cus_1",
    backingId: "b1",
    placeId: "p1",
    consumerId: "c1",
    tier: "boost_2x",
    interval: "month",
    quote: q,
    placeName: "Cafe",
    returnUrl: "https://mesita.ai/web/place/x?tab=premier",
    nowSec: 1000,
  }) as Record<string, any>;
  assertEquals(pay.mode, "payment");
  assertEquals(pay.payment_intent_data.capture_method, "manual");
  assertEquals(pay.payment_intent_data.setup_future_usage, "off_session");
  assertEquals(pay.line_items[0].price_data.unit_amount, 1000);
  assertEquals("recurring" in pay.line_items[0].price_data, false);
  assertEquals(pay.success_url, "https://mesita.ai/web/place/x?tab=premier&boost={CHECKOUT_SESSION_ID}");
  assertEquals(pay.expires_at, 1000 + 31 * 60);
  assertEquals(pay.metadata.backing_id, "b1");
  const setup = pledgeCheckoutParams({ ...{
    kind: "setup" as const,
    customer: "cus_1",
    backingId: "b1",
    placeId: "p1",
    consumerId: "c1",
    tier: "boost_2x" as const,
    interval: "month" as const,
    quote: q,
    placeName: "Cafe",
    returnUrl: "https://mesita.ai/x",
    nowSec: 1000,
  } }) as Record<string, any>;
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
    label: "Premier 2X renewal",
  };
  const withEmail = renewalChargeParams({ ...base, receiptEmail: "g@x.com" });
  assertEquals([withEmail.receipt_email, withEmail.off_session, withEmail.confirm], ["g@x.com", true, true]);
  assertEquals("receipt_email" in renewalChargeParams({ ...base, receiptEmail: null }), false);
});

Deno.test("premier: start refuses a tier that is not one of the three, and a foreign return url", () => {
  const ok = { place_id: "11111111-1111-4111-8111-111111111111", tier: "boost_5x", return_url: "https://mesita.ai/x" };
  assertEquals(parseBoostStart(ok).ok, true);
  assertEquals(parseBoostStart({ ...ok, tier: "boost_3x" }).ok, false);
  assertEquals(parseBoostStart({ ...ok, return_url: "https://evil.com" }).ok, false);
  assertEquals(isAllowedReturnUrl("https://preview-x.vercel.app/p"), true);
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

Deno.test("premier: the factor is the tier's number; a Google stub is never Premier (MESITA-2925)", () => {
  assertEquals(premierFactor({ source: "mesita", premierTier: 0 }), 1);
  assertEquals(premierFactor({ source: "mesita", premierTier: 1 }), 2);
  assertEquals(premierFactor({ source: "mesita", premierTier: 2 }), 5);
  assertEquals(premierFactor({ source: "mesita", premierTier: 3 }), 10);
  assertEquals(premierFactor({ source: "mesita" }), 1);
  assertEquals(premierFactor({ source: "google", premierTier: 3 }), 1);
});
