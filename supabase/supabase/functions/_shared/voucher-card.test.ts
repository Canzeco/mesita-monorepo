// MESITA-3552 (money): a voucher bought with a saved card. One purchase row →
// one clone, one PaymentIntent, one confirm, each keyed by the purchase id
// (a double tap is one charge); the PI is stored before it is confirmed; no
// application fee; the Checkout's metadata; a decline cancels the PI and
// fails the row with no credit; a replay only reads; the settle paths credit
// by PI, and a PI left unfinished is cancelled before the row is released.

import { assert, assertEquals } from "jsr:@std/assert@1";
import { type PurchaseCardRow, type PurchaseStore, settlePurchaseByPaymentIntent } from "./purchase-pi.ts";
import { ownCard } from "./tab-card.ts";
import { runVoucherCard } from "./voucher-card.ts";
import { type StripeCall, StripeError } from "./stripe.ts";

type Call = { method: string; path: string; params?: Record<string, unknown>; opts?: Record<string, unknown> };

const PURCHASE = "22222222-2222-4222-8222-222222222222";
const NOW = Date.parse("2026-11-09T20:00:00Z");

function row(over: Partial<PurchaseCardRow> = {}): PurchaseCardRow {
  return {
    id: PURCHASE,
    status: "opening",
    consumer_id: "c",
    place_id: "p",
    voucher: "voucher_1000",
    amount_cents: 100000,
    bonus_cents: 20000,
    stripe_account_id: "acct_place",
    stripe_checkout_session_id: null,
    stripe_payment_intent_id: null,
    created_at: new Date(NOW).toISOString(),
    ...over,
  };
}

/** The lead and (MESITA-3841) a basket's followers. A follower's log lines
 *  carry its id after an @; the lead's read as before. */
function fakeStore(initial: PurchaseCardRow, followers: PurchaseCardRow[] = []) {
  const rows = new Map<string, PurchaseCardRow>([[initial.id, { ...initial }], ...followers.map((f) => [f.id, { ...f, basket_lead_id: initial.id }] as const)]);
  const log: string[] = [];
  const tag = (id: string) => (id === initial.id ? "" : `@${id}`);
  const store: PurchaseStore = {
    read: (id) => Promise.resolve(rows.has(id) ? { ...rows.get(id)! } : null),
    followers: (leadId) => Promise.resolve([...rows.values()].filter((r) => r.basket_lead_id === leadId).map((r) => ({ ...r }))),
    openPi: (id, pi) => {
      log.push(`openPi:${pi}`);
      const mine = [...rows.values()].filter((r) => r.id === id || r.basket_lead_id === id);
      for (const r of mine) {
        if (r.status === "opening" && !r.stripe_payment_intent_id) rows.set(r.id, { ...r, status: "open", stripe_payment_intent_id: pi });
      }
      return Promise.resolve(mine.every((r) => rows.get(r.id)!.stripe_payment_intent_id === pi));
    },
    release: (id, code) => {
      log.push(`release${tag(id)}:${code}`);
      const r = rows.get(id)!;
      if (r.status === "opening" || r.status === "open") rows.set(id, { ...r, status: "failed" });
      return Promise.resolve();
    },
    credit: (id, pi, at) => {
      log.push(`credit${tag(id)}:${pi}:${at}`);
      const r = rows.get(id)!;
      const already = r.status === "paid";
      rows.set(id, { ...r, status: "paid", stripe_payment_intent_id: pi });
      return Promise.resolve(already ? "already_paid" : "credited");
    },
  };
  return { store, log, now: () => rows.get(initial.id)!, row: (id: string) => rows.get(id)! };
}

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
  purchaseId: PURCHASE,
  customer: "cus_guest",
  platformPm: "pm_platform123",
  currency: "mxn",
  placeId: "p",
  placeName: "Cuerno",
  consumerId: "c",
  voucher: "voucher_1000" as const,
  publishableKey: "pk_test_abc",
  nowMs: NOW,
};

