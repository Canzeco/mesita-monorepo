// MESITA-4538: the Monitor lists never hand a place a guest's email, and the
// payouts read answers a missing account or a Stripe failure instead of
// failing the page (money surfaces; MVP test rule: money, auth, data loss).
import { assertEquals } from "jsr:@std/assert@1";
import { maskMonitorRow, payoutBank, readPayouts } from "./monitor.ts";
import { StripeError, type StripeCall } from "./stripe.ts";

Deno.test("a list row never carries an email", () => {
  const row = maskMonitorRow({
    id: "r1",
    customer: "a".repeat(32),
    other_customer: "b".repeat(32),
    guest_name: null,
    guest_email: "pato@example.com",
    other_name: "Ana",
    other_email: "ana@example.com",
  });
  assertEquals(row.guest, "pa•••");
  assertEquals(row.other, "Ana");
  assertEquals(JSON.stringify(row).includes("@"), false);
});

Deno.test("a deleted guest has no name", () => {
  const row = maskMonitorRow({ id: "r1", customer: null, guest_name: "Gone", guest_email: "x@y.z" });
  assertEquals(row.guest, null);
});

Deno.test("no connected account answers no_account without calling Stripe", async () => {
  let called = false;
  const stripe: StripeCall = () => {
    called = true;
    return Promise.resolve({});
  };
  assertEquals(await readPayouts(stripe, null, null), { state: "no_account" });
  assertEquals(called, false);
});

Deno.test("a Stripe failure answers stripe_error", async () => {
  const stripe: StripeCall = () => Promise.reject(new StripeError("payouts", "api_error", "", 500, "down"));
  assertEquals(await readPayouts(stripe, "acct_1", null), { state: "stripe_error" });
});

Deno.test("payouts read on the connected account with the bank expanded", async () => {
  let seen: { params?: Record<string, unknown>; account?: string } = {};
  const stripe: StripeCall = (_m, _p, params, opts) => {
    seen = { params, account: opts?.stripeAccount };
    return Promise.resolve({
      has_more: true,
      data: [{ id: "po_1", amount: 18066, currency: "mxn", status: "in_transit", arrival_date: 1795300000, destination: { bank_name: "STRIPE TEST BANK", last4: "7897" } }],
    });
  };
  const r = await readPayouts(stripe, "acct_1", null);
  assertEquals(seen.account, "acct_1");
  assertEquals(seen.params?.expand, ["data.destination"]);
  assertEquals(r.state === "ok" && r.payouts[0].bank, "STRIPE TEST BANK ••7897");
  assertEquals(r.state === "ok" && r.next, "po_1");
  assertEquals(payoutBank(null), null);
});
