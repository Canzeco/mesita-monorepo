// business-web-get-billing's contract, one test per Billing state
// (MESITA-3166, Design D1–D13, Eng F3/F4/F6). Money is involved: these
// dates are when a card is charged.

import { assertEquals } from "jsr:@std/assert@1";
import { type Manual, type Period, type Pledge } from "../_shared/boost.ts";
import { billingView, type Card, receiptsByIntent, savedCards } from "./billing.ts";

const DAY = 86_400_000;
const NOW = Date.parse("2026-11-03T15:00:00Z");
const iso = (t: number) => new Date(t).toISOString();
const ME = "me";

function pledge(over: Partial<Pledge> = {}): Pledge {
  return {
    id: "pledge",
    place_id: "place",
    consumer_id: ME,
    tier: "boost_2x",
    billing_interval: "month",
    amount_cents: 1000,
    status: "ready",
    queued_at: iso(NOW - 40 * DAY),
    stripe_payment_method_id: "pm_x",
    stripe_checkout_session_id: null,
    pending_tier: null,
    pending_interval: null,
    pending_amount_cents: null,
    quoted_period_id: null,
    quoted_credit_cents: 0,
    livemode: false,
    created_at: iso(NOW - 40 * DAY),
    ended_at: null,
    ended_reason: null,
    checkout_kind: null,
    notice_dismissed_at: null,
    early_start: false,
    ...over,
  };
}

function period(over: Partial<Period> = {}): Period {
  return {
    id: "period",
    place_id: "place",
    backing_id: "pledge",
    granted_by: null,
    tier: 1,
    billing_interval: "month",
    starts_at: iso(NOW - 10 * DAY),
    ends_at: iso(NOW + 20 * DAY),
    price_cents: 1000,
    credit_cents: 0,
    extra_days: 0,
    charged_cents: 1000,
    stripe_payment_intent_id: null,
    stripe_checkout_session_id: null,
    status: "paid",
    created_at: iso(NOW - 10 * DAY),
    remaining_at_cover_sec: null,
    covered_until: null,
    ...over,
  };
}

function refill(id: string, tier: number, from: number, to: number, over: Partial<Manual> = {}): Manual {
  return {
    id,
    place_id: "place",
    tier,
    starts_at: iso(from),
    ends_at: iso(to),
    source: "admin",
    granted_by: "pato",
    created_at: iso(Math.min(from, NOW) - DAY),
    ...over,
  };
}

const CARD_LATE: Card = { brand: "visa", last4: "4242", exp_month: 8, exp_year: 2030 };

function view(over: Partial<Parameters<typeof billingView>[0]> = {}) {
  return billingView({
    pledges: [],
    periods: [],
    manual: [],
    timezone: "UTC",
    viewerId: ME,
    card: null,
    now: NOW,
    ...over,
  });
}

Deno.test("billing: empty — Not Premier, nothing running, nothing to charge (D4)", () => {
  const v = view();
  assertEquals(v.level, { tier: 0, until: null, days_left: null });
  assertEquals(v.refill, []);
  assertEquals(v.subscription, null);
  assertEquals(v.payer, null);
  assertEquals(v.keep, null);
  assertEquals(v.subscribe_from, {});
  assertEquals(v.moved, null);
  assertEquals(v.card_expires_before_charge, false);
  assertEquals(v.today, "2026-11-03");
});

Deno.test("billing: running subscription — next charge at the period's end, level held while it renews", () => {
  const v = view({ pledges: [pledge()], periods: [period()], card: CARD_LATE });
  assertEquals(v.payer, "you");
  assertEquals(v.subscription?.state, "running");
  assertEquals(v.subscription?.next_charge_at, iso(NOW + 20 * DAY));
  assertEquals(v.subscription?.next_charge_cents, 1000);
  assertEquals(v.subscription?.resumes_at, null);
  assertEquals(v.level, { tier: 1, until: null, days_left: null });
  assertEquals(v.card_expires_before_charge, false);
});

Deno.test("billing: the team sees the plan, never the payer's card warning", () => {
  const card: Card = { brand: "visa", last4: "4242", exp_month: 11, exp_year: 2026 };
  const v = view({ pledges: [pledge({ consumer_id: "someone" })], periods: [period()], card });
  assertEquals(v.payer, "team");
  assertEquals(v.card_expires_before_charge, false);
});

Deno.test("billing: queued Refill days — rows in run order, Running then Next; zero-length rows dropped", () => {
  const manual = [
    refill("two", 1, NOW + 10 * DAY, NOW + 40 * DAY, { source: "purchase" }),
    refill("five", 2, NOW - DAY, NOW + 10 * DAY),
    refill("ended", 1, NOW + 5 * DAY, NOW + 5 * DAY),
    refill("past", 1, NOW - 30 * DAY, NOW - 20 * DAY),
  ];
  const v = view({ manual });
  assertEquals(v.refill.map((r) => [r.id, r.tier, r.origin, r.state]), [
    ["five", 2, "mesita", "running"],
    ["two", 1, "guest", "next"],
  ]);
  assertEquals(v.level.tier, 2);
  assertEquals(v.level.until, iso(NOW + 10 * DAY));
  assertEquals(v.level.days_left, null);
  // Outside the 7-day window: when each level can be subscribed to (M6).
  assertEquals(v.keep, null);
  assertEquals(v.subscribe_from, { 2: "2026-11-06", 1: "2026-12-06" });
});

