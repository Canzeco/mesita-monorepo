// MESITA-4524 (money): every guest pay ticket ends, and never "Not paid"
// while money may move. The waiter's capture is keyed attempt-capture:<id>;
// succeeded settles then closes; a refusal read back as not charged
// releases declined; anything unanswered stays charging. Ending a ticket
// cancels its hold and releases only on a not-charged read-back; a hold that
// succeeded meanwhile closes as paid; an unknown answer leaves it pending.
// A ticket reads as a guest bill to the screens (attemptAsTab).

import { assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { type AttemptRow, attemptAsTab, captureAttemptHold, endAttempt, phaseOf } from "./guest-attempt.ts";
import { type StripeCall, StripeError } from "./stripe.ts";

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
  return { admin: admin as unknown as SupabaseClient, rpcs };
}

function fakeStripe(handler: (method: string, path: string) => Record<string, unknown>) {
  const calls: Array<{ method: string; path: string; key?: unknown }> = [];
  const stripe: StripeCall = (method, path, _params, opts) => {
    calls.push({ method, path, key: (opts as Record<string, unknown> | undefined)?.idempotencyKey });
    try {
      return Promise.resolve(handler(method, path));
    } catch (err) {
      return Promise.reject(err);
    }
  };
  return { stripe, calls };
}

const hold = { attemptId: "att-1", paymentId: "pay-1", paymentIntent: "pi_1", account: "acct_1" };

Deno.test("capture succeeded: one keyed capture, the settle spends, then the ticket closes", async () => {
  const { admin, rpcs } = fakeAdmin({ pay_guest_close: { ok: true, outcome: "closed", tab_id: "tab-1" } });
  const { stripe, calls } = fakeStripe(() => ({ id: "pi_1", status: "succeeded" }));
  assertEquals(await captureAttemptHold(admin, stripe, hold), "paid");
  assertEquals(calls.map((c) => [c.path, c.key]), [["payment_intents/pi_1/capture", "attempt-capture:att-1"]]);
  assertEquals(rpcs.map((r) => r.fn), ["wallet_settle_payment", "pay_guest_close"]);
});

Deno.test("capture refused and read back not charged: released declined, nothing settles", async () => {
  const { admin, rpcs } = fakeAdmin({ pay_guest_finish_release: { ok: true, outcome: "released", end_reason: "declined" } });
  const { stripe } = fakeStripe((method, path) => {
    if (path.endsWith("/capture")) throw new StripeError(path, "card_error", "card_declined", 402, "declined");
    return { id: "pi_1", status: method === "GET" ? "requires_payment_method" : "canceled" };
  });
  assertEquals(await captureAttemptHold(admin, stripe, hold), "declined");
  assertEquals(rpcs.map((r) => [r.fn, r.args.p_reason]), [["pay_guest_finish_release", "declined"]]);
});

Deno.test("capture unanswered (5xx) or processing: stays charging, nothing written", async () => {
  for (const handler of [
    (_m: string, path: string) => {
      throw new StripeError(path, "api_error", "", 500, "down");
    },
    () => ({ id: "pi_1", status: "processing" }),
  ]) {
    const { admin, rpcs } = fakeAdmin();
    const { stripe } = fakeStripe(handler);
    assertEquals(await captureAttemptHold(admin, stripe, hold), "confirming");
    assertEquals(rpcs.length, 0);
  }
});

Deno.test("a capture refused but still requires_capture is not a decline: stays charging", async () => {
  const { admin, rpcs } = fakeAdmin();
  const { stripe } = fakeStripe((method, path) => {
    if (path.endsWith("/capture")) throw new StripeError(path, "invalid_request_error", "", 400, "busy");
    return { id: "pi_1", status: "requires_capture" };
  });
  assertEquals(await captureAttemptHold(admin, stripe, hold), "confirming");
  assertEquals(rpcs.length, 0);
});

const claimed = (extra: Record<string, unknown> = {}) => ({
  ok: true,
  outcome: "claimed",
  ending_reason: "cancelled",
  payment_id: "pay-1",
  payment_intent: "pi_1",
  stripe_account_id: "acct_1",
  ...extra,
});

Deno.test("end: the hold is cancelled with its key and read back, then released", async () => {
  const { admin, rpcs } = fakeAdmin({ pay_guest_claim_end: claimed(), pay_guest_finish_release: { ok: true, outcome: "released" } });
  const { stripe, calls } = fakeStripe(() => ({ id: "pi_1", status: "canceled" }));
  const out = await endAttempt(admin, stripe, "att-1", "cancelled", { consumerId: "c-1", source: "test" });
  assertEquals(out, { ok: true, outcome: "released", endReason: "cancelled" });
  assertEquals(calls.map((c) => [c.method, c.key]), [["POST", "attempt-cancel:att-1"]]);
  assertEquals(rpcs.map((r) => r.fn), ["pay_guest_claim_end", "pay_guest_finish_release"]);
});

