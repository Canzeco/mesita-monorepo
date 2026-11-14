// MESITA-3856 (money): a guest's card is held until the waiter signs.
// captureHeldCard captures once per bill (idempotency key tabcap:<tab>) and
// settles (wallet_settle_payment also finishes the signature) only when Stripe says succeeded; a card
// error ends the bill and lets the hold go; an unanswered capture is
// Confirming and moves nothing. cancelReleasedHolds cancels each ended
// bill's hold once (tabcancel:<row>) and stamps it; a Stripe outage leaves it
// for the next call. A held PaymentIntent read by the cron follows the bill.

import { assertEquals } from "jsr:@std/assert@1";
import { cancelReleasedHolds, captureHeldCard, settleByPaymentIntent } from "./settle-payment.ts";
import { type StripeCall, StripeError } from "./stripe.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

type Rpc = { fn: string; args: Record<string, unknown> };

function fakeAdmin(answers: Record<string, unknown> = {}) {
  const rpcs: Rpc[] = [];
  const admin = {
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpcs.push({ fn, args });
      const data = fn in answers ? answers[fn] : { ok: true, outcome: "paid" };
      return Promise.resolve({ data, error: null });
    },
  };
  return { admin: admin as unknown as Pick<SupabaseClient, "rpc">, rpcs };
}

function fakeStripe(handler: (method: string, path: string, opts?: Record<string, unknown>) => Record<string, unknown>) {
  const calls: Array<{ method: string; path: string; opts?: Record<string, unknown> }> = [];
  const stripe: StripeCall = (method, path, _params, opts) => {
    calls.push({ method, path, opts: opts as Record<string, unknown> | undefined });
    try {
      return Promise.resolve(handler(method, path, opts as Record<string, unknown> | undefined));
    } catch (err) {
      return Promise.reject(err);
    }
  };
  return { stripe, calls };
}

const hold = { tabId: "tab-1", paymentId: "pay-1", paymentIntent: "pi_1", account: "acct_1" };

Deno.test("capture succeeds: one keyed capture, then settle and finish the signature", async () => {
  const { admin, rpcs } = fakeAdmin();
  const { stripe, calls } = fakeStripe(() => ({ id: "pi_1", status: "succeeded" }));
  assertEquals(await captureHeldCard(admin, stripe, hold), "paid");
  assertEquals(calls.map((c) => c.path), ["payment_intents/pi_1/capture"]);
  assertEquals(calls[0].opts?.idempotencyKey, "tabcap:tab-1");
  assertEquals(rpcs.map((r) => r.fn), ["wallet_settle_payment"]);
});

Deno.test("a card error at capture ends the bill and lets the hold go, nothing settles", async () => {
  const { admin, rpcs } = fakeAdmin({ wallet_released_holds: [{ id: "pay-1", stripe_payment_intent_id: "pi_1", stripe_account_id: "acct_1" }] });
  const { stripe } = fakeStripe((method, path) => {
    if (path.endsWith("/capture")) throw new StripeError(path, "card_error", "card_declined", 402, "declined");
    if (method === "GET") return { id: "pi_1", status: "requires_payment_method" };
    return { id: "pi_1", status: "canceled" };
  });
  assertEquals(await captureHeldCard(admin, stripe, hold), "failed");
  const fns = rpcs.map((r) => r.fn);
  assertEquals(fns.includes("wallet_settle_payment"), false);
  assertEquals(fns.slice(0, 2), ["pay_tab_capture_failed", "wallet_released_holds"]);
  assertEquals(fns.includes("wallet_hold_cancelled"), true);
});

Deno.test("an unanswered capture is Confirming and moves nothing", async () => {
  const { admin, rpcs } = fakeAdmin();
  const { stripe } = fakeStripe(() => {
    throw new Error("network down");
  });
  assertEquals(await captureHeldCard(admin, stripe, hold), "confirming");
  assertEquals(rpcs.length, 0);
});

