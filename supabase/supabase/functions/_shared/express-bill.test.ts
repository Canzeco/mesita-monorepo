// MESITA-4386 (money): Apple Pay / Google Pay on Pay Bill. The card part's
// express PaymentIntent is a MANUAL-CAPTURE hold the browser confirms with
// Face ID / Google; the server never confirms it and never cancels one still
// waiting for the wallet on a replay. Once held, the bill's signing window
// starts and the wallet is recorded; the waiter's code captures it like a
// held card; expiry cancels the hold and gives the credit back; a decline
// after Face ID releases the row at once (a bill has no retry on the same
// hold). The body gate keeps express to the guest's own bill.

import { assert, assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { type CardRow, isExpressStep, pollTabCard, runTabCard } from "./tab-card.ts";
import { captureHeldCard, PI_TTL_MS, settleByPaymentIntent } from "./settle-payment.ts";
import { readGuestPayBody, readSplitBody } from "./tab.ts";
import type { StripeCall } from "./stripe.ts";

const PAY = "55555555-5555-4555-8555-555555555555";
const NOW = Date.parse("2026-11-18T21:00:00Z");

type Rpc = { fn: string; args: Record<string, unknown> };

function card(over: Partial<CardRow> = {}): CardRow {
  return {
    id: PAY,
    status: "opening",
    stripe_account_id: "acct_place",
    stripe_payment_intent_id: null,
    card_cents: 50000,
    tip_cents: 5000,
    created_at: new Date(NOW).toISOString(),
    held_at: null,
    pay_source: "express",
    pay_with: "express",
    ...over,
  };
}

/** The rpc seam plus the one table read/write tab-card makes. */
function fakeAdmin(initial: CardRow, answers: Record<string, unknown> = {}) {
  let row = { ...initial };
  const rpcs: Rpc[] = [];
  const updates: Record<string, unknown>[] = [];
  const admin = {
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpcs.push({ fn, args });
      if (fn === "wallet_open_payment_pi") row = { ...row, status: "open", stripe_payment_intent_id: String(args.p_payment_intent) };
      if (fn === "wallet_release_payment") row = { ...row, status: String(args.p_status) };
      const data = fn in answers ? answers[fn] : { ok: true, outcome: "paid", decision: "keep" };
      return Promise.resolve({ data, error: null });
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { ...row }, error: null }) }) }),
      update: (v: Record<string, unknown>) => {
        const filters: Array<[string, unknown]> = [];
        const chain = {
          eq: (k: string, val: unknown) => {
            filters.push([k, val]);
            return chain;
          },
          then: (resolve: (r: { error: null }) => void) => {
            const r = row as unknown as Record<string, unknown>;
            if (filters.every(([k, val]) => r[k] === val)) {
              updates.push(v);
              row = { ...row, ...v } as CardRow;
            }
            resolve({ error: null });
          },
        };
        return chain;
      },
    }),
  } as unknown as SupabaseClient;
  return { admin, rpcs, updates, get: () => row };
}

type Call = { method: string; path: string; params?: Record<string, unknown>; opts?: Record<string, unknown> };
function fakeStripe(answer: (c: Call) => Record<string, unknown>) {
  const calls: Call[] = [];
  const stripe: StripeCall = (method, path, params, opts) => {
    const c = { method, path, params, opts: opts as Record<string, unknown> | undefined };
    calls.push(c);
    try {
      return Promise.resolve(answer(c));
    } catch (err) {
      return Promise.reject(err);
    }
  };
  return { stripe, calls };
}

const ARGS = {
  paymentId: PAY,
  currency: "mxn",
  placeId: "p",
  placeName: "Orinoco",
  consumerId: "c",
  tabId: "tab-1",
  publishableKey: "pk_test_abc",
  hold: true,
  nowMs: NOW,
};

const applePay = { id: "ch_1", payment_method_details: { card: { wallet: { type: "apple_pay" } } } };

Deno.test("express bill opens ONE manual-capture hold: no payment method, no clone, no confirm; secret answered", async () => {
  const a = fakeAdmin(card());
  const { stripe, calls } = fakeStripe(() => ({ id: "pi_h", status: "requires_payment_method", client_secret: "pi_h_secret", amount: 55000 }));
  const res = await runTabCard(a.admin, stripe, ARGS);
  assert(res.ok);
  assertEquals(res.step, {
    status: "requires_payment_method",
    express: true,
    payment_intent_id: "pi_h",
    client_secret: "pi_h_secret",
    stripe_account: "acct_place",
    publishable_key: "pk_test_abc",
    amount_cents: 55000,
  });
  assert(isExpressStep(res.step));
  assertEquals(calls.map((c) => `${c.method} ${c.path}`), ["POST payment_intents"]);
  const create = calls[0].params!;
  assertEquals(create.amount, 55000);
  assertEquals(create.capture_method, "manual");
  assertEquals("payment_method" in create, false);
  assertEquals("confirm" in create, false);
  assertEquals(create.payment_method_types, ["card"]);
  assertEquals((create.metadata as Record<string, unknown>).mesita_pay_with, "express");
  assertEquals((create.metadata as Record<string, unknown>).payment_id, PAY);
  assertEquals(calls[0].opts?.idempotencyKey, `tabexpress-pi:${PAY}`);
  assertEquals(a.rpcs.map((r) => r.fn), ["wallet_open_payment_pi"]);
});