Deno.test("voucher card: clone, create unconfirmed, store, confirm — keyed by the purchase; no fee; the Checkout's metadata; credited", async () => {
  const s = fakeStore(row());
  const { stripe, calls } = fakeStripe((c) => {
    if (c.path === "payment_methods") return { id: "pm_cloned" };
    if (c.path === "payment_intents") return { id: "pi_1", status: "requires_confirmation" };
    return { id: "pi_1", status: "succeeded" };
  });
  const res = await runVoucherCard(s.store, stripe, ARGS);
  assert(res.ok);
  assertEquals(res.purchase_id, PURCHASE);
  assertEquals(res.card, { status: "succeeded", payment_intent_id: "pi_1" });
  assertEquals(calls.map((c) => c.path), ["payment_methods", "payment_intents", "payment_intents/pi_1/confirm"]);
  assertEquals(calls.map((c) => c.opts?.idempotencyKey), [
    `vouchercard-clone:${PURCHASE}`,
    `vouchercard-pi:${PURCHASE}`,
    `vouchercard-confirm:${PURCHASE}`,
  ]);
  assert(calls.every((c) => c.opts?.stripeAccount === "acct_place"));
  assertEquals(calls[0].params, { customer: "cus_guest", payment_method: "pm_platform123" });
  const create = calls[1].params!;
  assertEquals(create.amount, 100000);
  assertEquals(create.payment_method, "pm_cloned");
  assertEquals(create.payment_method_types, ["card"]);
  assertEquals("application_fee_amount" in create, false);
  assertEquals("confirm" in create, false);
  assertEquals(create.metadata, {
    mesita_kind: "wallet_voucher",
    purchase_id: PURCHASE,
    place_id: "p",
    consumer_id: "c",
    voucher: "voucher_1000",
    amount_cents: "100000",
    bonus_cents: "20000",
  });
  assertEquals(calls[2].params, { use_stripe_sdk: true });
  // Stored before confirmed; credited once with the voucher's hour.
  assertEquals(s.log, ["openPi:pi_1", `credit:pi_1:${new Date(NOW + 3600_000).toISOString()}`]);
});

Deno.test("voucher card: a decline cancels the PI and fails the row; nothing is credited", async () => {
  const s = fakeStore(row());
  const { stripe, calls } = fakeStripe((c) => {
    if (c.path === "payment_methods") return { id: "pm_cloned" };
    if (c.path === "payment_intents") return { id: "pi_2", status: "requires_confirmation" };
    if (c.path.endsWith("/confirm")) throw new StripeError(c.path, "card_error", "card_declined", 402, "Your card was declined.");
    if (c.path.endsWith("/cancel")) return { id: "pi_2", status: "canceled" };
    return { id: "pi_2", status: "requires_payment_method", last_payment_error: { code: "card_declined", decline_code: "generic_decline" } };
  });
  const res = await runVoucherCard(s.store, stripe, ARGS);
  assert(!res.ok);
  assertEquals(res.code, "card_declined");
  assertEquals(res.detail, { decline_code: "generic_decline" });
  assertEquals(s.log, ["openPi:pi_2", "release:card_declined:generic_decline"]);
  assertEquals(s.now().status, "failed");
  const cancel = calls.find((c) => c.path === "payment_intents/pi_2/cancel");
  assertEquals(cancel?.opts?.idempotencyKey, `vouchercard-cancel:${PURCHASE}:pi_2`);
});

Deno.test("voucher card: 3-D Secure hands Stripe.js the secret and the account; without a publishable key it cancels and releases", async () => {
  const answer = (c: Call) => {
    if (c.path === "payment_methods") return { id: "pm_cloned" };
    if (c.path === "payment_intents") return { id: "pi_3", status: "requires_confirmation" };
    if (c.path.endsWith("/cancel")) return { id: "pi_3", status: "canceled" };
    return { id: "pi_3", status: "requires_action", client_secret: "pi_3_secret_x" };
  };
  const a = fakeStore(row());
  const ok = await runVoucherCard(a.store, fakeStripe(answer).stripe, ARGS);
  assert(ok.ok);
  assertEquals(ok.card, { status: "requires_action", payment_intent_id: "pi_3", client_secret: "pi_3_secret_x", stripe_account: "acct_place", publishable_key: "pk_test_abc" });
  assertEquals(a.log, ["openPi:pi_3"]);

  const b = fakeStore(row());
  const no = await runVoucherCard(b.store, fakeStripe(answer).stripe, { ...ARGS, publishableKey: null });
  assert(!no.ok);
  assertEquals(no.code, "card_needs_auth");
  assertEquals(b.log, ["openPi:pi_3", "release:needs_auth_unavailable"]);
});

