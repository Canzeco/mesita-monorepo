// MESITA-3097 / MESITA-3302 — the money rules of the Wallet: which Checkout
// answer credits a balance, that a purchase is read on its own connected
// account, and how entries sum into Available and Pending.

import { assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { StripeCall } from "./boost.ts";
import { availableAtFor, balancesOf, classifySession, type OpenPurchase, settleAll, settlePurchase } from "./wallet.ts";

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
  // MESITA-3549: a pending entry says when it turns Available; an Available one does not.
  assertEquals(b[1].entries[0].available_at, "2026-11-07T12:30:00Z");
  assertEquals(b[0].entries.map((e) => e.available_at), [null, null, null]);
});

Deno.test("settleAll: a Stripe that never answers is cut by the budget; the read goes on and names what is still open", async () => {
  // Three open purchases. The first credits; the second hangs until the
  // budget aborts its fetch; the third is never asked. The RPC runs only for
  // the first.
  let hung = 0;
  const stripe: StripeCall = (_m, path, _p, opts) => {
    if (path === "checkout/sessions/cs_ok") {
      return Promise.resolve({ metadata: { purchase_id: "p_ok" }, payment_status: "paid", payment_intent: "pi_ok" });
    }
    hung++;
    return new Promise((_resolve, reject) => {
      opts?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    });
  };
  const rpcs: string[] = [];
  const admin = {
    rpc: (name: string, args: Record<string, unknown>) => {
      rpcs.push(`${name}:${args.p_purchase_id}:${args.p_available_at}`);
      return Promise.resolve({ data: { ok: true, outcome: "credited" }, error: null });
    },
  } as unknown as SupabaseClient;
  const now = Date.parse("2026-11-07T00:05:00Z");
  const mk = (id: string, cs: string): OpenPurchase => ({
    id,
    stripe_checkout_session_id: cs,
    stripe_account_id: "acct_place",
    created_at: "2026-11-07T00:00:00Z",
    voucher: "voucher_200",
  });
  const { outcomes, settling } = await settleAll(
    admin,
    stripe,
    [mk("p_ok", "cs_ok"), mk("p_slow", "cs_slow"), mk("p_next", "cs_next")],
    now,
    50,
  );
  assertEquals(outcomes.get("p_ok"), "credited");
  assertEquals(outcomes.get("p_slow"), "pending");
  assertEquals(outcomes.get("p_next"), "pending");
  assertEquals(settling, ["p_slow", "p_next"]);
  assertEquals(hung, 1);
  // An open voucher turns Available an hour after the charge.
  assertEquals(rpcs, ["wallet_credit_purchase:p_ok:2026-11-07T01:05:00.000Z"]);
  // Every voucher waits the hour except Story (MESITA-3323).
  assertEquals(availableAtFor("voucher_welcome", now), "2026-11-07T01:05:00.000Z");
  assertEquals(availableAtFor("voucher_story", now), null);
  assertEquals(availableAtFor(null, now), null);
});

Deno.test("balancesOf: spendable comes from SQL by (place, currency); unnamed reads 0", () => {
  const now = Date.parse("2026-11-07T12:00:00Z");
  const b = balancesOf([
    { place_id: "a", kind: "voucher", amount_cents: 20000, currency: "mxn", created_at: "2026-11-07T10:00:00Z" },
    { place_id: "a", kind: "spend", amount_cents: -5000, currency: "mxn", created_at: "2026-11-07T11:00:00Z", payment_id: "p1" },
    { place_id: "b", kind: "voucher", amount_cents: 9000, currency: "mxn", created_at: "2026-11-07T09:00:00Z" },
  ], now, new Map([["a:mxn", 12000], ["b:usd", 9000]]));
  assertEquals(b.map((x) => [x.place_id, x.available_cents, x.spendable_cents]), [["a", 15000, 12000], ["b", 9000, 0]]);
  assertEquals(b[0].entries.map((e) => e.payment_id), ["p1", null]);
});

Deno.test("balancesOf: confirmed_by rides a cashback with a payment only (MESITA-3554)", () => {
  const b = balancesOf([
    { place_id: "a", kind: "cashback", amount_cents: 200, currency: "mxn", created_at: "2026-11-09T10:03:00Z", payment_id: "p1", confirmed_by: "waiter" },
    { place_id: "a", kind: "cashback", amount_cents: 100, currency: "mxn", created_at: "2026-11-09T10:02:00Z", confirmed_by: "waiter" },
    { place_id: "a", kind: "spend", amount_cents: -3000, currency: "mxn", created_at: "2026-11-09T10:01:00Z", payment_id: "p1", confirmed_by: "waiter" },
  ]);
  assertEquals(b[0].entries.map((e) => e.confirmed_by), ["waiter", null, null]);
});
