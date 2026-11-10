// MESITA-3305 — the card part of a payment: every refusal code, the lock on
// three refused Checkouts, what the Checkout on the connected account
// carries (the fee on the card part, never on the tip), the hold → Checkout
// → open sequence, a Stripe refusal releasing the hold, and in_progress
// with the open session's url.

import { assertEquals } from "jsr:@std/assert@1";
import { bps, MESITA_FEE_BPS_PAYMENT } from "./money.ts";
import { cardCheckoutParams, cardRefusal, lockedFor, releaseCardPayment, startCardPayment } from "./pay-card.ts";
import type { AccountRow, PaymentSettings } from "./payments.ts";
import { readCardPart } from "./pay.ts";
import { classifySession } from "./checkout-session.ts";
import { settlePayment } from "./settle-payment.ts";
import { fakeAdmin } from "./testing/fake-admin.ts";
import { WALLET_CHECKOUT_TTL_SEC } from "./wallet.ts";
import { type StripeCall, StripeError } from "./stripe.ts";

const PLACE = "00000000-0000-4000-8000-0000000a3305";
const GUEST = "00000000-0000-4000-8000-0000000b3305";
const REQUEST = "00000000-0000-4000-8000-0000000c3305";
const ROW = "00000000-0000-4000-8000-0000000d3305";
const T0 = Date.parse("2026-11-08T12:00:00Z");

const ALL_ON: PaymentSettings = {
  pay_cards: true,
  prepayments: true,
  house_credits: true,
  cash_payments: true,
  card_cashback_bps: 500,
  cash_cashback_bps: 200,
  voucher_200: true,
  voucher_1000: true,
  voucher_5000: true,
  voucher_welcome: true,
  voucher_story: true,
  voucher_vip: true,
};

const ACCOUNT: AccountRow = {
  place_id: PLACE,
  stripe_account_id: "acct_place",
  livemode: false,
  account_country: "MX",
  charges_enabled: true,
  details_submitted: true,
  payouts_enabled: true,
  requirements_due: [],
  disabled_reason: null,
};

const gate = { account: ACCOUNT, settings: ALL_ON, livemode: false, currency: "mxn", cardCents: 500, tipCents: 1000 };

Deno.test("cardRefusal: no_account, cards_off, currency_mismatch, below_minimum on card + tip; null when open", () => {
  assertEquals(cardRefusal(gate), null);
  assertEquals(cardRefusal({ ...gate, account: null })?.code, "no_account");
  assertEquals(cardRefusal({ ...gate, account: { ...ACCOUNT, charges_enabled: false } })?.code, "no_account");
  assertEquals(cardRefusal({ ...gate, livemode: true })?.code, "no_account");
  assertEquals(cardRefusal({ ...gate, settings: { ...ALL_ON, pay_cards: false } })?.code, "cards_off");
  // MESITA-3461: an unpaid fee invoice holds cards off, the owner's switch untouched.
  assertEquals(cardRefusal({ ...gate, account: { ...ACCOUNT, fee_hold: true } })?.code, "cards_off");
  assertEquals(cardRefusal({ ...gate, account: { ...ACCOUNT, fee_hold: false } }), null);
  assertEquals(cardRefusal({ ...gate, account: { ...ACCOUNT, account_country: "US" } })?.code, "currency_mismatch");
  // MX$5 by card with a MX$10 tip passes the MX$10 minimum (rule 1); MX$5 alone does not.
  assertEquals(cardRefusal({ ...gate, cardCents: 500, tipCents: 1000 }), null);
  assertEquals(cardRefusal({ ...gate, cardCents: 500, tipCents: 0 })?.code, "below_minimum");
  assertEquals(cardRefusal({ ...gate, cardCents: 1000, tipCents: 0 }), null);
});

Deno.test("readCardPart: the card part never exceeds the bill, a tip needs a card part, a card part needs a return_url", () => {
  assertEquals(readCardPart({}, 5000), { ok: true, cardCents: 0, tipCents: 0, returnUrl: null });
  assertEquals(readCardPart({ card_cents: 2000, tip_cents: 500, return_url: "https://mesita.ai/pay" }, 5000), { ok: true, cardCents: 2000, tipCents: 500, returnUrl: "https://mesita.ai/pay" });
  assertEquals(readCardPart({ card_cents: 6000, return_url: "https://mesita.ai/pay" }, 5000).ok, false);
  assertEquals(readCardPart({ tip_cents: 100 }, 5000).ok, false);
  assertEquals(readCardPart({ card_cents: 2000 }, 5000).ok, false);
  assertEquals(readCardPart({ card_cents: 20.5, return_url: "https://mesita.ai/pay" }, 5000).ok, false);
});

