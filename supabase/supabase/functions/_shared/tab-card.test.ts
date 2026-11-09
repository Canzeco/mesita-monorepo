// MESITA-3563 (money): the in-app card part. One card row → one clone, one
// PaymentIntent, one confirm, each keyed by the row (a double tap is one
// charge); the PI is stored before it is confirmed; no application fee; a
// decline or a bank check the app cannot show cancels the PI and releases
// the row (freeing the held credit); a replay only reads.

import { assert, assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { type StripeCall, StripeError } from "./boost.ts";
import { paymentsPublishableKey, runTabCard } from "./tab-card.ts";
import { readSplitBody } from "./tab.ts";

type Call = { method: string; path: string; params?: Record<string, unknown>; opts?: Record<string, unknown> };

function fakeAdmin(row: Record<string, unknown>) {
  const rpcs: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const admin = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: row, error: null }) }) }),
    }),
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpcs.push({ fn, args });
      if (fn === "wallet_open_payment_pi") return Promise.resolve({ data: { ok: true, outcome: "opened" }, error: null });
      if (fn === "wallet_settle_payment") return Promise.resolve({ data: { ok: true, outcome: "paid" }, error: null });
      return Promise.resolve({ data: { ok: true, outcome: "released" }, error: null });
    },
  };
  return { admin: admin as unknown as SupabaseClient, rpcs };
}

function fakeStripe(answer: (c: Call) => Record<string, unknown>) {
  const calls: Call[] = [];
  const stripe: StripeCall = (method, path, params, opts) => {
    const c = { method, path, params, opts: opts as Record<string, unknown> | undefined };
    calls.push(c);
    try {
      return Promise.resolve(answer(c));
    } catch (err) {
      return Promise.reject(err);
    }
  };
  return { stripe, calls };
}

const ROW = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "opening",
  stripe_account_id: "acct_place",
  stripe_payment_intent_id: null,
  card_cents: 8000,
  tip_cents: 4500,
  created_at: new Date().toISOString(),
};

const ARGS = {
  paymentId: ROW.id,
  customer: "cus_guest",
  platformPm: "pm_platform123",
  currency: "mxn",
  placeId: "p",
  placeName: "Cuerno",
  consumerId: "c",
  tabId: "t",
  publishableKey: "pk_test_abc",
};

Deno.test("card part: clone, create unconfirmed, store, confirm — each keyed by the row; no application fee", async () => {
  const { admin, rpcs } = fakeAdmin(ROW);
  const { stripe, calls } = fakeStripe((c) => {
    if (c.path === "payment_methods") return { id: "pm_cloned" };
    if (c.path === "payment_intents") return { id: "pi_1", status: "requires_confirmation" };
    return { id: "pi_1", status: "succeeded" };
  });
  const res = await runTabCard(admin, stripe, ARGS);
  assert(res.ok);
  assertEquals(res.step.status, "succeeded");
  assertEquals(calls.map((c) => c.path), ["payment_methods", "payment_intents", "payment_intents/pi_1/confirm"]);
  assertEquals(calls.map((c) => c.opts?.idempotencyKey), [`tabcard-clone:${ROW.id}`, `tabcard-pi:${ROW.id}`, `tabcard-confirm:${ROW.id}`]);
  assert(calls.every((c) => c.opts?.stripeAccount === "acct_place"));
  const create = calls[1].params!;
  assertEquals(create.amount, 12500);
  assertEquals(create.payment_method, "pm_cloned");
  assertEquals(create.payment_method_types, ["card"]);
  assertEquals("confirm" in create, false);
  assertEquals("application_fee_amount" in create, false);
  assertEquals((create.metadata as Record<string, unknown>).mesita_kind, "wallet_payment");
  assertEquals(calls[2].params, { use_stripe_sdk: true });
  // Stored before confirmed, settled after.
  assertEquals(rpcs.map((r) => r.fn), ["wallet_open_payment_pi", "wallet_settle_payment"]);
});

