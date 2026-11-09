// MESITA-3461 — fee billing: money, so pinned under the MVP test rule.

import { assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { StripeCall } from "./boost.ts";
import {
  FEE_DAYS_UNTIL_DUE,
  FEE_MIN_CENTS,
  FEE_PERIOD_DAYS,
  FEE_THRESHOLD_CENTS,
  feeInvoiceParams,
  feeStatusOf,
  feeView,
  invoiceSetArgs,
  issueFeeInvoice,
} from "./fee-billing.ts";

Deno.test("the schedule: MX$500 or weekly, Stripe's MX$10 minimum, seven days to pay", () => {
  assertEquals(FEE_THRESHOLD_CENTS, 50_000);
  assertEquals(FEE_PERIOD_DAYS, 7);
  assertEquals(FEE_MIN_CENTS, 1_000);
  assertEquals(FEE_DAYS_UNTIL_DUE, 7);
});

Deno.test("the invoice is sent (never charged automatically) and sweeps no stray items", () => {
  const p = feeInvoiceParams({ rowId: "inv-1", placeId: "pl-1", customer: "cus_1" });
  assertEquals(p.collection_method, "send_invoice");
  assertEquals(p.pending_invoice_items_behavior, "exclude");
  assertEquals((p.metadata as Record<string, string>).fee_invoice_id, "inv-1");
});

Deno.test("invoiceSetArgs: Stripe's state as the RPC takes it", () => {
  const a = invoiceSetArgs("inv-1", {
    id: "in_1",
    status: "paid",
    customer: "cus_1",
    hosted_invoice_url: "https://invoice.stripe.com/i/x",
    due_date: 1_800_000_000,
    status_transitions: { paid_at: 1_800_000_100 },
  });
  assertEquals(a.p_status, "paid");
  assertEquals(a.p_stripe_invoice_id, "in_1");
  assertEquals(a.p_due_at, new Date(1_800_000_000_000).toISOString());
  assertEquals(a.p_paid_at, new Date(1_800_000_100_000).toISOString());
  assertEquals(feeStatusOf({ status: "weird" }), "open");
});

function fakeAdmin(rpcs: Array<{ name: string; args: Record<string, unknown> }>): SupabaseClient {
  return {
    rpc: (name: string, args: Record<string, unknown>) => {
      rpcs.push({ name, args });
      return Promise.resolve({ data: { ok: true, fee_hold: false, changed: false, place_id: "pl-1" }, error: null });
    },
    // deno-lint-ignore no-explicit-any
  } as any as SupabaseClient;
}

Deno.test("issueFeeInvoice: every Stripe call keyed by the draft's id, finalized, stored open", async () => {
  const rpcs: Array<{ name: string; args: Record<string, unknown> }> = [];
  const calls: Array<{ path: string; key?: string; account?: string }> = [];
  const stripe: StripeCall = (_m, path, _p, opts) => {
    calls.push({ path, key: opts?.idempotencyKey, account: opts?.stripeAccount });
    if (path === "invoices") return Promise.resolve({ id: "in_1", status: "draft" });
    if (path === "invoices/in_1/finalize") return Promise.resolve({ id: "in_1", status: "open", hosted_invoice_url: "https://x", due_date: 1_800_000_000 });
    return Promise.resolve({ id: "ii_1" });
  };
  const status = await issueFeeInvoice(fakeAdmin(rpcs), stripe, { id: "inv-1", place_id: "pl-1", amount_cents: 2_500, currency: "mxn" }, "cus_1");
  assertEquals(status, "open");
  assertEquals(calls.map((c) => c.path), ["invoices", "invoiceitems", "invoices/in_1/finalize"]);
  assertEquals(calls.map((c) => c.key), ["place-fee-invoice:inv-1", "place-fee-item:inv-1", "place-fee-finalize:inv-1"]);
  // On Mesita's own account, never the place's.
  assertEquals(calls.every((c) => c.account === undefined), true);
  assertEquals(rpcs[0].name, "place_fee_invoice_set");
  assertEquals(rpcs[0].args.p_status, "open");
  assertEquals(rpcs[0].args.p_url, "https://x");
});

Deno.test("issueFeeInvoice: a Stripe failure leaves the draft to retry", async () => {
  const rpcs: Array<{ name: string; args: Record<string, unknown> }> = [];
  const stripe: StripeCall = () => Promise.reject(new Error("down"));
  const status = await issueFeeInvoice(fakeAdmin(rpcs), stripe, { id: "inv-2", place_id: "pl-1", amount_cents: 2_500, currency: "mxn" }, "cus_1");
  assertEquals(status, "draft");
  assertEquals(rpcs[0].args.p_status, "draft");
});

Deno.test("feeView: the overdue invoice first, with its page", () => {
  const now = Date.parse("2026-11-20T00:00:00Z");
  const v = feeView(true, [
    { status: "open", amount_cents: 900, currency: "mxn", due_at: "2026-11-30T00:00:00Z", hosted_invoice_url: "https://new", created_at: "2026-11-16T00:00:00Z" },
    { status: "open", amount_cents: 700, currency: "mxn", due_at: "2026-11-15T00:00:00Z", hosted_invoice_url: "https://old", created_at: "2026-11-08T00:00:00Z" },
  ], now);
  assertEquals(v.hold, true);
  assertEquals(v.invoice?.url, "https://old");
  assertEquals(v.invoice?.overdue, true);
  assertEquals(feeView(false, [], now), { hold: false, invoice: null });
});
