// MESITA-3307 (W3): money guards under the MVP test rule. The owner never
// sees a guest's email; an operator refund carries the attempt id as the
// Idempotency-Key and the place's account as Stripe-Account, so a retry
// never refunds twice and the money leaves the right account; a credit-only
// refund never calls Stripe; a close-out never refunds more cash than the
// unspent credit stands for.

import { assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { StripeCall } from "./boost.ts";
import { maskGuest, type PaymentRow, planCloseOut, type PurchaseRow, refundPayment, refundPurchase, splitPaymentRefund } from "./money-admin.ts";

Deno.test("maskGuest: the name when set, else two characters of the email's local part, never the email", () => {
  assertEquals(maskGuest("Ana Ruiz", "ana@example.com"), "Ana Ruiz");
  assertEquals(maskGuest("  ", "maria.lopez@example.com"), "ma•••");
  assertEquals(maskGuest(null, null), "Guest");
  assertEquals(maskGuest(null, "x@y.z"), "x•••");
});

type Call = { fn: string; args: Record<string, unknown> };

function fakeAdmin(calls: Call[]): SupabaseClient {
  let n = 0;
  return {
    from(table: string) {
      return {
        insert(row: Record<string, unknown>) {
          calls.push({ fn: `insert:${table}`, args: row });
          const id = `att-${++n}`;
          return { select: () => ({ single: () => Promise.resolve({ data: { id }, error: null }) }) };
        },
        update(patch: Record<string, unknown>) {
          calls.push({ fn: `update:${table}`, args: patch });
          return { eq: () => Promise.resolve({ error: null }) };
        },
      };
    },
    rpc(fn: string, args: Record<string, unknown>) {
      calls.push({ fn, args });
      return Promise.resolve({ data: { ok: true, status: "refunded" }, error: null });
    },
    // deno-lint-ignore no-explicit-any
  } as any as SupabaseClient;
}

const PURCHASE: PurchaseRow = {
  id: "pu-1", consumer_id: "c-1", place_id: "pl-1", amount_cents: 20000, bonus_cents: 2000, refunded_cents: 0,
  application_fee_cents: 1000, fee_collected: "application_fee", stripe_account_id: "acct_place", stripe_payment_intent_id: "pi_1", voucher: "voucher_200",
  story_activated_at: null, status: "paid", paid_at: "2026-11-01T00:00:00Z", livemode: false, currency: "mxn",
  created_at: "2026-11-01T00:00:00Z",
};

Deno.test("refundPurchase: one Stripe refund keyed by the attempt, on the place's account, fee returned", async () => {
  const calls: Call[] = [];
  const seen: { params?: Record<string, unknown>; opts?: Record<string, unknown> }[] = [];
  const stripe: StripeCall = (_m, _p, params, opts) => {
    seen.push({ params, opts });
    return Promise.resolve({ id: "re_1" });
  };
  const r = await refundPurchase({ admin: fakeAdmin(calls), stripe, actor: "op" }, PURCHASE, 5000);
  assertEquals(r.ok, true);
  assertEquals(seen.length, 1);
  assertEquals(seen[0].opts?.idempotencyKey, "att-1");
  assertEquals(seen[0].opts?.stripeAccount, "acct_place");
  assertEquals(seen[0].params?.refund_application_fee, true);
  assertEquals(seen[0].params?.amount, 5000);
  const ledger = calls.find((c) => c.fn === "wallet_refund_purchase");
  assertEquals(ledger?.args, { p_purchase_id: "pu-1", p_amount_refunded: 5000 });
});

Deno.test("refundPurchase: a billed-fee charge (MESITA-3461) asks Stripe for no application fee refund", async () => {
  const calls: Call[] = [];
  const seen: Record<string, unknown>[] = [];
  const stripe: StripeCall = (_m, _p, params) => {
    seen.push(params ?? {});
    return Promise.resolve({ id: "re_2" });
  };
  const r = await refundPurchase({ admin: fakeAdmin(calls), stripe, actor: "op" }, { ...PURCHASE, fee_collected: "invoice" });
  assertEquals(r.ok, true);
  assertEquals("refund_application_fee" in seen[0], false);
  assertEquals(calls.some((c) => c.fn === "wallet_note_fee_refund"), false);
});

Deno.test("refundPayment: a credit-only payment makes no Stripe call and goes through wallet_refund_credit", async () => {
  const calls: Call[] = [];
  let stripeCalls = 0;
  const stripe: StripeCall = () => {
    stripeCalls++;
    return Promise.resolve({});
  };
  const row: PaymentRow = {
    id: "py-1", consumer_id: "c-1", place_id: "pl-1", credit_cents: 10000, card_cents: 0, tip_cents: 0, refunded_cents: 0,
    credit_refunded_cents: 0, application_fee_cents: 0, fee_collected: "invoice", stripe_account_id: null, stripe_payment_intent_id: null,
    status: "paid", paid_at: "2026-11-01T00:00:00Z", livemode: false,
  };
  const r = await refundPayment({ admin: fakeAdmin(calls), stripe, actor: "op" }, row);
  assertEquals(r.ok, true);
  assertEquals(stripeCalls, 0);
  assertEquals(calls.map((c) => c.fn), ["insert:wallet_refund_attempts", "wallet_refund_credit"]);
});

Deno.test("splitPaymentRefund: card + tip first, then credit", () => {
  const row = { card_cents: 10000, tip_cents: 2000, credit_cents: 5000, refunded_cents: 0, credit_refunded_cents: 0 } as PaymentRow;
  assertEquals(splitPaymentRefund(row), { card: 12000, credit: 5000 });
  assertEquals(splitPaymentRefund(row, 13000), { card: 12000, credit: 1000 });
  assertEquals(splitPaymentRefund(row, 99999), { card: 12000, credit: 5000 });
});

Deno.test("planCloseOut: two purchases and a half-spent balance refund newest first, capped by what is unspent", () => {
  // MX$200 (+20 bonus) then MX$1,000 (+200 bonus): MX$1,420 of credit, half
  // spent leaves MX$710 unspent.
  const purchases = [
    { id: "old", amount_cents: 20000, bonus_cents: 2000, refunded_cents: 0, voucher: "voucher_200", story_activated_at: null, created_at: "2026-11-01T00:00:00Z" },
    { id: "new", amount_cents: 100000, bonus_cents: 20000, refunded_cents: 0, voucher: "voucher_1000", story_activated_at: null, created_at: "2026-11-02T00:00:00Z" },
  ];
  const plan = planCloseOut(purchases, 71000);
  // Newest first: floor(71000 × 1000 / 1200) = 59166, which takes back
  // 59166 + 11833 = 70999 of credit; the 1 centavo left buys nothing older.
  assertEquals(plan, [{ id: "new", amount: 59166 }]);
  // Nothing unspent: nothing refunded.
  assertEquals(planCloseOut(purchases, 0), []);
  // All unspent: every purchase back in full.
  assertEquals(planCloseOut(purchases, 142000), [{ id: "new", amount: 100000 }, { id: "old", amount: 20000 }]);
});
