// Run: deno test --allow-read supabase/functions/_shared/guest-plan.test.ts
//
// The guest Plan is money (MESITA-3870): Pro is $2/month, and only a paid
// period (or an operator's grant) may lift the reservation cap to Pro's.

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  effectivePlan,
  needsRefresh,
  planCheckoutParams,
  planPatch,
  PRO_PRICE_CENTS,
  readSubscription,
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

Deno.test("Pro is $1.00 (MESITA-3881)", () => assertEquals(PRO_PRICE_CENTS, 100));

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

Deno.test("planCheckoutParams: $2 a month, the guest's customer, back with plan=<session>", () => {
  const p = planCheckoutParams({ customer: "cus_1", consumerId: "c1", returnUrl: "https://mesita.ai/me/plan", nowSec: 1000 });
  assertEquals(p.mode, "subscription");
  assertEquals(p.customer, "cus_1");
  assertEquals(p.client_reference_id, "c1");
  assertEquals(p.success_url, "https://mesita.ai/me/plan?plan={CHECKOUT_SESSION_ID}");
  const item = (p.line_items as Array<{ price_data: Record<string, unknown> }>)[0].price_data;
  assertEquals(item.unit_amount, 100);
  assertEquals(item.currency, "usd");
  assertEquals(item.recurring, { interval: "month" });
});
