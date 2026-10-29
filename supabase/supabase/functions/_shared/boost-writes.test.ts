// MESITA-2995 — Premier's money writes: a held payment is captured only when
// its quote still holds under the place lock (else the hold is released), a
// confirm run twice never charges twice, a renewal moves to the next pledge
// only on a real card decline, and an unknown answer never charges a second
// card. Stripe and the database are stubbed (unit only).

import { assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  confirmPledge,
  endConsumerPledges,
  type Period,
  type Pledge,
  renewPlace,
  settleCharging,
  type StripeCall,
  StripeError,
} from "./boost.ts";

type Result = { data?: unknown; error: { message: string } | null };

/** A database stand-in. Table calls pop the next scripted result for
 *  `table.op` (or succeed empty); RPCs pop theirs by name. Everything is logged. */
function fakeAdmin(script: Record<string, Result[]>) {
  const log: string[] = [];
  const next = (k: string): Result => script[k]?.shift() ?? { data: null, error: null };
  const chain = (k: string) => {
    const c: Record<string, unknown> = {};
    for (const m of ["eq", "not", "in", "lt", "gte", "order", "limit", "select"]) c[m] = () => c;
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
};

const META = {
  backing_id: "b1",
  tier: "boost_5x",
  interval: "month",
  price_cents: "5000",
  credit_cents: "500",
  extra_days: "0",
  charge_cents: "4500",
  role: "payer",
};

const heldSession = (piStatus = "requires_capture") => ({
  id: "cs_1",
  status: "complete",
  mode: "payment",
  metadata: META,
  payment_intent: { id: "pi_1", status: piStatus, payment_method: "pm_new" },
});

Deno.test("confirm: a quote that still holds is claimed, then captured once, then the pledge stands", async () => {
  const { admin, log } = fakeAdmin({
    "rpc.premier_claim": [{ data: { result: "started", period_id: "per_new" }, error: null }],
    "rpc.premier_settle": [{ data: "paid", error: null }],
  });
  const { stripe, calls } = fakeStripe({
    "GET checkout/sessions/cs_1": heldSession(),
    "POST payment_intents/pi_1/capture": { id: "pi_1", status: "succeeded" },
  });
  assertEquals(await confirmPledge(admin, stripe, PLEDGE, false), "confirmed");
  assertEquals(calls, ["GET checkout/sessions/cs_1", "POST payment_intents/pi_1/capture [premier-capture:pi_1]"]);
  assertEquals(log, ["rpc.premier_claim", "rpc.premier_settle", "place_backings.update"]);
});

Deno.test("confirm: a stale quote releases the hold — never captured, never refunded — and the card stays as a backup", async () => {
  const { admin, log } = fakeAdmin({
    "rpc.premier_claim": [{ data: { result: "stale", reason: "quote" }, error: null }],
  });
  const { stripe, calls } = fakeStripe({ "GET checkout/sessions/cs_1": heldSession() });
  assertEquals(await confirmPledge(admin, stripe, PLEDGE, false), "released_stale");
  assertEquals(calls, ["GET checkout/sessions/cs_1", "POST payment_intents/pi_1/cancel [premier-release:pi_1]"]);
  assertEquals(log, ["rpc.premier_claim", "place_backings.update"]);
});

Deno.test("confirm: run twice (return + cron), the second sees it settled and charges nothing", async () => {
  const { admin, log } = fakeAdmin({
    "rpc.premier_claim": [{ data: { result: "settled", period_id: "per_new" }, error: null }],
    "rpc.premier_settle": [{ data: "paid", error: null }],
  });
  const { stripe, calls } = fakeStripe({ "GET checkout/sessions/cs_1": heldSession("succeeded") });
  assertEquals(await confirmPledge(admin, stripe, PLEDGE, false), "confirmed");
  assertEquals(calls, ["GET checkout/sessions/cs_1"]);
  assertEquals(log, ["rpc.premier_claim", "rpc.premier_settle", "place_backings.update"]);
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
  assertEquals(await confirmPledge(admin, stripe, { ...PLEDGE, status: "open" }, false), "expired");
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
  ...over,
});

Deno.test("renewal: a declined card moves to the next pledge, each attempt with its own key", async () => {
  const { admin, log } = fakeAdmin({
    "rpc.premier_begin_renewal": [
      { data: { action: "charge", period_id: "per_a" }, error: null },
      { data: { action: "charge", period_id: "per_b" }, error: null },
    ],
    "place_premier_periods.select": [
      { data: PERIOD({ id: "per_a", backing_id: "b1" }), error: null },
      { data: PERIOD({ id: "per_b", backing_id: "b2" }), error: null },
    ],
    "place_backings.select": [
      { data: { ...PLEDGE, id: "b1" }, error: null },
      { data: { ...PLEDGE, id: "b2", consumer_id: "c2" }, error: null },
    ],
    "premier_customers.select": [
      { data: { stripe_customer: "cus_1" }, error: null },
      { data: { stripe_customer: "cus_2" }, error: null },
    ],
    "rpc.premier_settle": [{ data: "declined", error: null }, { data: "paid", error: null }],
  });
  const { stripe, calls } = fakeStripe({
    "POST payment_intents": [
      new StripeError("payment_intents", "card_error", "card_declined", 402, "Your card was declined."),
      { id: "pi_b", status: "succeeded" },
    ],
  });
  assertEquals(await renewPlace(admin, stripe, "p1", T0), "paid");
  assertEquals(calls, [
    "POST payment_intents [premier-charge:per_a]",
    "POST payment_intents [premier-charge:per_b]",
  ]);
  assertEquals(log.filter((l) => l.startsWith("rpc.")), [
    "rpc.premier_begin_renewal",
    "rpc.premier_settle",
    "rpc.premier_begin_renewal",
    "rpc.premier_settle",
  ]);
});

Deno.test("renewal: a timeout charges nobody else — the walk stops and the row stays charging", async () => {
  const { admin, log } = fakeAdmin({
    "rpc.premier_begin_renewal": [{ data: { action: "charge", period_id: "per_a" }, error: null }],
    "place_premier_periods.select": [{ data: PERIOD({ id: "per_a" }), error: null }],
    "place_backings.select": [{ data: PLEDGE, error: null }],
    "premier_customers.select": [{ data: { stripe_customer: "cus_1" }, error: null }],
  });
  const { stripe, calls } = fakeStripe({ "POST payment_intents": new TypeError("network timeout") });
  assertEquals(await renewPlace(admin, stripe, "p1", T0 + 60_000), "unknown");
  assertEquals(calls.length, 1);
  assertEquals(log.filter((l) => l === "rpc.premier_settle" || l === "rpc.premier_begin_renewal"), ["rpc.premier_begin_renewal"]);
});

Deno.test("reaper: a payment still processing after 24 h is cancelled, then declined; a paid one is just recorded", async () => {
  const old = PERIOD({ id: "per_old", stripe_payment_intent_id: "pi_old" });
  {
    const { admin, log } = fakeAdmin({ "rpc.premier_settle": [{ data: "declined", error: null }] });
    const { stripe, calls } = fakeStripe({ "GET payment_intents/pi_old": { id: "pi_old", status: "processing" } });
    assertEquals(await settleCharging(admin, stripe, old, T0 + 25 * 3600_000), "declined");
    assertEquals(calls, ["GET payment_intents/pi_old", "POST payment_intents/pi_old/cancel"]);
    assertEquals(log, ["rpc.premier_settle"]);
  }
  {
    const { admin } = fakeAdmin({ "rpc.premier_settle": [{ data: "paid", error: null }] });
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
    "place_backings.select": [{ data: [PLEDGE], error: null }],
    "place_premier_periods.select": [{ data: [PERIOD({ stripe_payment_intent_id: "pi_x" })], error: null }],
  });
  const { stripe, calls } = fakeStripe({ "GET payment_intents/pi_x": { id: "pi_x", status: "processing" } });
  const res = await endConsumerPledges(admin, "c1", stripe);
  assertEquals(res.ok, false);
  assertEquals(calls.some((c) => c.includes("detach")), false);
});

Deno.test("account deletion: with nothing in flight every pledge leaves and its card is detached", async () => {
  const { admin, log } = fakeAdmin({
    "place_backings.select": [{ data: [{ ...PLEDGE, stripe_checkout_session_id: null }], error: null }],
    "place_premier_periods.select": [{ data: [], error: null }],
  });
  const { stripe, calls } = fakeStripe({});
  assertEquals(await endConsumerPledges(admin, "c1", stripe), { ok: true, ended: 1 });
  assertEquals(calls, ["POST payment_methods/pm_old/detach"]);
  assertEquals(log.at(-1), "place_backings.update");
});