Deno.test("replay before Face ID keeps the hold: the same secret, no cancel, no release", async () => {
  const a = fakeAdmin(card({ status: "open", stripe_payment_intent_id: "pi_h" }));
  const { stripe, calls } = fakeStripe(() => ({ id: "pi_h", status: "requires_payment_method", client_secret: "pi_h_secret", amount: 55000 }));
  const res = await runTabCard(a.admin, stripe, { ...ARGS, nowMs: NOW + 60_000 });
  assert(res.ok && res.step.status === "requires_payment_method");
  assertEquals(res.step.client_secret, "pi_h_secret");
  assertEquals(calls.map((c) => c.method), ["GET"]);
  assertEquals(a.rpcs, []);
  assertEquals(a.get().status, "open");
});

Deno.test("after Face ID the hold lands: the wallet is recorded and the bill's signing window starts", async () => {
  const a = fakeAdmin(card({ status: "open", stripe_payment_intent_id: "pi_h" }));
  const { stripe, calls } = fakeStripe(() => ({ id: "pi_h", status: "requires_capture", latest_charge: applePay }));
  const res = await runTabCard(a.admin, stripe, ARGS);
  assert(res.ok);
  assertEquals(res.step, { status: "held", payment_intent_id: "pi_h" });
  assertEquals(a.updates, [{ pay_with: "apple_pay" }]);
  assertEquals(a.rpcs.map((r) => r.fn), ["wallet_card_held"]);
  assertEquals(a.rpcs[0].args.p_window, "60 minutes");
  assert(calls.every((c) => !c.path.endsWith("/capture") && !c.path.endsWith("/cancel")));
});

Deno.test("a decline after Face ID cancels the hold and gives the credit back at once", async () => {
  const a = fakeAdmin(card({ status: "open", stripe_payment_intent_id: "pi_h" }));
  const { stripe, calls } = fakeStripe((c) =>
    c.path.endsWith("/cancel")
      ? { id: "pi_h", status: "canceled" }
      : { id: "pi_h", status: "requires_payment_method", client_secret: "s", last_payment_error: { code: "card_declined", decline_code: "insufficient_funds" } }
  );
  const res = await runTabCard(a.admin, stripe, ARGS);
  assert(!res.ok);
  assertEquals(res.code, "card_declined");
  assertEquals(calls.map((c) => `${c.method} ${c.path}`), ["GET payment_intents/pi_h", "POST payment_intents/pi_h/cancel"]);
  assertEquals(a.rpcs.map((r) => [r.fn, r.args.p_status]), [["wallet_release_payment", "failed"]]);
});

Deno.test("never confirmed past ten minutes: the poll's settle cancels FIRST, then gives the credit back", async () => {
  const a = fakeAdmin(card({ status: "open", stripe_payment_intent_id: "pi_h" }));
  const { stripe, calls } = fakeStripe((c) =>
    c.path.endsWith("/cancel") ? { id: "pi_h", status: "canceled" } : { id: "pi_h", status: "requires_payment_method", metadata: { payment_id: PAY } }
  );
  const polled = await pollTabCard(a.admin, stripe, a.get(), "pk_test_abc", NOW + PI_TTL_MS + 1);
  assertEquals(polled, { step: null, refusal: null });
  assertEquals(calls.map((c) => `${c.method} ${c.path}`), ["GET payment_intents/pi_h", "POST payment_intents/pi_h/cancel"]);
  assertEquals(a.rpcs.map((r) => r.fn), ["wallet_release_payment"]);
});

Deno.test("the poll before Face ID answers the express step, never a bank check, and cancels nothing", async () => {
  const a = fakeAdmin(card({ status: "open", stripe_payment_intent_id: "pi_h" }));
  const { stripe, calls } = fakeStripe(() => ({ id: "pi_h", status: "requires_payment_method", client_secret: "pi_h_secret", amount: 55000 }));
  const polled = await pollTabCard(a.admin, stripe, a.get(), "pk_test_abc", NOW + 30_000);
  assert(polled.step && isExpressStep(polled.step));
  assertEquals(calls.length, 1);
  assertEquals(a.rpcs, []);
});

Deno.test("a held express part whose wallet was never written learns it on the next poll", async () => {
  const a = fakeAdmin(card({ status: "open", stripe_payment_intent_id: "pi_h", held_at: new Date(NOW).toISOString() }));
  const { stripe, calls } = fakeStripe((c) =>
    c.params?.expand ? { id: "pi_h", status: "requires_capture", latest_charge: { payment_method_details: { card: { wallet: { type: "google_pay" } } } } } : { id: "pi_h", status: "requires_capture", metadata: { payment_id: PAY } }
  );
  await pollTabCard(a.admin, stripe, a.get(), "pk_test_abc", NOW + 5 * 60_000);
  assertEquals(a.get().pay_with, "google_pay");
  assertEquals(calls[0].params, { expand: ["latest_charge"] });
  assert(calls.every((c) => !c.path.endsWith("/cancel") && !c.path.endsWith("/capture")));
});

