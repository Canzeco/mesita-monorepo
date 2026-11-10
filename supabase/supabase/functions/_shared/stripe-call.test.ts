// MESITA-3302 — the Stripe client sends the connected account and the abort
// signal only when asked. Money: a call that lands on the wrong account is
// a charge on the wrong merchant, so the header is pinned both ways.

import { assertEquals } from "jsr:@std/assert@1";
import { stripeClient } from "./stripe.ts";

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