Deno.test("billing: paused — Refill days at or above the paid tier; resumes, then charges at the moved end", () => {
  const manual = [refill("five", 2, NOW - DAY, NOW + 20 * DAY)];
  const periods = [period({ covered_until: iso(NOW + 20 * DAY), ends_at: iso(NOW + 35 * DAY), remaining_at_cover_sec: 15 * 86400 })];
  const v = view({ pledges: [pledge()], periods, manual, card: CARD_LATE });
  assertEquals(v.subscription?.state, "paused");
  assertEquals(v.subscription?.resumes_at, iso(NOW + 20 * DAY));
  assertEquals(v.subscription?.next_charge_at, iso(NOW + 35 * DAY));
  assertEquals(v.level, { tier: 2, until: iso(NOW + 20 * DAY), days_left: null });
  // A paid subscription: no Keep prompt, no subscribe-from.
  assertEquals(v.keep, null);
  assertEquals(v.subscribe_from, {});
});

Deno.test("billing: ending within 7 days, nobody subscribed — Keep 5X at $999 a year, days left counted", () => {
  const manual = [refill("five", 2, NOW - 25 * DAY, NOW + 5 * DAY)];
  const v = view({ manual });
  assertEquals(v.keep, { tier: 2, ends_at: iso(NOW + 5 * DAY), price_cents: 99900 });
  assertEquals(v.level, { tier: 2, until: iso(NOW + 5 * DAY), days_left: 5 });
});

Deno.test("billing: Keep names the highest level whose run ends within 7 days (D11)", () => {
  // 5X ends in 3 days, then 2X runs to day 6: Keep 5X first.
  const both = view({ manual: [refill("five", 2, NOW - DAY, NOW + 3 * DAY), refill("two", 1, NOW + 3 * DAY, NOW + 6 * DAY)] });
  assertEquals(both.keep, { tier: 2, ends_at: iso(NOW + 3 * DAY), price_cents: 99900 });
  // 5X ends in 3 days, 2X runs 20 more: Keep 5X now; 2X can be kept from its own window.
  const long = view({ manual: [refill("five", 2, NOW - DAY, NOW + 3 * DAY), refill("two", 1, NOW + 3 * DAY, NOW + 23 * DAY)] });
  assertEquals(long.keep?.tier, 2);
  assertEquals(long.subscribe_from, { 1: "2026-11-19" });
  // Only 2X ending in 6 days: Keep 2X at $10.
  const two = view({ manual: [refill("two", 1, NOW - DAY, NOW + 6 * DAY)] });
  assertEquals(two.keep, { tier: 1, ends_at: iso(NOW + 6 * DAY), price_cents: 9900 });
});

Deno.test("billing: no Keep while someone pays, even in the last 7 days", () => {
  const manual = [refill("five", 2, NOW - DAY, NOW + 5 * DAY)];
  const v = view({ manual, pledges: [pledge()], periods: [period({ covered_until: iso(NOW + 5 * DAY) })] });
  assertEquals(v.keep, null);
});

Deno.test("billing: subscribed early — waiting, first charge the day the Refill days end", () => {
  const manual = [refill("five", 2, NOW - 26 * DAY, NOW + 4 * DAY)];
  const sub = pledge({ tier: "boost_5x", amount_cents: 10000, early_start: true, created_at: iso(NOW - DAY) });
  const v = view({ manual, pledges: [sub], card: CARD_LATE });
  assertEquals(v.subscription?.state, "waiting");
  assertEquals(v.subscription?.early_start, true);
  assertEquals(v.subscription?.next_charge_at, iso(NOW + 4 * DAY));
  assertEquals(v.subscription?.next_charge_cents, 10000);
  assertEquals(v.keep, null);
  // The Refill days end, the subscription takes over: the level is not "until".
  assertEquals(v.level, { tier: 2, until: iso(NOW + 4 * DAY), days_left: 4 });
});

Deno.test("billing: a pending change down is what the next charge takes", () => {
  const sub = pledge({ tier: "boost_5x", amount_cents: 10000, pending_tier: "boost_2x", pending_amount_cents: 1000 });
  const v = view({ pledges: [sub], periods: [period({ tier: 2, price_cents: 10000, charged_cents: 10000 })] });
  assertEquals(v.subscription?.amount_cents, 10000);
  assertEquals(v.subscription?.next_charge_cents, 1000);
});

Deno.test("billing: a charge in flight — charging, no date", () => {
  const v = view({ pledges: [pledge()], periods: [period({ id: "c", status: "charging", starts_at: iso(NOW), ends_at: iso(NOW + 30 * DAY) })] });
  assertEquals(v.subscription?.state, "charging");
  assertEquals(v.subscription?.next_charge_at, null);
});