Deno.test("voucher card: a double tap (the same row again) only reads its PI: no second clone, PI or confirm", async () => {
  const s = fakeStore(row({ status: "open", stripe_payment_intent_id: "pi_4" }));
  const { stripe, calls } = fakeStripe(() => ({ id: "pi_4", status: "succeeded" }));
  const res = await runVoucherCard(s.store, stripe, ARGS);
  assert(res.ok);
  assertEquals(res.card.status, "succeeded");
  assertEquals(calls.map((c) => `${c.method} ${c.path}`), ["GET payment_intents/pi_4"]);

  const paid = fakeStore(row({ status: "paid", stripe_payment_intent_id: "pi_4" }));
  const none = fakeStripe(() => {
    throw new Error("no stripe call expected");
  });
  const again = await runVoucherCard(paid.store, none.stripe, ARGS);
  assert(again.ok);
  assertEquals(none.calls.length, 0);
});

Deno.test("voucher card: the twin request still talking to Stripe answers in_progress and never releases the row", async () => {
  const s = fakeStore(row());
  const { stripe } = fakeStripe((c) => {
    if (c.path === "payment_methods") throw new StripeError(c.path, "idempotency_error", "idempotency_key_in_use", 409, "in use");
    return {};
  });
  const res = await runVoucherCard(s.store, stripe, ARGS);
  assert(!res.ok);
  assertEquals(res.code, "in_progress");
  assertEquals(s.log, []);
});

Deno.test("voucher card: a PI the row cannot name is cancelled and the row released", async () => {
  const s = fakeStore(row());
  s.store.openPi = () => Promise.resolve(false);
  const { stripe, calls } = fakeStripe((c) => {
    if (c.path === "payment_methods") return { id: "pm_cloned" };
    if (c.path === "payment_intents") return { id: "pi_5", status: "requires_confirmation" };
    return { id: "pi_5", status: "canceled" };
  });
  const res = await runVoucherCard(s.store, stripe, ARGS);
  assert(!res.ok);
  assertEquals(res.code, "card_failed");
  assertEquals(calls.some((c) => c.path.endsWith("/confirm")), false);
  assertEquals(s.log, ["release:pi_write"]);
});

Deno.test("own card: a card on another customer, a missing card or no customer is refused", async () => {
  const { stripe } = fakeStripe((c) => {
    if (c.path === "payment_methods/pm_mine") return { id: "pm_mine", customer: "cus_guest", type: "card" };
    if (c.path === "payment_methods/pm_theirs") return { id: "pm_theirs", customer: "cus_other", type: "card" };
    throw new StripeError(c.path, "invalid_request_error", "resource_missing", 404, "No such payment_method");
  });
  assertEquals(await ownCard(stripe, "cus_guest", "pm_mine"), true);
  assertEquals(await ownCard(stripe, "cus_guest", "pm_theirs"), false);
  assertEquals(await ownCard(stripe, "cus_guest", "pm_missing"), false);
  assertEquals(await ownCard(stripe, null, "pm_mine"), false);
});

// ── Settling by PaymentIntent (the cron and the Wallet read) ───────────────

const OPEN = { id: PURCHASE, stripe_account_id: "acct_place", stripe_payment_intent_id: "pi_6", available_at: null };

Deno.test("settle by PI: succeeded credits once; canceled fails the row", async () => {
  const s = fakeStore(row({ status: "open", stripe_payment_intent_id: "pi_6" }));
  const ok = fakeStripe(() => ({ id: "pi_6", status: "succeeded", metadata: { mesita_kind: "wallet_voucher", purchase_id: PURCHASE } }));
  assertEquals(await settlePurchaseByPaymentIntent(s.store, ok.stripe, { ...OPEN, created_at: new Date(NOW).toISOString() }, NOW), "credited");
  assertEquals(await settlePurchaseByPaymentIntent(s.store, ok.stripe, { ...OPEN, created_at: new Date(NOW).toISOString() }, NOW), "already_paid");

  const c = fakeStore(row({ status: "open", stripe_payment_intent_id: "pi_6" }));
  const gone = fakeStripe(() => ({ id: "pi_6", status: "canceled" }));
  assertEquals(await settlePurchaseByPaymentIntent(c.store, gone.stripe, { ...OPEN, created_at: new Date(NOW).toISOString() }, NOW), "expired");
  assertEquals(c.log, ["release:pi_canceled"]);
});