Deno.test("card part: a decline cancels the PI and releases the row (the held credit is free)", async () => {
  const { admin, rpcs } = fakeAdmin(ROW);
  const { stripe, calls } = fakeStripe((c) => {
    if (c.path === "payment_methods") return { id: "pm_cloned" };
    if (c.path === "payment_intents") return { id: "pi_2", status: "requires_confirmation" };
    if (c.path.endsWith("/confirm")) throw new StripeError(c.path, "card_error", "card_declined", 402, "Your card was declined.");
    if (c.method === "GET") return { id: "pi_2", status: "requires_payment_method", last_payment_error: { decline_code: "insufficient_funds" } };
    return { id: "pi_2", status: "canceled" };
  });
  const res = await runTabCard(admin, stripe, ARGS);
  assert(!res.ok);
  assertEquals(res.code, "card_declined");
  assertEquals(res.detail?.decline_code, "insufficient_funds");
  assert(calls.some((c) => c.path === "payment_intents/pi_2/cancel"));
  const release = rpcs.find((r) => r.fn === "wallet_release_payment");
  assertEquals(release?.args, { p_payment_id: ROW.id, p_status: "failed", p_error: "insufficient_funds" });
  assertEquals(rpcs.some((r) => r.fn === "wallet_settle_payment"), false);
});

Deno.test("card part: 3-D Secure hands Stripe.js the secret; without a publishable key it cancels and releases", async () => {
  const answer = (c: Call) => {
    if (c.path === "payment_methods") return { id: "pm_cloned" };
    if (c.path === "payment_intents") return { id: "pi_3", status: "requires_confirmation" };
    if (c.path.endsWith("/confirm")) return { id: "pi_3", status: "requires_action", client_secret: "pi_3_secret_x" };
    return { id: "pi_3", status: "canceled" };
  };
  const a = fakeAdmin(ROW);
  const withKey = await runTabCard(a.admin, fakeStripe(answer).stripe, ARGS);
  assert(withKey.ok);
  assertEquals(withKey.step, {
    status: "requires_action",
    payment_intent_id: "pi_3",
    client_secret: "pi_3_secret_x",
    stripe_account: "acct_place",
    publishable_key: "pk_test_abc",
  });
  assertEquals(a.rpcs.some((r) => r.fn === "wallet_release_payment"), false);

  const b = fakeAdmin(ROW);
  const s = fakeStripe(answer);
  const noKey = await runTabCard(b.admin, s.stripe, { ...ARGS, publishableKey: null });
  assert(!noKey.ok);
  assertEquals(noKey.code, "card_needs_auth");
  assert(s.calls.some((c) => c.path === "payment_intents/pi_3/cancel"));
  assertEquals(b.rpcs.find((r) => r.fn === "wallet_release_payment")?.args.p_status, "failed");
});

Deno.test("card part: the same tap again only reads its PaymentIntent (no second charge)", async () => {
  const { admin } = fakeAdmin({ ...ROW, status: "open", stripe_payment_intent_id: "pi_4" });
  const { stripe, calls } = fakeStripe(() => ({ id: "pi_4", status: "requires_action", client_secret: "pi_4_secret" }));
  const res = await runTabCard(admin, stripe, ARGS);
  assert(res.ok);
  assertEquals(res.step.status, "requires_action");
  assertEquals(calls.map((c) => `${c.method} ${c.path}`), ["GET payment_intents/pi_4"]);
});

Deno.test("a card part needs a saved card; the publishable key must match the mode", () => {
  const base = { tab_id: crypto.randomUUID(), request_id: crypto.randomUUID(), bill_version: 1, credit_cents: 0, card_bill_cents: 5000 };
  const no = readSplitBody(base);
  assert(!no.ok);
  assertEquals(no.code, "card_required");
  const yes = readSplitBody({ ...base, card_pm_id: "pm_1UZoBARmAHRbquTx" });
  assert(yes.ok);
  assertEquals(yes.input.cardPmId, "pm_1UZoBARmAHRbquTx");
  const cashOnly = readSplitBody({ ...base, card_bill_cents: 0, cash_bill_cents: 5000 });
  assert(cashOnly.ok);
  assertEquals(cashOnly.input.cardPmId, null);

  const env = (m: Record<string, string>) => (k: string) => m[k];
  assertEquals(paymentsPublishableKey(false, env({ STRIPE_PUBLISHABLE_KEY_TEST: "pk_test_1" })), "pk_test_1");
  assertEquals(paymentsPublishableKey(false, env({ STRIPE_PUBLISHABLE_KEY_TEST: "pk_live_1" })), null);
  assertEquals(paymentsPublishableKey(true, env({ STRIPE_PUBLISHABLE_KEY_LIVE: "pk_live_1" })), "pk_live_1");
  assertEquals(paymentsPublishableKey(false, env({})), null);
});
