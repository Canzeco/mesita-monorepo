// The settle of a bill's Stripe Checkout (MESITA-3305): kept for the cron
// and the Connect receiver after the card part of a bill left (MESITA-4708);
// these tests moved here from pay-card.test.ts with it.

import { assertEquals } from "jsr:@std/assert@1";
import { classifySession } from "./checkout-session.ts";
import { settlePayment } from "./settle-payment.ts";
import { fakeAdmin } from "./testing/fake-admin.ts";
import { WALLET_CHECKOUT_TTL_SEC } from "./wallet.ts";
import type { StripeCall } from "./stripe.ts";

const ROW = "00000000-0000-4000-8000-0000000d3305";
const T0 = Date.parse("2026-11-08T12:00:00Z");

Deno.test("classifySession reads the payment's own key, so a purchase session never settles a payment", () => {
  assertEquals(classifySession({ metadata: { payment_id: ROW }, payment_status: "paid", payment_intent: "pi" }, ROW, undefined, "payment_id").kind, "paid");
  assertEquals(classifySession({ metadata: { purchase_id: ROW }, payment_status: "paid" }, ROW, undefined, "payment_id").kind, "mismatch");
});

Deno.test("settlePayment: paid → wallet_settle_payment on the row's account; expired → release; no session past the TTL → failed", async () => {
  const calls: Array<{ path: string; opts?: Record<string, unknown> }> = [];
  const stripe: StripeCall = (_m, path, _p, opts) => {
    calls.push({ path, opts: opts as Record<string, unknown> });
    return Promise.resolve({ metadata: { payment_id: ROW }, payment_status: "paid", payment_intent: "pi_1" });
  };
  const fake = fakeAdmin({ rpc: () => ({ data: { ok: true, outcome: "paid" } }) });
  const payment = { id: ROW, stripe_checkout_session_id: "cs_1", stripe_account_id: "acct_place", created_at: new Date(T0).toISOString() };
  assertEquals(await settlePayment(fake.client, stripe, payment, T0 + 1000), "paid");
  assertEquals(calls[0], { path: "checkout/sessions/cs_1", opts: { stripeAccount: "acct_place", signal: undefined } });
  assertEquals(fake.rpcs, [{ name: "wallet_settle_payment", args: { p_payment_id: ROW, p_payment_intent: "pi_1" } }]);

  const expired: StripeCall = () => Promise.resolve({ metadata: { payment_id: ROW }, status: "expired", payment_status: "unpaid" });
  const fake2 = fakeAdmin({});
  assertEquals(await settlePayment(fake2.client, expired, payment, T0), "expired");
  assertEquals(fake2.rpcs[0].name, "wallet_release_payment");

  const fake3 = fakeAdmin({});
  const noSession = { ...payment, stripe_checkout_session_id: null };
  assertEquals(await settlePayment(fake3.client, stripe, noSession, T0 + 1000), "pending");
  assertEquals(await settlePayment(fake3.client, stripe, noSession, T0 + (WALLET_CHECKOUT_TTL_SEC + 1) * 1000), "expired");
  assertEquals(fake3.rpcs, [{ name: "wallet_release_payment", args: { p_payment_id: ROW, p_status: "failed", p_error: "no_session" } }]);
});