Deno.test("settle by PI: unfinished waits ten minutes, then cancels FIRST; a PI that succeeded meanwhile is credited, never failed", async () => {
  const fresh = fakeStore(row({ status: "open", stripe_payment_intent_id: "pi_7" }));
  const waiting = fakeStripe(() => ({ id: "pi_7", status: "requires_action" }));
  assertEquals(await settlePurchaseByPaymentIntent(fresh.store, waiting.stripe, { ...OPEN, stripe_payment_intent_id: "pi_7", created_at: new Date(NOW - 60_000).toISOString() }, NOW), "pending");
  assertEquals(waiting.calls.length, 1);

  const stale = fakeStore(row({ status: "open", stripe_payment_intent_id: "pi_7" }));
  const cancels = fakeStripe((c) => c.path.endsWith("/cancel") ? { id: "pi_7", status: "canceled" } : { id: "pi_7", status: "requires_action" });
  assertEquals(await settlePurchaseByPaymentIntent(stale.store, cancels.stripe, { ...OPEN, stripe_payment_intent_id: "pi_7", created_at: new Date(NOW - 11 * 60_000).toISOString() }, NOW), "expired");
  assertEquals(cancels.calls.map((c) => c.path), ["payment_intents/pi_7", "payment_intents/pi_7/cancel"]);
  assertEquals(cancels.calls[1].opts?.idempotencyKey, `vouchercard-cancel:${PURCHASE}:pi_7`);
  assertEquals(stale.log, ["release:pi_canceled"]);

  const raced = fakeStore(row({ status: "open", stripe_payment_intent_id: "pi_7" }));
  let reads = 0;
  const won = fakeStripe((c) => {
    if (c.path.endsWith("/cancel")) throw new StripeError(c.path, "invalid_request_error", "payment_intent_unexpected_state", 400, "succeeded");
    reads += 1;
    return { id: "pi_7", status: reads === 1 ? "requires_action" : "succeeded" };
  });
  assertEquals(await settlePurchaseByPaymentIntent(raced.store, won.stripe, { ...OPEN, stripe_payment_intent_id: "pi_7", created_at: new Date(NOW - 11 * 60_000).toISOString() }, NOW), "credited");
  assertEquals(raced.log, ["credit:pi_7:null"]);
});

Deno.test("settle by PI: a PI whose metadata names another purchase is a mismatch, nothing written", async () => {
  const s = fakeStore(row({ status: "open", stripe_payment_intent_id: "pi_8" }));
  const other = fakeStripe(() => ({ id: "pi_8", status: "succeeded", metadata: { purchase_id: "someone-else" } }));
  assertEquals(await settlePurchaseByPaymentIntent(s.store, other.stripe, { ...OPEN, stripe_payment_intent_id: "pi_8", created_at: new Date(NOW).toISOString() }, NOW), "mismatch");
  assertEquals(s.log, []);
});

// ── A basket (MESITA-3841): several rows, one PaymentIntent ────────────────

const F1 = "33333333-3333-4333-8333-333333333333";
const F2 = "44444444-4444-4444-8444-444444444444";
/** 1× Big (the lead) + 2× Small: three rows. */
function basket(status = "opening", pi: string | null = null) {
  return fakeStore(row({ status, stripe_payment_intent_id: pi }), [
    row({ id: F1, voucher: "voucher_200", amount_cents: 10000, bonus_cents: 1000, status, stripe_payment_intent_id: pi }),
    row({ id: F2, voucher: "voucher_200", amount_cents: 10000, bonus_cents: 1000, status, stripe_payment_intent_id: pi }),
  ]);
}

