// MESITA-3097 / MESITA-3302 — the money rules of the Wallet: which Checkout
// answer credits a balance, that a purchase is read on its own connected
// account, and how entries sum into Available and Pending.

import { assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { StripeCall } from "./boost.ts";
import { balancesOf, classifySession, type OpenPurchase, settlePurchase } from "./wallet.ts";

const PURCHASE = "00000000-0000-4000-8000-0000000a3097";

Deno.test("classifySession: only a paid session of THIS purchase credits", () => {
  const meta = { purchase_id: PURCHASE };
  assertEquals(classifySession({ metadata: meta, payment_status: "paid", payment_intent: "pi_1" }, PURCHASE), {
    kind: "paid",
    paymentIntent: "pi_1",
  });
  assertEquals(classifySession({ metadata: { purchase_id: "other" }, payment_status: "paid" }, PURCHASE).kind, "mismatch");
  assertEquals(classifySession({ metadata: meta, status: "open", payment_status: "unpaid" }, PURCHASE).kind, "pending");
  assertEquals(classifySession({ metadata: meta, status: "complete", payment_status: "unpaid" }, PURCHASE).kind, "pending");
  assertEquals(classifySession({ metadata: meta, status: "expired", payment_status: "unpaid" }, PURCHASE).kind, "expired");
});

Deno.test("settlePurchase reads the session on the purchase's connected account and credits with its available_at", async () => {
  const calls: Array<{ path: string; opts?: Record<string, unknown> }> = [];
  const stripe: StripeCall = (_m, path, _p, opts) => {
    calls.push({ path, opts: opts as Record<string, unknown> });
    return Promise.resolve({ metadata: { purchase_id: PURCHASE }, payment_status: "paid", payment_intent: "pi_1" });
  };
  const rpcs: Array<{ name: string; args: Record<string, unknown> }> = [];
  const admin = {
    rpc: (name: string, args: Record<string, unknown>) => {
      rpcs.push({ name, args });
      return Promise.resolve({ data: { ok: true, outcome: "credited" }, error: null });
    },
  } as unknown as SupabaseClient;
  const purchase: OpenPurchase = {
    id: PURCHASE,
    stripe_checkout_session_id: "cs_1",
    stripe_account_id: "acct_place",
    created_at: "2026-11-07T00:00:00Z",
    available_at: "2026-11-07T01:00:00Z",
  };
  const signal = new AbortController().signal;
  assertEquals(await settlePurchase(admin, stripe, purchase, Date.parse("2026-11-07T00:05:00Z"), { signal }), "credited");
  assertEquals(calls.length, 1);
  assertEquals(calls[0].path, "checkout/sessions/cs_1");
  assertEquals(calls[0].opts?.stripeAccount, "acct_place");
  assertEquals(calls[0].opts?.signal, signal);
  assertEquals(rpcs, [{
    name: "wallet_credit_purchase",
    args: { p_purchase_id: PURCHASE, p_payment_intent: "pi_1", p_available_at: "2026-11-07T01:00:00Z" },
  }]);
});

Deno.test("balancesOf: one balance per place, newest first, Pending split from Available", () => {
  const now = Date.parse("2026-11-07T12:00:00Z");
  const b = balancesOf([
    { place_id: "a", kind: "voucher", amount_cents: 20000, currency: "mxn", created_at: "2026-11-07T10:00:00Z", available_at: "2026-11-07T11:00:00Z" },
    { place_id: "b", kind: "voucher", amount_cents: 50000, currency: "mxn", created_at: "2026-11-07T11:30:00Z", available_at: "2026-11-07T12:30:00Z" },
    { place_id: "a", kind: "bonus", amount_cents: 2000, currency: "mxn", created_at: "2026-11-07T10:00:00Z", available_at: "2026-11-07T11:00:00Z" },
    { place_id: "a", kind: "spend", amount_cents: -5000, currency: "mxn", created_at: "2026-11-07T11:45:00Z" },
  ], now);
  // Newest activity first: the spend at 11:45 puts "a" ahead of "b" (11:30).
  assertEquals(b.map((x) => [x.place_id, x.balance_cents, x.available_cents, x.pending_cents]), [
    ["a", 17000, 17000, 0],
    ["b", 50000, 0, 50000],
  ]);
  assertEquals(b[0].entries.map((e) => [e.amount_cents, e.pending]), [[-5000, false], [20000, false], [2000, false]]);
  assertEquals(b[1].entries[0].pending, true);
});
