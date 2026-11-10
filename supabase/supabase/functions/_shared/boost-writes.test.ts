// MESITA-2995 / MESITA-3092 — Premier's money writes: a held payment is
// captured only when its quote still holds under the place lock (else the
// hold is released), a pledge becomes the place's subscription only through
// premier_make_payer, a losing Checkout never becomes it, a confirm run twice
// never charges twice, a declined renewal ends the subscription with no
// second card tried, and a payer's own declined upgrade keeps it. Stripe and
// the database are stubbed (unit only).

import { assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  type Period,
  type Pledge,
} from "./boost.ts";
import { type StripeCall, StripeError } from "./stripe.ts";
import { confirmPledge, endConsumerPledges, renewPlace, settleCharging } from "./boost-writes.ts";

type Result = { data?: unknown; error: { message: string } | null };

/** A database stand-in. Table calls pop the next scripted result for
 *  `table.op` (or succeed empty); RPCs pop theirs by name. Everything is logged. */
function fakeAdmin(script: Record<string, Result[]>) {
  const log: string[] = [];
  const next = (k: string): Result => script[k]?.shift() ?? { data: null, error: null };
  const chain = (k: string) => {
    const c: Record<string, unknown> = {};
    for (const m of ["eq", "not", "in", "lt", "gte", "order", "limit", "select", "or", "is"]) c[m] = () => c;
    c.maybeSingle = () => Promise.resolve((log.push(k), next(k)));
    c.single = c.maybeSingle;
    c.then = (res: (r: Result) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve((log.push(k), next(k))).then(res, rej);
    return c;
  };
  const admin = {
    from: (table: string) => ({
      select: () => chain(`${table}.select`),
      update: () => chain(`${table}.update`),
      insert: () => chain(`${table}.insert`),
      upsert: () => chain(`${table}.upsert`),
      delete: () => chain(`${table}.delete`),
    }),
    rpc: (name: string) => Promise.resolve((log.push(`rpc.${name}`), next(`rpc.${name}`))),
    auth: { admin: { getUserById: () => Promise.resolve({ data: { user: { email: "g@x.com" } } }) } },
  } as unknown as SupabaseClient;
  return { admin, log };
}

/** A Stripe stand-in answering by `METHOD path`; a list answers in turn, an
 *  Error rejects. Keys are logged with each call. */
function fakeStripe(answers: Record<string, unknown>) {
  const calls: string[] = [];
  const stripe: StripeCall = (method, path, _params, opts) => {
    const key = `${method} ${path}`;
    calls.push(opts?.idempotencyKey ? `${key} [${opts.idempotencyKey}]` : key);
    let a = answers[key];
    if (Array.isArray(a)) a = a.shift();
    if (a instanceof Error) return Promise.reject(a);
    return Promise.resolve((a ?? {}) as Record<string, unknown>);
  };
  return { stripe, calls };
}

const T0 = Date.parse("2026-11-01T00:00:00Z");

/** The payer's subscription, mid-change to 5X through a Checkout. */
const PLEDGE: Pledge = {
  id: "b1",
  place_id: "p1",
  consumer_id: "c1",
  tier: "boost_2x",
  billing_interval: "month",
  amount_cents: 1000,
  status: "ready",
  queued_at: new Date(T0).toISOString(),
  stripe_payment_method_id: "pm_old",
  stripe_checkout_session_id: "cs_1",
  pending_tier: "boost_5x",
  pending_interval: "month",
  pending_amount_cents: 5000,
  quoted_period_id: "per_running",
  quoted_credit_cents: 500,
  livemode: false,
  created_at: new Date(T0).toISOString(),
  ended_at: null,
  ended_reason: null,
  checkout_kind: "change",
  notice_dismissed_at: null,
};

/** A stranger's first purchase: a new pledge whose Checkout pays now. */
const BUY: Pledge = {
  ...PLEDGE,
  id: "b1",
  status: "open",
  tier: "boost_5x",
  stripe_payment_method_id: null,
  pending_tier: null,
  pending_interval: null,
  pending_amount_cents: null,
  quoted_period_id: null,
  quoted_credit_cents: 0,
  checkout_kind: "buy",
};

const META = {
  backing_id: "b1",
  tier: "boost_5x",
  interval: "month",
  price_cents: "5000",
  credit_cents: "500",
  extra_days: "0",
  charge_cents: "4500",
  kind: "change",
};

const heldSession = (piStatus = "requires_capture") => ({
  id: "cs_1",
  status: "complete",
  mode: "payment",
  metadata: META,
  payment_intent: { id: "pi_1", status: piStatus, payment_method: "pm_new" },
});

const setupSession = (kind: string) => ({
  id: "cs_1",
  status: "complete",
  mode: "setup",
  metadata: { ...META, kind },
  setup_intent: { id: "si_1", payment_method: "pm_new" },
});

const PAID = { data: { status: "paid" }, error: null };

Deno.test("confirm: a first purchase that wins is claimed, captured once, then made the place's subscription", async () => {
  const { admin, log } = fakeAdmin({
    "rpc.premier_claim": [{ data: { result: "started", period_id: "per_new" }, error: null }],
    "rpc.premier_settle": [PAID],
    "rpc.premier_make_payer": [{ data: { result: "ready", detach: [] }, error: null }],
  });
  const { stripe, calls } = fakeStripe({
    "GET checkout/sessions/cs_1": heldSession(),
    "POST payment_intents/pi_1/capture": { id: "pi_1", status: "succeeded" },
  });
  assertEquals(await confirmPledge(admin, stripe, BUY, false), "confirmed");
  assertEquals(calls, ["GET checkout/sessions/cs_1", "POST payment_intents/pi_1/capture [premier-capture:pi_1]"]);
  assertEquals(log, ["rpc.premier_claim", "rpc.premier_settle", "rpc.premier_make_payer", "place_backings.update"]);
});

Deno.test("confirm: a losing Checkout releases its hold, ends `lost`, detaches its card and never becomes the subscription", async () => {
  const { admin, log } = fakeAdmin({
    "rpc.premier_claim": [{ data: { result: "stale", reason: "quote" }, error: null }],
  });
  const { stripe, calls } = fakeStripe({ "GET checkout/sessions/cs_1": heldSession() });
  assertEquals(await confirmPledge(admin, stripe, BUY, false), "lost");
  assertEquals(calls, [
    "GET checkout/sessions/cs_1",
    "POST payment_intents/pi_1/cancel [premier-release:pi_1]",
    "POST payment_methods/pm_new/detach",
  ]);
  assertEquals(log, ["rpc.premier_claim", "place_backings.update"]);
  assertEquals(log.includes("rpc.premier_make_payer"), false);
});

Deno.test("confirm: a charge in flight keeps the hold and asks again later", async () => {
  const { admin, log } = fakeAdmin({
    "rpc.premier_claim": [{ data: { result: "stale", reason: "charging" }, error: null }],
  });
  const { stripe, calls } = fakeStripe({ "GET checkout/sessions/cs_1": heldSession() });
  assertEquals(await confirmPledge(admin, stripe, BUY, false), "pending");
  assertEquals(calls, ["GET checkout/sessions/cs_1"]);
  assertEquals(log, ["rpc.premier_claim"]);
});

Deno.test("confirm: the payer's change that went stale keeps the subscription; only the new card is detached", async () => {
  const { admin, log } = fakeAdmin({
    "rpc.premier_claim": [{ data: { result: "stale", reason: "covered" }, error: null }],
  });
  const { stripe, calls } = fakeStripe({ "GET checkout/sessions/cs_1": heldSession() });
  assertEquals(await confirmPledge(admin, stripe, PLEDGE, false), "covered");
  assertEquals(calls.includes("POST payment_methods/pm_old/detach"), false);
  assertEquals(calls.at(-1), "POST payment_methods/pm_new/detach");
  assertEquals(log, ["rpc.premier_claim", "place_backings.update"]);
});

Deno.test("confirm: the payer's upgrade takes — new terms move in, the new card replaces the old", async () => {
  const { admin, log } = fakeAdmin({
    "rpc.premier_claim": [{ data: { result: "started", period_id: "per_new" }, error: null }],
    "rpc.premier_settle": [PAID],
  });
  const { stripe, calls } = fakeStripe({
    "GET checkout/sessions/cs_1": heldSession(),
    "POST payment_intents/pi_1/capture": { id: "pi_1", status: "succeeded" },
  });
  assertEquals(await confirmPledge(admin, stripe, PLEDGE, false), "confirmed");
  assertEquals(calls.at(-1), "POST payment_methods/pm_old/detach");
  assertEquals(log, ["rpc.premier_claim", "rpc.premier_settle", "place_backings.update"]);
});

// F6: only a renewal ends its pledge on decline (premier_settle, pgTAP); a
// payer's own Checkout upgrade that is declined keeps the subscription.
Deno.test("confirm: the payer's own upgrade declined at capture keeps the subscription and its card", async () => {
  const { admin, log } = fakeAdmin({
    "rpc.premier_claim": [{ data: { result: "started", period_id: "per_new" }, error: null }],
    "rpc.premier_settle": [{ data: { status: "declined", ended_reason: null, payment_method: null }, error: null }],
  });
  const { stripe, calls } = fakeStripe({
    "GET checkout/sessions/cs_1": heldSession(),
    "POST payment_intents/pi_1/capture": new StripeError("payment_intents", "card_error", "card_declined", 402, "declined"),
  });
  assertEquals(await confirmPledge(admin, stripe, PLEDGE, false), "declined");
  assertEquals(calls.includes("POST payment_methods/pm_old/detach"), false);
  assertEquals(log, ["rpc.premier_claim", "rpc.premier_settle", "place_backings.update"]);
});

Deno.test("confirm: a first purchase declined at capture leaves nothing — premier_settle ends it, its card is detached", async () => {
  const { admin, log } = fakeAdmin({
    "rpc.premier_claim": [{ data: { result: "started", period_id: "per_new" }, error: null }],
    "rpc.premier_settle": [{ data: { status: "declined", ended_reason: "checkout_failed", payment_method: "pm_new" }, error: null }],
  });
  const { stripe, calls } = fakeStripe({
    "GET checkout/sessions/cs_1": heldSession(),
    "POST payment_intents/pi_1/capture": new StripeError("payment_intents", "card_error", "card_declined", 402, "declined"),
  });
  assertEquals(await confirmPledge(admin, stripe, BUY, false), "declined");
  assertEquals(calls.filter((c) => c.endsWith("/detach")).length >= 1, true);
  assertEquals(log.includes("rpc.premier_make_payer"), false);
});

Deno.test("confirm: run twice (return + cron), the second sees it settled and charges nothing", async () => {
  const { admin, log } = fakeAdmin({
    "rpc.premier_claim": [{ data: { result: "settled", period_id: "per_new" }, error: null }],
    "rpc.premier_settle": [PAID],
  });
  const { stripe, calls } = fakeStripe({ "GET checkout/sessions/cs_1": heldSession("succeeded") });
  assertEquals(await confirmPledge(admin, stripe, PLEDGE, false), "confirmed");
  assertEquals(calls.filter((c) => !c.endsWith("/detach")), ["GET checkout/sessions/cs_1"]);
  assertEquals(log, ["rpc.premier_claim", "rpc.premier_settle", "place_backings.update"]);
});

Deno.test("confirm: a Checkout already settled is read back from the pledge, without Stripe", async () => {
  const { admin } = fakeAdmin({});
  const { stripe, calls } = fakeStripe({});
  assertEquals(await confirmPledge(admin, stripe, { ...BUY, status: "ended", ended_reason: "lost", checkout_kind: null }, false), "lost");
  assertEquals(await confirmPledge(admin, stripe, { ...BUY, status: "ready", checkout_kind: null }, false), "confirmed");
  assertEquals(calls, []);
});

Deno.test("confirm: a session whose metadata names another pledge is refused", async () => {
  const { admin, log } = fakeAdmin({});
  const { stripe } = fakeStripe({
    "GET checkout/sessions/cs_1": { ...heldSession(), metadata: { ...META, backing_id: "someone-else" } },
  });
  assertEquals(await confirmPledge(admin, stripe, PLEDGE, false), "none");
  assertEquals(log, []);
});

Deno.test("confirm: a Checkout the guest abandoned ends a never-confirmed pledge", async () => {
  const { admin, log } = fakeAdmin({});
  const { stripe } = fakeStripe({ "GET checkout/sessions/cs_1": { id: "cs_1", status: "expired", metadata: META } });
  assertEquals(await confirmPledge(admin, stripe, BUY, false), "expired");
  assertEquals(log, ["place_backings.update"]);
});

Deno.test("confirm: resume saves a card and makes the pledge the subscription; nothing is charged now", async () => {
  const { admin, log } = fakeAdmin({
    "rpc.premier_make_payer": [{ data: { result: "ready", detach: [] }, error: null }],
  });
  const { stripe, calls } = fakeStripe({ "GET checkout/sessions/cs_1": setupSession("resume") });
  assertEquals(await confirmPledge(admin, stripe, { ...BUY, checkout_kind: "resume" }, false), "saved");
  assertEquals(calls, ["GET checkout/sessions/cs_1"]);
  assertEquals(log, ["rpc.premier_make_payer", "place_backings.update"]);
});

// MESITA-3165: subscribing early outside the last 7 days of Refill days (more
// days were added while the Checkout was open) never stands.
Deno.test("confirm: an early start the window no longer allows ends `covered`, its card detached, never the subscription", async () => {
  const { admin, log } = fakeAdmin({
    "rpc.premier_make_payer": [{ data: { result: "covered" }, error: null }],
  });
  const { stripe, calls } = fakeStripe({ "GET checkout/sessions/cs_1": setupSession("resume") });
  assertEquals(await confirmPledge(admin, stripe, { ...BUY, checkout_kind: "resume" }, false), "covered");
  assertEquals(calls, ["GET checkout/sessions/cs_1", "POST payment_methods/pm_new/detach"]);
  assertEquals(log, ["rpc.premier_make_payer", "place_backings.update"]);
});

Deno.test("confirm: update card swaps the subscription's card and detaches the old one", async () => {
  const { admin, log } = fakeAdmin({});
  const { stripe, calls } = fakeStripe({ "GET checkout/sessions/cs_1": setupSession("update_card") });
  assertEquals(await confirmPledge(admin, stripe, { ...PLEDGE, pending_tier: null, checkout_kind: "update_card" }, false), "saved");
  assertEquals(calls, ["GET checkout/sessions/cs_1", "POST payment_methods/pm_old/detach"]);
  assertEquals(log, ["place_backings.update"]);
});

const PERIOD = (over: Partial<Period>): Period => ({
  id: "per",
  place_id: "p1",
  backing_id: "b1",
  granted_by: null,
  tier: 1,
  billing_interval: "month",
  starts_at: new Date(T0).toISOString(),
  ends_at: new Date(T0 + 30 * 86_400_000).toISOString(),
  price_cents: 1000,
  credit_cents: 0,
  extra_days: 0,
  charged_cents: 1000,
  stripe_payment_intent_id: null,
  stripe_checkout_session_id: null,
  status: "charging",
  created_at: new Date(T0).toISOString(),
  remaining_at_cover_sec: null,
  covered_until: null,
  ...over,
});

const SUBSCRIPTION = { ...PLEDGE, stripe_checkout_session_id: null, pending_tier: null, checkout_kind: null };

Deno.test("renewal: a declined card ends the subscription — one charge, no second card, its card detached (R6)", async () => {
  const { admin, log } = fakeAdmin({
    "rpc.premier_begin_renewal": [{ data: { action: "charge", period_id: "per_a" }, error: null }],
    "place_premier_periods.select": [{ data: PERIOD({ id: "per_a" }), error: null }],
    "place_backings.select": [{ data: SUBSCRIPTION, error: null }],
    "premier_customers.select": [{ data: { stripe_customer: "cus_1" }, error: null }],
    "rpc.premier_settle": [{ data: { status: "declined", ended_reason: "declined", payment_method: "pm_old" }, error: null }],
  });
  const { stripe, calls } = fakeStripe({
    "POST payment_intents": new StripeError("payment_intents", "card_error", "card_declined", 402, "Your card was declined."),
  });
  assertEquals(await renewPlace(admin, stripe, "p1", T0), "declined");
  assertEquals(calls, ["POST payment_intents [premier-charge:per_a]", "POST payment_methods/pm_old/detach"]);
  assertEquals(log.filter((l) => l.startsWith("rpc.")), ["rpc.premier_begin_renewal", "rpc.premier_settle"]);
});

Deno.test("renewal: a timeout charges nobody else — the row stays charging", async () => {
  const { admin, log } = fakeAdmin({
    "rpc.premier_begin_renewal": [{ data: { action: "charge", period_id: "per_a" }, error: null }],
    "place_premier_periods.select": [{ data: PERIOD({ id: "per_a" }), error: null }],
    "place_backings.select": [{ data: SUBSCRIPTION, error: null }],
    "premier_customers.select": [{ data: { stripe_customer: "cus_1" }, error: null }],
  });
  const { stripe, calls } = fakeStripe({ "POST payment_intents": new TypeError("network timeout") });
  assertEquals(await renewPlace(admin, stripe, "p1", T0 + 60_000), "unknown");
  assertEquals(calls.length, 1);
  assertEquals(log.filter((l) => l === "rpc.premier_settle" || l === "rpc.premier_begin_renewal"), ["rpc.premier_begin_renewal"]);
});

Deno.test("renewal: a subscription Manual covered for over an interval ends and its card is detached (F7)", async () => {
  const { admin } = fakeAdmin({
    "rpc.premier_begin_renewal": [{ data: { action: "none", reason: "dormant", backing_id: "b1", payment_method: "pm_old" }, error: null }],
  });
  const { stripe, calls } = fakeStripe({});
  assertEquals(await renewPlace(admin, stripe, "p1", T0), "idle");
  assertEquals(calls, ["POST payment_methods/pm_old/detach"]);
});

Deno.test("reaper: a payment still processing after 24 h is cancelled, then declined; a paid one is just recorded", async () => {
  const old = PERIOD({ id: "per_old", stripe_payment_intent_id: "pi_old" });
  {
    const { admin, log } = fakeAdmin({ "rpc.premier_settle": [{ data: { status: "declined" }, error: null }] });
    const { stripe, calls } = fakeStripe({ "GET payment_intents/pi_old": { id: "pi_old", status: "processing" } });
    assertEquals(await settleCharging(admin, stripe, old, T0 + 25 * 3600_000), "declined");
    assertEquals(calls, ["GET payment_intents/pi_old", "POST payment_intents/pi_old/cancel"]);
    assertEquals(log, ["rpc.premier_settle"]);
  }
  {
    const { admin } = fakeAdmin({ "rpc.premier_settle": [PAID] });
    const { stripe, calls } = fakeStripe({ "GET payment_intents/pi_old": { id: "pi_old", status: "succeeded" } });
    assertEquals(await settleCharging(admin, stripe, old, T0 + 25 * 3600_000), "paid");
    assertEquals(calls, ["GET payment_intents/pi_old"]);
  }
  {
    const { admin } = fakeAdmin({});
    const { stripe, calls } = fakeStripe({ "GET payment_intents/pi_old": { id: "pi_old", status: "processing" } });
    assertEquals(await settleCharging(admin, stripe, old, T0 + 3600_000), "unknown");
    assertEquals(calls, ["GET payment_intents/pi_old"]);
  }
});

Deno.test("account deletion: a charge still in flight refuses it before any card is detached", async () => {
  const { admin } = fakeAdmin({
    "place_backings.select": [{ data: [SUBSCRIPTION], error: null }],
    // Created now: endConsumerPledges reads the wall clock, and a charge
    // older than CHARGING_GIVE_UP_MS is no longer in flight (T0 went stale
    // on 2026-11-02 and failed every Supabase PR).
    "place_premier_periods.select": [
      { data: [PERIOD({ stripe_payment_intent_id: "pi_x", created_at: new Date().toISOString() })], error: null },
    ],
  });
  const { stripe, calls } = fakeStripe({ "GET payment_intents/pi_x": { id: "pi_x", status: "processing" } });
  const res = await endConsumerPledges(admin, "c1", stripe);
  assertEquals(res.ok, false);
  assertEquals(calls.some((c) => c.includes("detach")), false);
});

Deno.test("account deletion: with nothing in flight every pledge ends and its card is detached", async () => {
  const { admin, log } = fakeAdmin({
    "place_backings.select": [{ data: [SUBSCRIPTION], error: null }, { data: SUBSCRIPTION, error: null }],
    "place_premier_periods.select": [{ data: [], error: null }],
  });
  const { stripe, calls } = fakeStripe({});
  assertEquals(await endConsumerPledges(admin, "c1", stripe), { ok: true, ended: 1 });
  assertEquals(calls, ["POST payment_methods/pm_old/detach"]);
  assertEquals(log.at(-1), "place_backings.update");
});
