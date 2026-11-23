// MESITA-3302 — the Stripe client sends the connected account and the abort
// signal only when asked. Money: a call that lands on the wrong account is
// a charge on the wrong merchant, so the header is pinned both ways.

import { assertEquals } from "jsr:@std/assert@1";
import { paymentsPublishableKey, stripeClient } from "./stripe.ts";

function capture() {
  const seen: Array<{ url: string; init: RequestInit }> = [];
  const fetchFn = ((url: string, init: RequestInit) => {
    seen.push({ url, init });
    return Promise.resolve(new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } }));
  }) as unknown as typeof fetch;
  return { seen, stripe: stripeClient("sk_test_x", fetchFn) };
}

Deno.test("Stripe-Account and the signal ride only the call that names them", async () => {
  const { seen, stripe } = capture();
  const signal = new AbortController().signal;
  await stripe("GET", "checkout/sessions/cs_1", undefined, { stripeAccount: "acct_place", signal });
  await stripe("POST", "refunds", { payment_intent: "pi_1" }, { idempotencyKey: "attempt-1" });
  const h0 = seen[0].init.headers as Record<string, string>;
  const h1 = seen[1].init.headers as Record<string, string>;
  assertEquals(h0["Stripe-Account"], "acct_place");
  assertEquals(seen[0].init.signal, signal);
  assertEquals("Stripe-Account" in h1, false);
  assertEquals(seen[1].init.signal, undefined);
  assertEquals(h1["Idempotency-Key"], "attempt-1");
});

// Moved from tab-card.test.ts (MESITA-4708): the voucher's Apple Pay / Google
// Pay button reads the same key.
Deno.test("the publishable key must match the mode", () => {
  const env = (m: Record<string, string>) => (k: string) => m[k];
  assertEquals(paymentsPublishableKey(false, env({ STRIPE_PUBLISHABLE_KEY_TEST: "pk_test_1" })), "pk_test_1");
  assertEquals(paymentsPublishableKey(false, env({ STRIPE_PUBLISHABLE_KEY_TEST: "pk_live_1" })), null);
  assertEquals(paymentsPublishableKey(true, env({ STRIPE_PUBLISHABLE_KEY_LIVE: "pk_live_1" })), "pk_live_1");
  assertEquals(paymentsPublishableKey(false, env({})), null);
});
