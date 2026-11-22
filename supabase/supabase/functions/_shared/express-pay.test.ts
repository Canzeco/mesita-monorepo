// MESITA-4384 (money): express pay (Apple Pay / Google Pay) on a voucher.
// The server opens ONE PaymentIntent with no payment method and never
// confirms it; the browser does. A replay before the browser confirms (or
// after a wallet decline) keeps that PaymentIntent and its rows open, never
// cancels it; a succeeded one credits every row once and records the wallet
// through the one writer; the cron credits a succeeded one past ten minutes
// and only cancels one still waiting; the kill switch, the body gate, the
// wallet label and the domain check's throttle.

import { assert, assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { type PurchaseCardRow, type PurchaseStore, recordPayWith, settlePurchaseByPaymentIntent, walletOfIntent } from "./purchase-pi.ts";
import { expressBodyGate, runVoucherCard } from "./voucher-card.ts";
import { expressLabel, expressWalletsFor } from "./express-pay.ts";
import { moneyConfigFrom } from "./money-config.ts";
import { DOMAIN_RECHECK_MS, walletDomainsForSetup } from "./pm-domains.ts";
import type { StripeCall } from "./stripe.ts";

type Call = { method: string; path: string; params?: Record<string, unknown>; opts?: Record<string, unknown> };

const LEAD = "33333333-3333-4333-8333-333333333333";
const FOLLOWER = "44444444-4444-4444-8444-444444444444";
const NOW = Date.parse("2026-11-18T20:00:00Z");

function row(over: Partial<PurchaseCardRow> = {}): PurchaseCardRow {
  return {
    id: LEAD,
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
    pay_source: "express",
    pay_with: "express",
    ...over,
  };
}

function fakeStore(initial: PurchaseCardRow, followers: PurchaseCardRow[] = []) {
  const rows = new Map<string, PurchaseCardRow>([
    [initial.id, { ...initial }],
    ...followers.map((f) => [f.id, { ...f, basket_lead_id: initial.id }] as const),
  ]);
  const log: string[] = [];
  const tag = (id: string) => (id === initial.id ? "" : `@${id.slice(0, 4)}`);
  const store: PurchaseStore = {
    read: (id) => Promise.resolve(rows.has(id) ? { ...rows.get(id)! } : null),
    followers: (leadId) => Promise.resolve([...rows.values()].filter((r) => r.basket_lead_id === leadId).map((r) => ({ ...r }))),
    openPi: (id, pi) => {
      log.push(`openPi:${pi}`);
      const mine = [...rows.values()].filter((r) => r.id === id || r.basket_lead_id === id);
      for (const r of mine) if (r.status === "opening" && !r.stripe_payment_intent_id) rows.set(r.id, { ...r, status: "open", stripe_payment_intent_id: pi });
      return Promise.resolve(mine.every((r) => rows.get(r.id)!.stripe_payment_intent_id === pi));
    },
    release: (id, code) => {
      log.push(`release${tag(id)}:${code}`);
      const r = rows.get(id)!;
      if (r.status === "opening" || r.status === "open") rows.set(id, { ...r, status: "failed" });
      return Promise.resolve();
    },
    credit: (id, pi) => {
      const r = rows.get(id)!;
      const already = r.status === "paid";
      log.push(`credit${tag(id)}:${already ? "again" : "once"}`);
      rows.set(id, { ...r, status: "paid", stripe_payment_intent_id: pi });
      return Promise.resolve(already ? "already_paid" : "credited");
    },
    payWith: (id, wallet) => {
      log.push(`payWith:${wallet}`);
      for (const r of rows.values()) {
        if ((r.id === id || r.basket_lead_id === id) && r.pay_source === "express") rows.set(r.id, { ...r, pay_with: wallet });
      }
      return Promise.resolve();
    },
  };
  return { store, log, get: (id: string) => rows.get(id)! };
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
  purchaseId: LEAD,
  currency: "mxn",
  placeId: "p",
  placeName: "Cuerno",
  consumerId: "c",
  voucher: "voucher_1000" as const,
  publishableKey: "pk_test_abc",
  nowMs: NOW,
};

const applePayCharge = { id: "ch_1", payment_method_details: { type: "card", card: { wallet: { type: "apple_pay" } } } };

Deno.test("express open: one unconfirmed PI for the server's amount, no payment method, no clone, no confirm; rows open; secret answered", async () => {
  const s = fakeStore(row());
  const { stripe, calls } = fakeStripe(() => ({ id: "pi_x", status: "requires_payment_method", client_secret: "pi_x_secret_1", amount: 100000 }));
  const res = await runVoucherCard(s.store, stripe, ARGS);
  assert(res.ok && "express" in res);
  assertEquals(res.express, {
    status: "requires_payment_method",
    payment_intent_id: "pi_x",
    client_secret: "pi_x_secret_1",
    stripe_account: "acct_place",
    publishable_key: "pk_test_abc",
    amount_cents: 100000,
  });
  assertEquals(calls.map((c) => `${c.method} ${c.path}`), ["POST payment_intents"]);
  const create = calls[0].params!;
  assertEquals(create.amount, 100000);
  assertEquals("payment_method" in create, false);
  assertEquals("confirm" in create, false);
  assertEquals("application_fee_amount" in create, false);
  assertEquals(create.payment_method_types, ["card"]);
  assertEquals((create.metadata as Record<string, unknown>).mesita_pay_with, "express");
  assertEquals((create.metadata as Record<string, unknown>).purchase_id, LEAD);
  assertEquals(calls[0].opts?.idempotencyKey, `voucherexpress-pi:${LEAD}`);
  assertEquals(calls[0].opts?.stripeAccount, "acct_place");
  assertEquals(s.log, ["openPi:pi_x"]);
  assertEquals(s.get(LEAD).status, "open");
});

Deno.test("express basket: one PI for the sum; every follower open on it; a succeeded PI credits each once and names the wallet on all", async () => {
  const s = fakeStore(row(), [row({ id: FOLLOWER, voucher: "voucher_200", amount_cents: 20000 })]);
  const open = fakeStripe(() => ({ id: "pi_b", status: "requires_payment_method", client_secret: "sec", amount: 120000 }));
  const first = await runVoucherCard(s.store, open.stripe, ARGS);
  assert(first.ok && "express" in first);
  assertEquals(open.calls[0].params!.amount, 120000);
  assertEquals(s.get(FOLLOWER).stripe_payment_intent_id, "pi_b");
  assertEquals(s.get(FOLLOWER).pay_source, "express");

  const paid = fakeStripe(() => ({ id: "pi_b", status: "succeeded", latest_charge: applePayCharge }));
  const res = await runVoucherCard(s.store, paid.stripe, ARGS);
  assert(res.ok && "express" in res);
  assertEquals(res.express, { status: "succeeded", payment_intent_id: "pi_b", pay_with: "apple_pay" });
  assertEquals(s.log.filter((l) => l.startsWith("credit")), ["credit:once", `credit@${FOLLOWER.slice(0, 4)}:once`]);
  assertEquals(s.get(FOLLOWER).pay_with, "apple_pay");
  // The settle read asked for the charge, so no second read was needed.
  assertEquals(paid.calls.map((c) => c.params), [{ expand: ["latest_charge"] }]);
});

Deno.test("express replay BEFORE the browser confirms keeps the PI: no cancel, no release, the same secret", async () => {
  const s = fakeStore(row({ status: "open", stripe_payment_intent_id: "pi_x" }));
  const { stripe, calls } = fakeStripe(() => ({ id: "pi_x", status: "requires_payment_method", client_secret: "pi_x_secret_1", amount: 100000 }));
  const res = await runVoucherCard(s.store, stripe, { ...ARGS, nowMs: NOW + 60_000 });
  assert(res.ok && "express" in res);
  assertEquals(res.express.status, "requires_payment_method");
  assert(res.express.status === "requires_payment_method" && res.express.client_secret === "pi_x_secret_1");
  assertEquals(calls.map((c) => `${c.method} ${c.path}`), ["GET payment_intents/pi_x"]);
  assertEquals(s.log, []);
  assertEquals(s.get(LEAD).status, "open");
});

Deno.test("express retry after a wallet decline: the same PI, rows still open, the decline's text", async () => {
  const s = fakeStore(row({ status: "open", stripe_payment_intent_id: "pi_x" }));
  const { stripe, calls } = fakeStripe(() => ({
    id: "pi_x",
    status: "requires_payment_method",
    client_secret: "pi_x_secret_1",
    amount: 100000,
    last_payment_error: { code: "card_declined", decline_code: "insufficient_funds" },
  }));
  const res = await runVoucherCard(s.store, stripe, { ...ARGS, nowMs: NOW + 120_000 });
  assert(res.ok && "express" in res && res.express.status === "requires_payment_method");
  assertEquals(res.express.payment_intent_id, "pi_x");
  assertEquals(res.express.decline_code, "insufficient_funds");
  assertEquals(res.express.error, "Your bank declined it. Try another way to pay.");
  assert(calls.every((c) => !c.path.endsWith("/cancel")));
  assertEquals(s.log, []);
  assertEquals(s.get(LEAD).status, "open");
});

Deno.test("express replay past ten minutes answers closed and leaves cancel-then-release to the cron", async () => {
  const s = fakeStore(row({ status: "open", stripe_payment_intent_id: "pi_x" }));
  const { stripe, calls } = fakeStripe(() => ({ id: "pi_x", status: "requires_payment_method", client_secret: "sec" }));
  const res = await runVoucherCard(s.store, stripe, { ...ARGS, nowMs: NOW + 11 * 60_000 });
  assert(!res.ok);
  assertEquals(res.code, "closed");
  assert(calls.every((c) => !c.path.endsWith("/cancel")));
  assertEquals(s.log, []);
});

Deno.test("express settle credits once: a second replay reads the paid rows and the stored wallet, no Stripe call", async () => {
  const s = fakeStore(row({ status: "open", stripe_payment_intent_id: "pi_x" }));
  const paid = fakeStripe(() => ({ id: "pi_x", status: "succeeded", latest_charge: { payment_method_details: { card: { wallet: { type: "google_pay" } } } } }));
  const first = await runVoucherCard(s.store, paid.stripe, ARGS);
  assert(first.ok && "express" in first);
  assertEquals(first.express, { status: "succeeded", payment_intent_id: "pi_x", pay_with: "google_pay" });
  const again = fakeStripe(() => {
    throw new Error("no Stripe call expected");
  });
  const second = await runVoucherCard(s.store, again.stripe, ARGS);
  assert(second.ok && "express" in second);
  assertEquals(second.express, { status: "succeeded", payment_intent_id: "pi_x", pay_with: "google_pay" });
  assertEquals(s.log.filter((l) => l.startsWith("credit")), ["credit:once"]);
  assertEquals(again.calls.length, 0);
});

Deno.test("express replay needs no saved card: no customer, no clone, and a card row still never takes the express path", async () => {
  const s = fakeStore(row({ status: "open", stripe_payment_intent_id: "pi_x" }));
  const { stripe, calls } = fakeStripe(() => ({ id: "pi_x", status: "processing" }));
  const res = await runVoucherCard(s.store, stripe, ARGS); // no customer, no platformPm
  assert(res.ok && "express" in res);
  assertEquals(res.express, { status: "processing", payment_intent_id: "pi_x" });
  assert(calls.every((c) => c.path !== "payment_methods"));

  // An old row (no pay_source) reads card: the card path, which needs a card.
  const old = fakeStore(row({ pay_source: undefined, pay_with: undefined }));
  const cardStripe = fakeStripe((c) => (c.path === "payment_methods" ? { id: "pm_cloned" } : { id: "pi_c", status: "succeeded" }));
  const r = await runVoucherCard(old.store, cardStripe.stripe, { ...ARGS, customer: "cus_g", platformPm: "pm_platform1" });
  assert(r.ok && "card" in r);
  assertEquals(cardStripe.calls[0].path, "payment_methods");
});

Deno.test("the cron credits a succeeded express PI past ten minutes, never cancels it, and records the wallet", async () => {
  const s = fakeStore(row({ status: "open", stripe_payment_intent_id: "pi_x" }));
  const { stripe, calls } = fakeStripe((c) =>
    c.params?.expand ? { id: "pi_x", status: "succeeded", latest_charge: applePayCharge } : { id: "pi_x", status: "succeeded", latest_charge: "ch_1", metadata: { purchase_id: LEAD } }
  );
  const out = await settlePurchaseByPaymentIntent(s.store, stripe, {
    id: LEAD,
    stripe_account_id: "acct_place",
    stripe_payment_intent_id: "pi_x",
    created_at: new Date(NOW).toISOString(),
    available_at: null,
  }, NOW + 30 * 60_000);
  assertEquals(out, "credited");
  assert(calls.every((c) => !c.path.endsWith("/cancel")));
  assertEquals(s.log, ["credit:once", "payWith:apple_pay"]);
  assertEquals(s.get(LEAD).pay_with, "apple_pay");
});

Deno.test("an abandoned express PI is cancelled first, then released, by the same ten-minute path", async () => {
  const s = fakeStore(row({ status: "open", stripe_payment_intent_id: "pi_x" }));
  const { stripe, calls } = fakeStripe((c) =>
    c.path.endsWith("/cancel") ? { id: "pi_x", status: "canceled" } : { id: "pi_x", status: "requires_payment_method", metadata: { purchase_id: LEAD } }
  );
  const out = await settlePurchaseByPaymentIntent(s.store, stripe, {
    id: LEAD,
    stripe_account_id: "acct_place",
    stripe_payment_intent_id: "pi_x",
    created_at: new Date(NOW).toISOString(),
    available_at: null,
  }, NOW + 11 * 60_000);
  assertEquals(out, "expired");
  assertEquals(calls.map((c) => `${c.method} ${c.path}`), ["GET payment_intents/pi_x", "POST payment_intents/pi_x/cancel"]);
  assertEquals(s.log, ["release:pi_canceled"]);
  assertEquals(s.get(LEAD).pay_with, "express");
});

Deno.test("receiver first: an unexpanded PI (latest_charge an id) is read again with the charge, and the wallet is written once per call, idempotently", async () => {
  const s = fakeStore(row({ status: "paid", stripe_payment_intent_id: "pi_x" }));
  const { stripe, calls } = fakeStripe(() => ({ id: "pi_x", status: "succeeded", latest_charge: applePayCharge }));
  assertEquals(walletOfIntent({ id: "pi_x", latest_charge: "ch_1" }), null);
  assertEquals(await recordPayWith(s.store, stripe, { leadId: LEAD, account: "acct_place", pi: { id: "pi_x", latest_charge: "ch_1" } }), "apple_pay");
  assertEquals(calls[0].params, { expand: ["latest_charge"] });
  assertEquals(calls[0].opts?.stripeAccount, "acct_place");
  assertEquals(await recordPayWith(s.store, stripe, { leadId: LEAD, account: "acct_place", pi: { id: "pi_x", latest_charge: applePayCharge } }), "apple_pay");
  assertEquals(calls.length, 1);
  assertEquals(s.get(LEAD).pay_with, "apple_pay");
  // A plain card charge names no wallet and writes nothing.
  assertEquals(walletOfIntent({ latest_charge: { payment_method_details: { card: { wallet: null } } } }), null);
});

Deno.test("a card purchase settled by PI never reads or writes a wallet", async () => {
  const s = fakeStore(row({ status: "open", stripe_payment_intent_id: "pi_c", pay_source: "card", pay_with: null }));
  const { stripe, calls } = fakeStripe(() => ({ id: "pi_c", status: "succeeded", metadata: { purchase_id: LEAD } }));
  await settlePurchaseByPaymentIntent(s.store, stripe, {
    id: LEAD,
    stripe_account_id: "acct_place",
    stripe_payment_intent_id: "pi_c",
    created_at: new Date(NOW).toISOString(),
    available_at: null,
  }, NOW);
  assertEquals(calls.length, 1);
  assertEquals(s.log, ["credit:once"]);
});

Deno.test("body gate: express and card_pm_id together → 400 field express; a non-bool express → 400; either alone passes", () => {
  const both = expressBodyGate({ express: true, card_pm_id: "pm_x" });
  assert(!both.ok);
  assertEquals([both.status, both.code, both.field], [400, "bad_body", "express"]);
  const odd = expressBodyGate({ express: "yes" });
  assert(!odd.ok);
  assertEquals(expressBodyGate({ express: true }), { ok: true, express: true });
  assertEquals(expressBodyGate({ card_pm_id: "pm_x" }), { ok: true, express: false });
  // Neither stays the card path's 409 card_required (voucherBuyGate).
  assertEquals(expressBodyGate({}), { ok: true, express: false });
});

Deno.test("kill switch: absent → both wallets; [] → off; a list narrows; junk dropped; domains narrow further", () => {
  assertEquals(moneyConfigFrom({}).express_wallets, ["apple_pay", "google_pay"]);
  assertEquals(moneyConfigFrom({ express_wallets: [] }).express_wallets, []);
  assertEquals(moneyConfigFrom({ express_wallets: ["google_pay", "link"] }).express_wallets, ["google_pay"]);
  assertEquals(moneyConfigFrom({ express_wallets: "all" }).express_wallets, ["apple_pay", "google_pay"]);
  assertEquals(expressWalletsFor(["apple_pay", "google_pay"], { apple_pay: false, google_pay: true }), ["google_pay"]);
  assertEquals(expressWalletsFor([], { apple_pay: true, google_pay: true }), []);
});

Deno.test("wallet label: '<voucher> · <place>', control characters stripped, trimmed, capped at 60", () => {
  assertEquals(expressLabel("$1,000.00MX voucher", "  Cuerno\n\tMasaryk "), "$1,000.00MX voucher · Cuerno Masaryk");
  assertEquals(expressLabel("VIP voucher", null), "VIP voucher · Mesita");
  const long = expressLabel("$1,000.00MX voucher", "A".repeat(80));
  assertEquals(Array.from(long).length, 60);
  assert(long.endsWith("…"));
  assertEquals(expressLabel("x\u0000y", "p q"), "x y · p q");
});

// ── The domain check on the guest path ─────────────────────────────────────

function fakeAdmin(stamps: Record<string, string | null> | null) {
  const updates: Record<string, unknown>[] = [];
  const admin = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: stamps, error: null }) }) }),
      update: (v: Record<string, unknown>) => {
        updates.push(v);
        return { eq: () => Promise.resolve({ error: null }) };
      },
    }),
  } as unknown as SupabaseClient;
  return { admin, updates };
}

