// Run: deno test --allow-read supabase/functions/_shared/guest-plan.test.ts
//
// The guest Plan is money (MESITA-3870): Pro is $2/month, and only a paid
// period (or an operator's grant) may lift the reservation cap to Pro's.

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  blockingSubscription,
  effectivePlan,
  findBlockingSubscription,
  mayAdopt,
  needsRefresh,
  planCheckoutParams,
  planPatch,
  PRO_PRICE_CENTS,
  readSubscription,
  sessionOutcome,
  subscriptionOfSession,
} from "./guest-plan.ts";

const NOW = Date.parse("2026-11-14T12:00:00Z");
const LATER = "2026-12-14T12:00:00.000Z";
const EARLIER = "2026-11-01T00:00:00.000Z";
const paid = (over: Record<string, unknown> = {}) => ({
  plan: "premium",
  plan_stripe_subscription: "sub_1",
  plan_livemode: false,
  plan_paid_until: LATER,
  ...over,
});

Deno.test("Pro is $3.00 (MESITA-5022)", () => assertEquals(PRO_PRICE_CENTS, 300));

Deno.test("effectivePlan: a paid period is Pro, a lapsed one is Free", () => {
  assertEquals(effectivePlan(paid(), NOW, false), "premium");
  assertEquals(effectivePlan(paid({ plan_paid_until: EARLIER }), NOW, false), "free");
  assertEquals(effectivePlan(paid({ plan_paid_until: null }), NOW, false), "free");
});

Deno.test("effectivePlan: another Stripe universe's subscription grants nothing", () => {
  assertEquals(effectivePlan(paid(), NOW, true), "free");
});

Deno.test("effectivePlan: an operator's grant (no subscription) is Pro; Free and no row are Free", () => {
  assertEquals(effectivePlan({ plan: "premium" }, NOW, false), "premium");
  assertEquals(effectivePlan({ plan: "free", plan_stripe_subscription: "sub_1", plan_paid_until: LATER, plan_livemode: false }, NOW, false), "free");
  assertEquals(effectivePlan(null, NOW, false), "free");
});

Deno.test("needsRefresh only for a lapsed subscription in this universe", () => {
  assert(needsRefresh(paid({ plan_paid_until: EARLIER }), NOW, false));
  assert(!needsRefresh(paid(), NOW, false));
  assert(!needsRefresh({ plan: "premium" }, NOW, false));
  assert(!needsRefresh(paid({ plan_paid_until: EARLIER }), NOW, true));
});

Deno.test("readSubscription: active with a future period end; the end is read from the item too", () => {
  const end = Math.floor(Date.parse(LATER) / 1000);
  const a = readSubscription({ status: "active", current_period_end: end }, NOW);
  assert(a.active && !a.ended);
  assertEquals(a.paidUntil, LATER);
  const b = readSubscription({ status: "active", items: { data: [{ current_period_end: end }] }, cancel_at_period_end: true }, NOW);
  assert(b.active && b.cancelAtPeriodEnd);
  assert(!readSubscription({ status: "past_due", current_period_end: end }, NOW).active);
  assert(!readSubscription({ status: "incomplete", current_period_end: end }, NOW).active);
  assert(readSubscription({ status: "canceled" }, NOW).ended);
});

Deno.test("planPatch: ended forgets the subscription; inactive writes Free", () => {
  assertEquals(planPatch("sub_1", false, { active: false, paidUntil: null, cancelAtPeriodEnd: false, ended: true }).plan_stripe_subscription, null);
  assertEquals(planPatch("sub_1", false, { active: false, paidUntil: EARLIER, cancelAtPeriodEnd: false, ended: false }).plan, "free");
  const p = planPatch("sub_1", true, { active: true, paidUntil: LATER, cancelAtPeriodEnd: true, ended: false });
  assertEquals([p.plan, p.plan_livemode, p.plan_paid_until, p.plan_cancel_at_period_end], ["premium", true, LATER, true]);
});

Deno.test("subscriptionOfSession: only this guest's complete Pro Checkout", () => {
  const ok = { mode: "subscription", status: "complete", client_reference_id: "c1", metadata: { mesita_kind: "guest_plan" }, subscription: "sub_9" };
  assertEquals(subscriptionOfSession(ok, "c1"), "sub_9");
  assertEquals(subscriptionOfSession(ok, "c2"), null);
  assertEquals(subscriptionOfSession({ ...ok, status: "open" }, "c1"), null);
  assertEquals(subscriptionOfSession({ ...ok, metadata: { mesita_kind: "premier_refill" } }, "c1"), null);
  assertEquals(subscriptionOfSession({ ...ok, mode: "payment" }, "c1"), null);
});