Deno.test("lockedFor: three failed within ten minutes lock; two, or one paid among them, do not; the lock expires", () => {
  const at = (minAgo: number) => new Date(T0 - minAgo * 60_000).toISOString();
  const three = [{ status: "failed", created_at: at(1) }, { status: "failed", created_at: at(2) }, { status: "failed", created_at: at(3) }];
  assertEquals(lockedFor(three, T0), 7 * 60);
  assertEquals(lockedFor(three.slice(0, 2), T0), 0);
  assertEquals(lockedFor([{ status: "paid", created_at: at(1) }, ...three.slice(1)], T0), 0);
  assertEquals(lockedFor([{ status: "failed", created_at: at(1) }, { status: "failed", created_at: at(2) }, { status: "failed", created_at: at(11) }], T0), 0);
});

Deno.test("the Checkout: one PaymentIntent, no application fee (d5a), the tip is its own line, the row id rides in metadata and client_reference_id", () => {
  const p = cardCheckoutParams({
    paymentId: ROW,
    placeId: PLACE,
    consumerId: GUEST,
    email: "g@x.mx",
    cardCents: 500,
    tipCents: 1000,
    currency: "mxn",
    placeName: "Cuerno",
    returnUrl: "https://mesita.ai/pay",
    nowSec: 1_000,
  });
  assertEquals(p.mode, "payment");
  assertEquals(p.client_reference_id, ROW);
  assertEquals(p.customer_email, "g@x.mx");
  assertEquals("customer" in p, false);
  assertEquals(p.expires_at, 1_000 + WALLET_CHECKOUT_TTL_SEC);
  const items = p.line_items as Array<{ price_data: { unit_amount: number; product_data: { name: string } } }>;
  assertEquals(items.map((i) => i.price_data.unit_amount), [500, 1000]);
  assertEquals(items[1].price_data.product_data.name, "Tip · Cuerno");
  // d5a (MESITA-3461): a direct charge with no application fee.
  const pid = p.payment_intent_data as { application_fee_amount?: number; metadata: Record<string, string> };
  assertEquals("application_fee_amount" in pid, false);
  assertEquals(pid.metadata.payment_id, ROW);
  assertEquals(pid.metadata.mesita_kind, "wallet_payment");
  assertEquals(p.success_url, `https://mesita.ai/pay?payment=${ROW}&checkout={CHECKOUT_SESSION_ID}`);
  // No tip: one line.
  const solo = cardCheckoutParams({ paymentId: ROW, placeId: PLACE, consumerId: GUEST, email: null, cardCents: 99999, tipCents: 0, currency: "mxn", placeName: "Cuerno", returnUrl: "https://mesita.ai/pay", nowSec: 1 });
  assertEquals((solo.line_items as unknown[]).length, 1);
  assertEquals("application_fee_amount" in (solo.payment_intent_data as Record<string, unknown>), false);
  assertEquals("customer_email" in solo, false);
});

function startArgs(over: Partial<Parameters<typeof startCardPayment>[2]> = {}) {
  return {
    consumerId: GUEST,
    email: null,
    input: { placeId: PLACE, amountCents: 2500, requestId: REQUEST, ticket: null, cardCents: 500, tipCents: 1000, returnUrl: "https://mesita.ai/pay" },
    place: { id: PLACE, name: "Cuerno", currency: "mxn" },
    account: ACCOUNT,
    settings: ALL_ON,
    livemode: false,
    nowMs: T0,
    ...over,
  };
}