const CTX = { placeId: "p", accountId: "acct_place", livemode: false, nowMs: NOW };
const active = (domain: string) => ({ data: [{ id: `pmd_${domain}`, domain_name: domain, enabled: true, apple_pay: { status: "active" }, google_pay: { status: "active" } }] });

Deno.test("domain check: both stamped → no Stripe call", async () => {
  const { admin, updates } = fakeAdmin({ apple_pay_domain_at: "2026-11-01T00:00:00Z", google_pay_domain_at: "2026-11-01T00:00:00Z", pm_domains_checked_at: null });
  const { stripe, calls } = fakeStripe(() => ({}));
  const res = await walletDomainsForSetup(admin, stripe, CTX);
  assertEquals([res.apple_pay, res.google_pay, res.checked], [true, true, false]);
  assertEquals(calls.length, 0);
  assertEquals(updates.length, 0);
});

Deno.test("domain check: a missing stamp checked within 6 h → no Stripe call; older → one check per domain, stamped", async () => {
  const recent = fakeAdmin({ apple_pay_domain_at: null, google_pay_domain_at: null, pm_domains_checked_at: new Date(NOW - DOMAIN_RECHECK_MS + 60_000).toISOString() });
  const none = fakeStripe(() => ({}));
  const r1 = await walletDomainsForSetup(recent.admin, none.stripe, CTX);
  assertEquals([r1.apple_pay, r1.google_pay], [false, false]);
  assertEquals(none.calls.length, 0);

  const stale = fakeAdmin({ apple_pay_domain_at: null, google_pay_domain_at: null, pm_domains_checked_at: new Date(NOW - DOMAIN_RECHECK_MS - 1).toISOString() });
  const { stripe, calls } = fakeStripe((c) => active(String(c.params?.domain_name)));
  const r2 = await walletDomainsForSetup(stale.admin, stripe, CTX);
  assertEquals([r2.apple_pay, r2.google_pay, r2.checked], [true, true, true]);
  assertEquals(calls.map((c) => `${c.method} ${c.path} ${c.params?.domain_name}`), [
    "GET payment_method_domains mesita.ai",
    "GET payment_method_domains www.mesita.ai",
  ]);
  assert(calls.every((c) => c.opts?.stripeAccount === "acct_place"));
  assertEquals(stale.updates.length, 1);
  assertEquals(stale.updates[0].apple_pay_domain_at, new Date(NOW).toISOString());
  assertEquals(stale.updates[0].pm_domains_checked_at, new Date(NOW).toISOString());
});