Deno.test("billing: the payer's card expires before the next charge (D8, F6)", () => {
  const manual = [refill("five", 2, NOW - DAY, NOW + 200 * DAY)];
  const periods = [period({ covered_until: iso(NOW + 200 * DAY), ends_at: iso(NOW + 215 * DAY) })];
  // Expires end of 03/2027 (Mar 31); next charge mid-June 2027.
  const early: Card = { brand: "visa", last4: "4242", exp_month: 3, exp_year: 2027 };
  assertEquals(view({ pledges: [pledge()], periods, manual, card: early }).card_expires_before_charge, true);
  assertEquals(view({ pledges: [pledge()], periods, manual, card: CARD_LATE }).card_expires_before_charge, false);
  // Valid through the whole expiry month: 11/2026 still charges on Nov 23.
  const thisMonth: Card = { brand: "visa", last4: "4242", exp_month: 11, exp_year: 2026 };
  assertEquals(view({ pledges: [pledge()], periods: [period()], card: thisMonth }).card_expires_before_charge, false);
});

Deno.test("billing: moved date — the latest grant in the last 30 days pushed the resume out (D13, F4)", () => {
  const manual = [
    refill("mesita", 2, NOW - 5 * DAY, NOW + 25 * DAY, { created_at: iso(NOW - 6 * DAY) }),
    refill("guest", 2, NOW + 25 * DAY, NOW + 55 * DAY, { source: "purchase", created_at: iso(NOW - 2 * DAY) }),
  ];
  const periods = [period({ covered_until: iso(NOW + 55 * DAY), ends_at: iso(NOW + 70 * DAY) })];
  const v = view({ pledges: [pledge()], periods, manual });
  assertEquals(v.moved, {
    from: iso(NOW + 25 * DAY),
    to: iso(NOW + 55 * DAY),
    days: 30,
    origin: "guest",
    granted_at: iso(NOW - 2 * DAY),
  });
  // A grant older than 30 days is not news.
  const old = manual.map((m) => ({ ...m, created_at: iso(NOW - 31 * DAY) }));
  assertEquals(view({ pledges: [pledge()], periods, manual: old }).moved, null);
  // Nothing paused or waiting: nothing moved.
  assertEquals(view({ manual }).moved, null);
});

Deno.test("billing: dates are counted in the place's time zone (D12, F3)", () => {
  // 03:00 UTC on Nov 3 is still Nov 2 in Mexico City (UTC−6); the run ends
  // 12:00 UTC Nov 10 = 06:00 Nov 10 there.
  const now = Date.parse("2026-11-03T03:00:00Z");
  const manual = [refill("five", 2, now - DAY, Date.parse("2026-11-10T12:00:00Z"))];
  const utc = view({ manual, now, timezone: "UTC" });
  const mx = view({ manual, now, timezone: "America/Mexico_City" });
  assertEquals(utc.today, "2026-11-03");
  assertEquals(mx.today, "2026-11-02");
  assertEquals(mx.timezone, "America/Mexico_City");
  // UTC: 7 calendar days left → Keep. Mexico City: 8 → not yet; from Nov 3.
  assertEquals(utc.keep?.tier, 2);
  assertEquals(utc.level.days_left, 7);
  assertEquals(mx.keep, null);
  assertEquals(mx.level.days_left, null);
  // 5X days count for 2X too: both levels open the same day.
  assertEquals(mx.subscribe_from, { 2: "2026-11-03", 1: "2026-11-03" });
  // No time zone stored: UTC.
  assertEquals(view({ manual, now, timezone: null }).timezone, "UTC");
});

// MESITA-3185: what Billing shows from Stripe. Money: the wrong "In use" card or
// a declined try's receipt would misstate what was charged.
Deno.test("saved cards: the plan's card first and marked, nothing but brand, last 4 and expiry", () => {
  const cards = savedCards([
    { id: "pm_old", card: { brand: "amex", last4: "0005", exp_month: 1, exp_year: 2030, fingerprint: "secret" } },
    { id: "pm_x", card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2028 } },
    { id: "pm_no_card" },
  ], "pm_x");
  assertEquals(cards, [
    { id: "pm_x", brand: "visa", last4: "4242", exp_month: 12, exp_year: 2028, in_use: true },
    { id: "pm_old", brand: "amex", last4: "0005", exp_month: 1, exp_year: 2030, in_use: false },
  ]);
  assertEquals(savedCards(undefined, null), []);
});

Deno.test("receipts: only a paid charge gives its intent a receipt", () => {
  const receipts = receiptsByIntent([
    { payment_intent: "pi_a", paid: true, receipt_url: "https://pay.stripe.com/a" },
    { payment_intent: "pi_a", paid: false, receipt_url: "https://pay.stripe.com/declined" },
    { payment_intent: "pi_b", paid: false, receipt_url: "https://pay.stripe.com/b" },
  ]);
  assertEquals([...receipts], [["pi_a", "https://pay.stripe.com/a"]]);
});