Deno.test("cancelReleasedHolds: one keyed cancel per ended hold, stamped; an outage leaves it", async () => {
  const rows = [
    { id: "pay-1", stripe_payment_intent_id: "pi_1", stripe_account_id: "acct_1" },
    { id: "pay-2", stripe_payment_intent_id: "pi_2", stripe_account_id: "acct_1" },
  ];
  const { admin, rpcs } = fakeAdmin({ wallet_released_holds: rows, wallet_hold_cancelled: null });
  const { stripe, calls } = fakeStripe((_m, path) => {
    if (path.includes("pi_2")) throw new Error("stripe down");
    return { id: "pi_1", status: "canceled" };
  });
  assertEquals(await cancelReleasedHolds(admin, stripe, null), 1);
  assertEquals(calls[0].opts?.idempotencyKey, "tabcancel:pay-1");
  assertEquals(rpcs.filter((r) => r.fn === "wallet_hold_cancelled").map((r) => r.args.p_payment_id), ["pay-1"]);
});

Deno.test("an already-cancelled hold (Stripe 400) is stamped, not retried forever", async () => {
  const { admin, rpcs } = fakeAdmin({ wallet_released_holds: [{ id: "pay-1", stripe_payment_intent_id: "pi_1", stripe_account_id: "acct_1" }] });
  const { stripe } = fakeStripe((_m, path) => {
    throw new StripeError(path, "invalid_request_error", "payment_intent_unexpected_state", 400, "already canceled");
  });
  assertEquals(await cancelReleasedHolds(admin, stripe, "tab-1"), 1);
  assertEquals(rpcs.some((r) => r.fn === "wallet_hold_cancelled"), true);
});

const openRow = {
  id: "pay-1",
  stripe_checkout_session_id: null,
  stripe_account_id: "acct_1",
  stripe_payment_intent_id: "pi_1",
  created_at: new Date(Date.now() - 60 * 60_000).toISOString(),
};

Deno.test("the cron keeps a held card the bill still waits on, even past PI_TTL", async () => {
  const { admin } = fakeAdmin({ wallet_card_held: { ok: true, decision: "keep", tab_id: "tab-1" } });
  const { stripe, calls } = fakeStripe(() => ({ id: "pi_1", status: "requires_capture", metadata: { payment_id: "pay-1" } }));
  assertEquals(await settleByPaymentIntent(admin, stripe, openRow, Date.now()), "pending");
  assertEquals(calls.filter((c) => c.method === "POST").length, 0);
});

Deno.test("the cron lets go of a held card whose bill ended", async () => {
  const { admin, rpcs } = fakeAdmin({
    wallet_card_held: { ok: true, decision: "cancel", tab_id: "tab-1" },
    wallet_release_payment: { ok: true },
    wallet_released_holds: [{ id: "pay-1", stripe_payment_intent_id: "pi_1", stripe_account_id: "acct_1" }],
  });
  const { stripe, calls } = fakeStripe((method) => method === "GET" ? { id: "pi_1", status: "requires_capture", metadata: { payment_id: "pay-1" } } : { status: "canceled" });
  assertEquals(await settleByPaymentIntent(admin, stripe, openRow, Date.now()), "expired");
  assertEquals(rpcs.some((r) => r.fn === "wallet_release_payment"), true);
  assertEquals(calls.some((c) => c.path === "payment_intents/pi_1/cancel"), true);
});

Deno.test("the cron finishes a signature whose capture went unanswered", async () => {
  const { admin, rpcs } = fakeAdmin({ wallet_card_held: { ok: true, decision: "capture", tab_id: "tab-1" } });
  const { stripe, calls } = fakeStripe((method) => method === "GET" ? { id: "pi_1", status: "requires_capture", metadata: { payment_id: "pay-1" } } : { id: "pi_1", status: "succeeded" });
  assertEquals(await settleByPaymentIntent(admin, stripe, openRow, Date.now()), "paid");
  assertEquals(calls.find((c) => c.path.endsWith("/capture"))?.opts?.idempotencyKey, "tabcap:tab-1");
  assertEquals(rpcs.some((r) => r.fn === "wallet_settle_payment"), true);
});