Deno.test("start: hold (credit = bill − card, fee and cashback rate stored) → Checkout on the account keyed by the row → open", async () => {
  const stripeCalls: Array<{ method: string; path: string; params?: Record<string, unknown>; opts?: Record<string, unknown> }> = [];
  const stripe: StripeCall = (method, path, params, opts) => {
    stripeCalls.push({ method, path, params, opts: opts as Record<string, unknown> });
    return Promise.resolve({ id: "cs_new", url: "https://checkout.stripe.com/c/x", status: "open" });
  };
  const fake = fakeAdmin({
    table: () => ({ data: [] }),
    rpc: (name) => name === "wallet_hold_payment" ? { data: { ok: true, outcome: "held", payment_id: ROW, expires_at: "x" } } : { data: { ok: true } },
  });
  const r = await startCardPayment(fake.client, stripe, startArgs());
  assertEquals(r.ok, true);
  if (!r.ok || r.kind !== "open") throw new Error("expected open");
  assertEquals(r.start.url, "https://checkout.stripe.com/c/x");
  assertEquals(r.start.credit_cents, 2000);
  assertEquals(r.start.card_cents, 500);
  assertEquals(r.start.tip_cents, 1000);
  const hold = fake.rpcs.find((x) => x.name === "wallet_hold_payment")!.args;
  assertEquals(hold.p_credit_cents, 2000);
  assertEquals(hold.p_card_cents, 500);
  assertEquals(hold.p_tip_cents, 1000);
  // The fee billed apart is bps of the card part alone.
  assertEquals(hold.p_application_fee_cents, bps(500, MESITA_FEE_BPS_PAYMENT));
  assertEquals(hold.p_application_fee_cents, 25);
  assertEquals(hold.p_cashback_bps, 500);
  assertEquals(hold.p_stripe_account_id, "acct_place");
  assertEquals(typeof hold.p_proof_token, "string");
  assertEquals(stripeCalls.length, 1);
  assertEquals(stripeCalls[0].path, "checkout/sessions");
  assertEquals(stripeCalls[0].opts?.idempotencyKey, ROW);
  assertEquals(stripeCalls[0].opts?.stripeAccount, "acct_place");
  assertEquals(fake.rpcs.find((x) => x.name === "wallet_open_payment")?.args, { p_payment_id: ROW, p_session_id: "cs_new" });
});

Deno.test("start: the cashback switch off stores rate 0; settle never re-reads the switch", async () => {
  const fake = fakeAdmin({
    table: () => ({ data: [] }),
    rpc: (name) => name === "wallet_hold_payment" ? { data: { ok: true, outcome: "held", payment_id: ROW, expires_at: "x" } } : { data: { ok: true } },
  });
  await startCardPayment(fake.client, () => Promise.resolve({ id: "cs", url: "u" }), startArgs({ settings: { ...ALL_ON, card_cashback_bps: null } }));
  assertEquals(fake.rpcs.find((x) => x.name === "wallet_hold_payment")!.args.p_cashback_bps, 0);
});

Deno.test("start: Stripe refuses → the hold is released as failed with Stripe's code, 502 checkout_failed", async () => {
  const stripe: StripeCall = () => Promise.reject(new StripeError("checkout/sessions", "invalid_request_error", "amount_too_small", 400, "too small"));
  const fake = fakeAdmin({
    table: () => ({ data: [] }),
    rpc: (name) => name === "wallet_hold_payment" ? { data: { ok: true, outcome: "held", payment_id: ROW, expires_at: "x" } } : { data: { ok: true } },
  });
  const r = await startCardPayment(fake.client, stripe, startArgs());
  assertEquals(r.ok, false);
  if (r.ok) throw new Error("expected refusal");
  assertEquals(r.status, 502);
  assertEquals(r.code, "checkout_failed");
  assertEquals(fake.rpcs.find((x) => x.name === "wallet_release_payment")?.args, { p_payment_id: ROW, p_status: "failed", p_error: "amount_too_small" });
  assertEquals(fake.rpcs.some((x) => x.name === "wallet_open_payment"), false);
});

Deno.test("start: an open Checkout of this guest here answers 409 in_progress with its url and expiry; nothing is held", async () => {
  const reads: string[] = [];
  const stripe: StripeCall = (_m, path) => {
    reads.push(path);
    return Promise.resolve({ id: "cs_open", status: "open", url: "https://checkout.stripe.com/c/open" });
  };
  const fake = fakeAdmin({
    table: (op) => {
      if (op.table === "wallet_payments" && op.filters.status === "open") {
        return { data: [{ id: ROW, stripe_checkout_session_id: "cs_open", expires_at: "2026-11-08T12:31:00Z", request_id: "other" }] };
      }
      return { data: [] };
    },
  });
  const r = await startCardPayment(fake.client, stripe, startArgs());
  assertEquals(r.ok, false);
  if (r.ok) throw new Error("expected refusal");
  assertEquals(r.code, "in_progress");
  assertEquals(r.detail, { payment_id: ROW, url: "https://checkout.stripe.com/c/open", expires_at: "2026-11-08T12:31:00Z" });
  assertEquals(reads, ["checkout/sessions/cs_open"]);
  assertEquals(fake.rpcs, []);
});