Deno.test("the waiter's code captures an express hold like a held card: one keyed capture, then the spend", async () => {
  const rpcs: Rpc[] = [];
  const admin = { rpc: (fn: string, args: Record<string, unknown>) => (rpcs.push({ fn, args }), Promise.resolve({ data: { ok: true, outcome: "paid" }, error: null })) };
  const { stripe, calls } = fakeStripe(() => ({ id: "pi_h", status: "succeeded" }));
  const out = await captureHeldCard(admin as unknown as Pick<SupabaseClient, "rpc">, stripe, { tabId: "tab-1", paymentId: PAY, paymentIntent: "pi_h", account: "acct_place" });
  assertEquals(out, "paid");
  assertEquals(calls.map((c) => [c.path, c.opts?.idempotencyKey]), [["payment_intents/pi_h/capture", "tabcap:tab-1"]]);
  assertEquals(rpcs.map((r) => r.fn), ["wallet_settle_payment"]);
});

Deno.test("the bill expired unsigned: the held express hold is let go and the credit comes back", async () => {
  const rpcs: Rpc[] = [];
  const answers: Record<string, unknown> = {
    wallet_card_held: { ok: true, decision: "cancel", tab_id: "tab-1" },
    wallet_released_holds: [{ id: PAY, stripe_payment_intent_id: "pi_h", stripe_account_id: "acct_place" }],
    wallet_hold_cancelled: null,
  };
  const admin = { rpc: (fn: string, args: Record<string, unknown>) => (rpcs.push({ fn, args }), Promise.resolve({ data: fn in answers ? answers[fn] : { ok: true }, error: null })) };
  const { stripe, calls } = fakeStripe((c) => (c.path.endsWith("/cancel") ? { id: "pi_h", status: "canceled" } : { id: "pi_h", status: "requires_capture", metadata: { payment_id: PAY } }));
  const out = await settleByPaymentIntent(admin as unknown as Pick<SupabaseClient, "rpc">, stripe, {
    id: PAY,
    stripe_checkout_session_id: null,
    stripe_account_id: "acct_place",
    stripe_payment_intent_id: "pi_h",
    created_at: new Date(NOW).toISOString(),
  }, NOW + 61 * 60_000);
  assertEquals(out, "expired");
  assertEquals(rpcs.map((r) => r.fn), ["wallet_card_held", "wallet_release_payment", "wallet_released_holds", "wallet_hold_cancelled"]);
  assertEquals(calls.filter((c) => c.path.endsWith("/cancel")).map((c) => c.opts?.idempotencyKey), [`tabcancel:${PAY}`]);
});

Deno.test("a saved-card part never takes the express path (old rows read card)", async () => {
  const a = fakeAdmin(card({ pay_source: undefined, pay_with: undefined }));
  const { stripe, calls } = fakeStripe((c) =>
    c.path === "payment_methods" ? { id: "pm_clone" } : c.path.endsWith("/confirm") ? { id: "pi_c", status: "requires_capture" } : { id: "pi_c", status: "requires_confirmation" }
  );
  const res = await runTabCard(a.admin, stripe, { ...ARGS, customer: "cus_g", platformPm: "pm_platform1" });
  assert(res.ok);
  assertEquals(calls.map((c) => c.path), ["payment_methods", "payment_intents", "payment_intents/pi_c/confirm"]);
  assertEquals(a.updates, []);
});

const BILL = { place_id: "11111111-1111-4111-8111-111111111111", request_id: "22222222-2222-4222-8222-222222222222", bill_cents: 50000, credit_cents: 0, cash_bill_cents: 0, cash_tip_cents: 0, card_bill_cents: 50000, card_tip_cents: 5000 };

Deno.test("body: express pays the card part with no saved card; with card_pm_id, or with no card part, it is 400 field express", () => {
  const ok = readGuestPayBody({ ...BILL, express: true });
  assert(ok.ok);
  assertEquals([ok.input.express, ok.input.cardPmId], [true, null]);
  const both = readGuestPayBody({ ...BILL, express: true, card_pm_id: "pm_abcdefgh12" });
  assert(!both.ok);
  assertEquals([both.status, both.code, both.detail?.field], [400, "bad_body", "express"]);
  const noCard = readGuestPayBody({ ...BILL, card_bill_cents: 0, card_tip_cents: 0, cash_bill_cents: 50000, express: true });
  assert(!noCard.ok);
  assertEquals(noCard.code, "bad_body");
  // Without express the saved card is still required.
  const neither = readGuestPayBody(BILL);
  assert(!neither.ok);
  assertEquals(neither.code, "card_required");
  // The waiter's tab split takes no express.
  const split = readSplitBody({ ...BILL, tab_id: BILL.place_id, bill_version: 1, express: true });
  assert(!split.ok);
  assertEquals(split.code, "bad_body");
});