Deno.test("end: a hold that succeeded meanwhile is never Not paid; it settles and closes", async () => {
  const { admin, rpcs } = fakeAdmin({ pay_guest_claim_end: claimed(), pay_guest_close: { ok: true, outcome: "closed" } });
  const { stripe } = fakeStripe((method, path) => {
    if (method === "POST") throw new StripeError(path, "invalid_request_error", "", 400, "already succeeded");
    return { id: "pi_1", status: "succeeded" };
  });
  const out = await endAttempt(admin, stripe, "att-1", "expired", { source: "sweep" });
  assertEquals(out.ok, false);
  assertEquals(rpcs.map((r) => r.fn), ["pay_guest_claim_end", "wallet_settle_payment", "pay_guest_close"]);
});

Deno.test("end: an unknown Stripe answer leaves the ticket for the next sweep", async () => {
  const { admin, rpcs } = fakeAdmin({ pay_guest_claim_end: claimed() });
  const { stripe } = fakeStripe((_m, path) => {
    throw new StripeError(path, "api_error", "", 503, "down");
  });
  const out = await endAttempt(admin, stripe, "att-1", "expired", { source: "sweep" });
  assertEquals(out, { ok: false, code: "pending" });
  assertEquals(rpcs.map((r) => r.fn), ["pay_guest_claim_end"]);
});

Deno.test("end: once the waiter confirmed, Cancel is refused and Stripe is never called", async () => {
  const { admin } = fakeAdmin({ pay_guest_claim_end: { ok: false, code: "charging" } });
  const { stripe, calls } = fakeStripe(() => ({}));
  const out = await endAttempt(admin, stripe, "att-1", "cancelled", { consumerId: "c-1", source: "test" });
  assertEquals(out.ok, false);
  assertEquals(calls.length, 0);
});

Deno.test("end: cash and credits hold no PaymentIntent and release without Stripe", async () => {
  const { admin, rpcs } = fakeAdmin({
    pay_guest_claim_end: claimed({ payment_intent: null, stripe_account_id: null, ending_reason: "rejected" }),
    pay_guest_finish_release: { ok: true, outcome: "released" },
  });
  const { stripe, calls } = fakeStripe(() => ({}));
  const out = await endAttempt(admin, stripe, "att-1", "rejected", { placeId: "p-1", source: "test" });
  assertEquals(out, { ok: true, outcome: "released", endReason: "rejected" });
  assertEquals(calls.length, 0);
  assertEquals(rpcs[1].args.p_reason, "rejected");
});

const attempt = (over: Partial<AttemptRow> = {}): AttemptRow => ({
  id: "att-1",
  consumer_id: "c-1",
  place_id: "p-1",
  request_id: "r-1",
  bill_cents: 10000,
  tip_cents: 1000,
  credit_cents: 2000,
  cash_cents: 0,
  card_cents: 9000,
  currency: "mxn",
  livemode: false,
  tender: "card",
  status: "opening",
  payment_id: "pay-1",
  tab_id: null,
  token_hash: "a".repeat(64),
  prev_token_hash: null,
  prev_token_until: null,
  expires_at: "2026-11-21T12:15:00Z",
  created_at: "2026-11-21T12:00:00Z",
  end_reason: null,
  held_at: null,
  charging_at: null,
  ending_at: null,
  ending_reason: null,
  needs_review_at: null,
  ...over,
});

Deno.test("phases: placing_hold, live, charging, closed, released", () => {
  assertEquals(phaseOf(attempt()), "placing_hold");
  assertEquals(phaseOf(attempt({ held_at: "x" })), "live");
  assertEquals(phaseOf(attempt({ held_at: "x", charging_at: "y" })), "charging");
  assertEquals(phaseOf(attempt({ status: "closed" })), "closed");
  assertEquals(phaseOf(attempt({ status: "released", end_reason: "expired" })), "released");
});

Deno.test("a ticket reads as a guest bill: its money split, Confirming while charging, Not paid with why", () => {
  const live = attemptAsTab(attempt({ held_at: "x" }));
  assertEquals([live.status, live.origin, live.card_bill_cents, live.card_tip_cents, live.credit_cents], ["paying", "guest", 8000, 1000, 2000]);
  assertEquals(attemptAsTab(attempt({ held_at: "x", charging_at: "2026-11-21T12:05:00Z" })).signing_at, "2026-11-21T12:05:00Z");
  const declined = attemptAsTab(attempt({ status: "released", end_reason: "declined" }));
  assertEquals([declined.status, declined.end_reason, declined.signing_at], ["cancelled", "capture_failed", null]);
  assertEquals(attemptAsTab(attempt({ status: "released", end_reason: "expired" })).status, "expired");
  const cash = attemptAsTab(attempt({ tender: "cash", cash_cents: 9000, card_cents: 0 }));
  assertEquals([cash.cash_bill_cents, cash.cash_tip_cents, cash.card_bill_cents], [8000, 1000, 0]);
});