Deno.test("start: three refused Checkouts in ten minutes → 409 locked with retry_after_s, before any hold", async () => {
  const at = (minAgo: number) => new Date(T0 - minAgo * 60_000).toISOString();
  const fake = fakeAdmin({
    table: (op) => op.table === "wallet_payments" && op.filters.status === undefined
      ? { data: [{ status: "failed", created_at: at(1) }, { status: "failed", created_at: at(4) }, { status: "failed", created_at: at(6) }] }
      : { data: [] },
  });
  const r = await startCardPayment(fake.client, () => Promise.reject(new Error("not asked")), startArgs());
  if (r.ok) throw new Error("expected refusal");
  assertEquals(r.code, "locked");
  assertEquals(r.detail?.retry_after_s, 4 * 60);
  assertEquals(fake.rpcs, []);
});

Deno.test("start: the RPC's insufficient and taken pass through with their detail", async () => {
  const fake = fakeAdmin({ table: () => ({ data: [] }), rpc: () => ({ data: { ok: false, code: "insufficient", spendable_cents: 1500 } }) });
  const r = await startCardPayment(fake.client, () => Promise.reject(new Error("not asked")), startArgs());
  if (r.ok) throw new Error("expected refusal");
  assertEquals([r.status, r.code, r.detail], [409, "insufficient", { spendable_cents: 1500 }]);
  const fake2 = fakeAdmin({ table: () => ({ data: [] }), rpc: () => ({ data: { ok: false, code: "taken", payment_id: ROW } }) });
  const r2 = await startCardPayment(fake2.client, () => Promise.reject(new Error("not asked")), startArgs());
  if (r2.ok) throw new Error("expected refusal");
  assertEquals([r2.code, r2.detail], ["taken", { payment_id: ROW }]);
});

// ── Settling ───────────────────────────────────────────────────────────────

Deno.test("classifySession reads the payment's own key, so a purchase session never settles a payment", () => {
  assertEquals(classifySession({ metadata: { payment_id: ROW }, payment_status: "paid", payment_intent: "pi" }, ROW, undefined, "payment_id").kind, "paid");
  assertEquals(classifySession({ metadata: { purchase_id: ROW }, payment_status: "paid" }, ROW, undefined, "payment_id").kind, "mismatch");
});

Deno.test("settlePayment: paid → wallet_settle_payment on the row's account; expired → release; no session past the TTL → failed", async () => {
  const calls: Array<{ path: string; opts?: Record<string, unknown> }> = [];
  const stripe: StripeCall = (_m, path, _p, opts) => {
    calls.push({ path, opts: opts as Record<string, unknown> });
    return Promise.resolve({ metadata: { payment_id: ROW }, payment_status: "paid", payment_intent: "pi_1" });
  };
  const fake = fakeAdmin({ rpc: () => ({ data: { ok: true, outcome: "paid" } }) });
  const payment = { id: ROW, stripe_checkout_session_id: "cs_1", stripe_account_id: "acct_place", created_at: new Date(T0).toISOString() };
  assertEquals(await settlePayment(fake.client, stripe, payment, T0 + 1000), "paid");
  assertEquals(calls[0], { path: "checkout/sessions/cs_1", opts: { stripeAccount: "acct_place", signal: undefined } });
  assertEquals(fake.rpcs, [{ name: "wallet_settle_payment", args: { p_payment_id: ROW, p_payment_intent: "pi_1" } }]);

  const expired: StripeCall = () => Promise.resolve({ metadata: { payment_id: ROW }, status: "expired", payment_status: "unpaid" });
  const fake2 = fakeAdmin({});
  assertEquals(await settlePayment(fake2.client, expired, payment, T0), "expired");
  assertEquals(fake2.rpcs[0].name, "wallet_release_payment");

  const fake3 = fakeAdmin({});
  const noSession = { ...payment, stripe_checkout_session_id: null };
  assertEquals(await settlePayment(fake3.client, stripe, noSession, T0 + 1000), "pending");
  assertEquals(await settlePayment(fake3.client, stripe, noSession, T0 + (WALLET_CHECKOUT_TTL_SEC + 1) * 1000), "expired");
  assertEquals(fake3.rpcs, [{ name: "wallet_release_payment", args: { p_payment_id: ROW, p_status: "failed", p_error: "no_session" } }]);
});

// ── Back from a cancelled Checkout (MESITA-3458) ────────────────────────────