Deno.test("domain check: a missing domain is created on the connected account, keyed by account and domain", async () => {
  const { admin } = fakeAdmin(null);
  const { stripe, calls } = fakeStripe((c) =>
    c.method === "GET" ? { data: [] } : { id: "pmd_new", domain_name: c.params?.domain_name, enabled: true, apple_pay: { status: "active" }, google_pay: { status: "inactive" } }
  );
  const res = await walletDomainsForSetup(admin, stripe, CTX);
  assertEquals([res.apple_pay, res.google_pay], [true, false]);
  const posts = calls.filter((c) => c.method === "POST");
  assertEquals(posts.map((c) => c.opts?.idempotencyKey), ["pmd:acct_place:mesita.ai", "pmd:acct_place:www.mesita.ai"]);
});

Deno.test("domain check: Stripe slower than the budget → timeout, no wallet without a stamp, the check is throttled", async () => {
  const { admin, updates } = fakeAdmin({ apple_pay_domain_at: null, google_pay_domain_at: null, pm_domains_checked_at: null });
  const slow: StripeCall = (_m, _p, _params, opts) =>
    new Promise((_resolve, reject) => {
      opts?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    });
  const res = await walletDomainsForSetup(admin, slow, CTX, { timeoutMs: 20 });
  assertEquals([res.apple_pay, res.google_pay, res.timeout], [false, false, true]);
  assertEquals(updates.length, 1);
  assertEquals(updates[0].pm_domains_checked_at, new Date(NOW).toISOString());
});