Deno.test("planCheckoutParams: $3 a month, the guest's customer, back with plan=<session>", () => {
  const p = planCheckoutParams({ customer: "cus_1", consumerId: "c1", returnUrl: "https://mesita.ai/me/plan", nowSec: 1000 });
  assertEquals(p.mode, "subscription");
  assertEquals(p.customer, "cus_1");
  assertEquals(p.client_reference_id, "c1");
  assertEquals(p.success_url, "https://mesita.ai/me/plan?plan={CHECKOUT_SESSION_ID}");
  const item = (p.line_items as Array<{ price_data: Record<string, unknown> }>)[0].price_data;
  assertEquals(item.unit_amount, 300);
  assertEquals(item.currency, "usd");
  assertEquals(item.recurring, { interval: "month" });
});

const END = Math.floor(Date.parse(LATER) / 1000);
const META = { mesita_kind: "guest_plan", consumer_id: "c1" };
const sub = (status: string, over: Record<string, unknown> = {}) => ({ id: `sub_${status}`, status, current_period_end: END, metadata: META, ...over });

Deno.test("sessionOutcome: pending only for the guest's own session in flight (MESITA-4915)", () => {
  const s = { mode: "subscription", status: "complete", client_reference_id: "c1", metadata: META, payment_status: "paid" };
  assertEquals(sessionOutcome(s, "c1", sub("active"), NOW), "paid");
  assertEquals(sessionOutcome(s, "c1", sub("incomplete"), NOW), "pending");
  assertEquals(sessionOutcome({ ...s, status: "open" }, "c1", null, NOW), "pending");
  assertEquals(sessionOutcome({ ...s, payment_status: "unpaid" }, "c1", null, NOW), "pending");
  assertEquals(sessionOutcome({ ...s, status: "expired" }, "c1", null, NOW), "failed");
  assertEquals(sessionOutcome(s, "c1", sub("canceled"), NOW), "failed");
  assertEquals(sessionOutcome(s, "c1", sub("past_due"), NOW), "failed");
  assertEquals(sessionOutcome({ ...s, status: "open" }, "c2", null, NOW), "failed");
  assertEquals(sessionOutcome({ ...s, status: "open", metadata: {} }, "c1", null, NOW), "failed");
});

Deno.test("mayAdopt: an old link never undoes a paid Pro or a grant (MESITA-4915)", () => {
  const dead = readSubscription(sub("canceled"), NOW);
  const unpaid = readSubscription(sub("incomplete"), NOW);
  assert(!mayAdopt(paid(), "sub_old", dead));
  assert(!mayAdopt(paid(), "sub_old", unpaid));
  assert(!mayAdopt({ plan: "premium" }, "sub_old", unpaid));
  assert(mayAdopt(paid(), "sub_1", dead));
  assert(mayAdopt({ plan: "free" }, "sub_old", unpaid));
  assert(mayAdopt(paid(), "sub_new", readSubscription(sub("active"), NOW)));
});

Deno.test("blockingSubscription: any Pro not over blocks Checkout, paying one first (MESITA-4915)", () => {
  assertEquals(blockingSubscription([sub("canceled"), sub("incomplete_expired")], "c1", NOW), null);
  assertEquals(blockingSubscription([sub("active", { metadata: {} })], "c1", NOW), null);
  assertEquals(blockingSubscription([sub("active")], "c2", NOW), null);
  assertEquals(blockingSubscription([sub("past_due"), sub("active")], "c1", NOW), { id: "sub_active", active: true, payUrl: null });
  const latest_invoice = { status: "open", hosted_invoice_url: "https://invoice.stripe.com/i/1" };
  assertEquals(blockingSubscription([sub("past_due", { latest_invoice })], "c1", NOW)?.payUrl, "https://invoice.stripe.com/i/1");
  assertEquals(blockingSubscription([sub("incomplete")], "c1", NOW), { id: "sub_incomplete", active: false, payUrl: null });
});

Deno.test("findBlockingSubscription: closes only the guest's Pro Checkouts, before reading subscriptions (MESITA-4915)", async () => {
  const calls: string[] = [];
  const found = await findBlockingSubscription((method, path) => {
    calls.push(`${method} ${path}`);
    if (path === "checkout/sessions") return Promise.resolve({ data: [{ id: "cs_a", metadata: META }, { id: "cs_premier", metadata: {} }] });
    if (path === "subscriptions") return Promise.resolve({ data: [sub("incomplete")] });
    return Promise.resolve({});
  }, "cus_1", "c1");
  assertEquals(calls, ["GET checkout/sessions", "POST checkout/sessions/cs_a/expire", "GET subscriptions"]);
  assertEquals(found?.id, "sub_incomplete");
});