Deno.test("cancel, change the amount, pay again: the release expires the session and frees the hold, so the next start opens a new Checkout", async () => {
  const OPEN = { id: ROW, status: "open", stripe_checkout_session_id: "cs_old", stripe_account_id: "acct_place", created_at: new Date(T0).toISOString(), expires_at: "2026-11-08T12:31:00Z" };
  let rowStatus = "open";
  const calls: Array<{ method: string; path: string; opts?: Record<string, unknown> }> = [];
  const stripe: StripeCall = (method, path, _p, opts) => {
    calls.push({ method, path, opts: opts as Record<string, unknown> });
    if (path === "checkout/sessions/cs_old/expire") return Promise.resolve({ id: "cs_old", status: "expired" });
    if (path === "checkout/sessions/cs_old") return Promise.resolve({ id: "cs_old", status: rowStatus === "open" ? "open" : "expired", url: "https://checkout.stripe.com/c/old" });
    return Promise.resolve({ id: "cs_new", url: "https://checkout.stripe.com/c/new", status: "open" });
  };
  const fake = fakeAdmin({
    // The open-row read sees the row until it is released.
    table: (op) => op.filters.status === "open" && rowStatus === "open" ? { data: [{ ...OPEN, request_id: REQUEST }] } : { data: [] },
    rpc: (name, args) => {
      if (name === "wallet_release_payment") {
        rowStatus = String(args.p_status);
        return { data: { ok: true, outcome: "released" } };
      }
      if (name === "wallet_hold_payment") return { data: { ok: true, outcome: "held", payment_id: "00000000-0000-4000-8000-0000000e3458", expires_at: "x" } };
      return { data: { ok: true } };
    },
  });

  // Before the release, a new amount under a new request id is in_progress.
  const NEW_REQUEST = "00000000-0000-4000-8000-0000000f3458";
  const before = await startCardPayment(fake.client, stripe, startArgs({ input: { ...startArgs().input, requestId: NEW_REQUEST, amountCents: 3000, cardCents: 1000 } }));
  assertEquals(!before.ok && before.code, "in_progress");

  assertEquals(await releaseCardPayment(fake.client, stripe, OPEN, T0 + 60_000), "released");
  assertEquals(calls.find((c) => c.path === "checkout/sessions/cs_old/expire")?.opts?.stripeAccount, "acct_place");
  // Expired, never failed: three cancels do not lock the guest out.
  assertEquals(fake.rpcs.find((x) => x.name === "wallet_release_payment")?.args, { p_payment_id: ROW, p_status: "expired", p_error: "cancelled" });

  const after = await startCardPayment(fake.client, stripe, startArgs({ input: { ...startArgs().input, requestId: NEW_REQUEST, amountCents: 3000, cardCents: 1000 } }));
  if (!after.ok || after.kind !== "open") throw new Error(`expected open, got ${JSON.stringify(after)}`);
  assertEquals(after.start.url, "https://checkout.stripe.com/c/new");
  assertEquals(after.start.card_cents, 1000);
});

Deno.test("release: a session Stripe already paid is settled, never released; a closed row is unchanged; no session releases at once", async () => {
  const row = { id: ROW, status: "open", stripe_checkout_session_id: "cs_paid", stripe_account_id: "acct_place", created_at: new Date(T0).toISOString(), expires_at: null };
  const paid: StripeCall = (method) =>
    method === "POST"
      ? Promise.reject(new StripeError("checkout/sessions/cs_paid/expire", "invalid_request_error", "checkout_session_not_open", 400, "not open"))
      : Promise.resolve({ metadata: { payment_id: ROW }, payment_status: "paid", status: "complete", payment_intent: "pi_1" });
  const fake = fakeAdmin({ rpc: () => ({ data: { ok: true, outcome: "paid" } }) });
  assertEquals(await releaseCardPayment(fake.client, paid, row, T0), "paid");
  assertEquals(fake.rpcs.map((x) => x.name), ["wallet_settle_payment"]);

  const fake2 = fakeAdmin({});
  assertEquals(await releaseCardPayment(fake2.client, paid, { ...row, status: "paid" }, T0), "unchanged");
  assertEquals(fake2.rpcs, []);

  const fake3 = fakeAdmin({});
  const never: StripeCall = () => Promise.reject(new Error("no Stripe call expected"));
  assertEquals(await releaseCardPayment(fake3.client, never, { ...row, status: "opening", stripe_checkout_session_id: null }, T0), "released");
  assertEquals(fake3.rpcs, [{ name: "wallet_release_payment", args: { p_payment_id: ROW, p_status: "expired", p_error: "cancelled" } }]);
});