Deno.test("basket: three rows, ONE PaymentIntent for the sum, stored on every row; succeeded credits all three", async () => {
  const s = basket();
  const { stripe, calls } = fakeStripe((c) => {
    if (c.path === "payment_methods") return { id: "pm_cloned" };
    if (c.path === "payment_intents") return { id: "pi_b", status: "requires_confirmation" };
    return { id: "pi_b", status: "succeeded" };
  });
  const res = await runVoucherCard(s.store, stripe, ARGS);
  assert(res.ok);
  assertEquals(res.purchase_id, PURCHASE);
  assertEquals(calls.map((c) => c.path), ["payment_methods", "payment_intents", "payment_intents/pi_b/confirm"]);
  const create = calls[1].params!;
  assertEquals(create.amount, 120000);
  const meta = create.metadata as Record<string, string>;
  assertEquals(meta.purchase_id, PURCHASE);
  assertEquals(meta.basket, "3");
  assertEquals(meta.amount_cents, "120000");
  assertEquals(meta.bonus_cents, "22000");
  assertEquals(meta.basket_items, "voucher_1000x1,voucher_200x2");
  const hour = new Date(NOW + 3600_000).toISOString();
  assertEquals(s.log, ["openPi:pi_b", `credit:pi_b:${hour}`, `credit@${F1}:pi_b:${hour}`, `credit@${F2}:pi_b:${hour}`]);
  assertEquals([s.row(PURCHASE), s.row(F1), s.row(F2)].map((r) => [r.status, r.stripe_payment_intent_id]), [
    ["paid", "pi_b"],
    ["paid", "pi_b"],
    ["paid", "pi_b"],
  ]);
});

Deno.test("basket: a decline releases all three rows; nothing is credited", async () => {
  const s = basket();
  const { stripe } = fakeStripe((c) => {
    if (c.path === "payment_methods") return { id: "pm_cloned" };
    if (c.path === "payment_intents") return { id: "pi_d", status: "requires_confirmation" };
    if (c.path.endsWith("/confirm")) throw new StripeError(c.path, "card_error", "card_declined", 402, "declined");
    if (c.path.endsWith("/cancel")) return { id: "pi_d", status: "canceled" };
    return { id: "pi_d", status: "requires_payment_method", last_payment_error: { decline_code: "generic_decline" } };
  });
  const res = await runVoucherCard(s.store, stripe, ARGS);
  assert(!res.ok);
  assertEquals(res.code, "card_declined");
  assertEquals(s.log.filter((l) => l.startsWith("credit")), []);
  assertEquals([s.row(PURCHASE), s.row(F1), s.row(F2)].map((r) => r.status), ["failed", "failed", "failed"]);
});

Deno.test("basket: the same tap again on a canceled PI releases all three rows", async () => {
  const s = basket("open", "pi_c");
  const { stripe } = fakeStripe(() => ({ id: "pi_c", status: "canceled" }));
  const res = await runVoucherCard(s.store, stripe, ARGS);
  assert(!res.ok);
  assertEquals(s.log, ["release:pi_canceled", `release@${F1}:pi_canceled`, `release@${F2}:pi_canceled`]);
});

Deno.test("basket: a follower the cron failed closes the whole basket before any Stripe call", async () => {
  const s = fakeStore(row(), [row({ id: F1, voucher: "voucher_200", amount_cents: 20000, status: "failed" })]);
  const none = fakeStripe(() => {
    throw new Error("no stripe call expected");
  });
  const res = await runVoucherCard(s.store, none.stripe, ARGS);
  assert(!res.ok);
  assertEquals(res.code, "closed");
  assertEquals(none.calls.length, 0);
  assertEquals(s.row(PURCHASE).status, "failed");
});

Deno.test("settle by PI: a follower whose PI names its lead settles itself, never a mismatch", async () => {
  const s = basket("open", "pi_s");
  const ok = fakeStripe(() => ({ id: "pi_s", status: "succeeded", metadata: { mesita_kind: "wallet_voucher", purchase_id: PURCHASE, basket: "3" } }));
  // The cron and the Wallet read pass no basket_lead_id: the row is read.
  const follower = { id: F1, stripe_account_id: "acct_place", stripe_payment_intent_id: "pi_s", available_at: null, created_at: new Date(NOW).toISOString() };
  assertEquals(await settlePurchaseByPaymentIntent(s.store, ok.stripe, follower, NOW), "credited");
  assertEquals(s.log, [`credit@${F1}:pi_s:null`]);

  const gone = basket("open", "pi_s");
  const canceled = fakeStripe(() => ({ id: "pi_s", status: "canceled", metadata: { purchase_id: PURCHASE } }));
  assertEquals(await settlePurchaseByPaymentIntent(gone.store, canceled.stripe, { ...follower, id: F2 }, NOW), "expired");
  assertEquals(gone.log, [`release@${F2}:pi_canceled`]);
});
