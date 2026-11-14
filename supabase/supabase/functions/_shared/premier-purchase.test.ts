// MESITA-3168 — Premier Refill purchase, the money paths: a pack costs what
// the constants say, card only; only this purchase's own paid session (right
// amount, currency, mode) adds days; a refusal at settle is refunded once in
// TEST and left for Pato in live or when the refund fails; a settled
// purchase is never settled again. Stripe and the database are stubbed.

import { assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  parseRefillStart,
  purchaseLine,
  REFILL_PACK_CENTS,
  REFILL_PACK_DAYS,
  refillCheckoutParams,
  refillNotice,
  type RefillPurchase,
  settleRefillPurchase,
} from "./premier-purchase.ts";
import { type StripeCall } from "./stripe.ts";

type Result = { data?: unknown; error: { message: string } | null };

/** Table calls pop the next scripted result for `table.op`; RPCs by name. */
function fakeAdmin(script: Record<string, Result[]>) {
  const log: string[] = [];
  const next = (k: string): Result => script[k]?.shift() ?? { data: null, error: null };
  const chain = (k: string) => {
    const c: Record<string, unknown> = {};
    for (const m of ["eq", "in", "lt", "order", "limit", "select"]) c[m] = () => c;
    c.maybeSingle = () => Promise.resolve((log.push(k), next(k)));
    c.then = (res: (r: Result) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve((log.push(k), next(k))).then(res, rej);
    return c;
  };
  const admin = {
    from: (table: string) => ({
      select: () => chain(`${table}.select`),
      update: () => chain(`${table}.update`),
    }),
    rpc: (name: string) => Promise.resolve((log.push(`rpc.${name}`), next(`rpc.${name}`))),
  } as unknown as SupabaseClient;
  return { admin, log };
}

function fakeStripe(answers: Record<string, unknown>) {
  const calls: string[] = [];
  const stripe: StripeCall = (method, path, _params, opts) => {
    const key = `${method} ${path}`;
    calls.push(opts?.idempotencyKey ? `${key} [${opts.idempotencyKey}]` : key);
    const a = answers[key];
    if (a instanceof Error) return Promise.reject(a);
    return Promise.resolve((a ?? {}) as Record<string, unknown>);
  };
  return { stripe, calls };
}

const T0 = Date.parse("2026-11-03T12:00:00Z");

const OPEN: RefillPurchase = {
  id: "u1",
  place_id: "p1",
  tier: 2,
  amount_cents: 15000,
  currency: "usd",
  livemode: false,
  status: "open",
  stripe_checkout_session_id: "cs_1",
  stripe_payment_intent_id: null,
  refusal_code: null,
  ends_at: null,
  created_at: new Date(T0).toISOString(),
};

const PAID_SESSION = {
  metadata: { purchase_id: "u1" },
  payment_status: "paid",
  status: "complete",
  payment_intent: "pi_1",
  amount_total: 15000,
  currency: "usd",
  livemode: false,
};

Deno.test("packs: one year, 2X $100 and 5X $1,000, card only, USD", () => {
  assertEquals(REFILL_PACK_DAYS, 365);
  assertEquals(REFILL_PACK_CENTS, { 1: 10000, 2: 100000 });
  const p = refillCheckoutParams({
    customer: "cus_1",
    purchaseId: "u1",
    placeId: "p1",
    consumerId: "c1",
    tier: 1,
    placeName: "Bar",
    returnUrl: "https://mesita.ai/place/x",
    nowSec: 1000,
  }) as Record<string, unknown> & { line_items: Array<{ price_data: { unit_amount: number; currency: string } }> };
  assertEquals(p.mode, "payment");
  assertEquals(p.payment_method_types, ["card"]);
  assertEquals(p.line_items[0].price_data.unit_amount, 10000);
  assertEquals(p.line_items[0].price_data.currency, "usd");
  assertEquals(p.success_url, "https://mesita.ai/place/x?refill={CHECKOUT_SESSION_ID}");
});

Deno.test("parseRefillStart: tier 1 or 2 and a Mesita return address", () => {
  const place_id = "00000000-0000-4000-8000-000000000001";
  assertEquals(parseRefillStart({ place_id, tier: 3, return_url: "https://mesita.ai" }).ok, false);
  assertEquals(parseRefillStart({ place_id, tier: 2, return_url: "https://evil.example" }).ok, false);
  assertEquals(parseRefillStart({ place_id, tier: 2, return_url: "https://mesita.ai/p" }).ok, true);
});

Deno.test("notice: only when the place already runs at or above the tier", () => {
  const until = "2026-12-03T12:00:00Z";
  assertEquals(refillNotice({ result: "ok", level: 0, name: null, already: false, until }, 1), undefined);
  assertEquals(
    refillNotice({ result: "ok", level: 2, name: null, already: true, until }, 2),
    "This place already has Mesita Max; your Upgrade keeps Mesita Max until Dec 3",
  );
  assertEquals(refillNotice({ result: "refused", code: "paid_higher", level: 2, name: null, already: true, until }, 1), undefined);
});

Deno.test("purchaseLine: one guest line per status", () => {
  const at = "2026-12-03T12:00:00Z";
  assertEquals(purchaseLine({ status: "open", tier: 1, ends_at: null }), "Waiting for payment");
  assertEquals(purchaseLine({ status: "expired", tier: 1, ends_at: null }), "Checkout expired, nothing charged");
  assertEquals(purchaseLine({ status: "paid", tier: 1, ends_at: null }), "Paid — the Upgrade is being added");
  assertEquals(purchaseLine({ status: "granted", tier: 2, ends_at: at }), "Added: Mesita Max until Dec 3");
  assertEquals(purchaseLine({ status: "refunded", tier: 1, ends_at: null }), "Refunded");
  assertEquals(purchaseLine({ status: "refund_needed", tier: 1, ends_at: null }), "Paid — we will refund you");
});

Deno.test("settle: a paid session of this purchase adds the days", async () => {
  const { admin, log } = fakeAdmin({ "rpc.premier_refill_settle": [{ data: { outcome: "granted" }, error: null }] });
  const { stripe, calls } = fakeStripe({ "GET checkout/sessions/cs_1": PAID_SESSION });
  assertEquals(await settleRefillPurchase(admin, stripe, OPEN, T0), "granted");
  assertEquals(calls, ["GET checkout/sessions/cs_1"]);
  assertEquals(log, ["rpc.premier_refill_settle"]);
});

Deno.test("settle: a session with another amount, currency or mode never adds days", async () => {
  for (const wrong of [{ amount_total: 1500 }, { currency: "mxn" }, { livemode: true }, { metadata: { purchase_id: "u2" } }]) {
    const { admin, log } = fakeAdmin({});
    const { stripe } = fakeStripe({ "GET checkout/sessions/cs_1": { ...PAID_SESSION, ...wrong } });
    assertEquals(await settleRefillPurchase(admin, stripe, OPEN, T0), "open");
    assertEquals(log, []);
  }
});

Deno.test("settle: an unpaid session waits; an expired one closes the purchase", async () => {
  const pending = fakeAdmin({});
  const s1 = fakeStripe({ "GET checkout/sessions/cs_1": { ...PAID_SESSION, payment_status: "unpaid", status: "open" } });
  assertEquals(await settleRefillPurchase(pending.admin, s1.stripe, OPEN, T0), "open");
  assertEquals(pending.log, []);

  const gone = fakeAdmin({ "premier_refill_purchases.update": [{ data: [{ id: "u1" }], error: null }] });
  const s2 = fakeStripe({ "GET checkout/sessions/cs_1": { ...PAID_SESSION, payment_status: "unpaid", status: "expired" } });
  assertEquals(await settleRefillPurchase(gone.admin, s2.stripe, OPEN, T0), "expired");
  assertEquals(gone.log, ["premier_refill_purchases.update"]);
});

Deno.test("settle: refused in TEST is refunded once, keyed by the purchase; settling again calls nothing", async () => {
  const { admin, log } = fakeAdmin({
    "rpc.premier_refill_settle": [{ data: { outcome: "refused", code: "paid_higher" }, error: null }],
    "premier_refill_purchases.update": [{ data: [{ status: "refunded" }], error: null }],
  });
  const { stripe, calls } = fakeStripe({ "GET checkout/sessions/cs_1": PAID_SESSION, "POST refunds": { id: "re_1" } });
  assertEquals(await settleRefillPurchase(admin, stripe, OPEN, T0), "refunded");
  assertEquals(calls, ["GET checkout/sessions/cs_1", "POST refunds [refill-refund-u1]"]);
  assertEquals(log, ["rpc.premier_refill_settle", "premier_refill_purchases.update"]);

  // The second run reads the purchase as refunded and leaves it.
  const again = fakeStripe({});
  assertEquals(await settleRefillPurchase(admin, again.stripe, { ...OPEN, status: "refunded" }, T0), "refunded");
  assertEquals(again.calls, []);
});

Deno.test("settle: a paid purchase left mid-refund is refunded with the same key", async () => {
  const { admin } = fakeAdmin({
    "rpc.premier_refill_settle": [{ data: { outcome: "refused", replayed: true, code: "paid_higher" }, error: null }],
    "premier_refill_purchases.update": [{ data: [{ status: "refunded" }], error: null }],
  });
  const { stripe, calls } = fakeStripe({ "POST refunds": { id: "re_1" } });
  const paid = { ...OPEN, status: "paid" as const, stripe_payment_intent_id: "pi_1", refusal_code: "paid_higher" };
  assertEquals(await settleRefillPurchase(admin, stripe, paid, T0), "refunded");
  assertEquals(calls, ["POST refunds [refill-refund-u1]"]);
});

Deno.test("settle: refused in live is never refunded by code: refund_needed", async () => {
  const { admin } = fakeAdmin({
    "rpc.premier_refill_settle": [{ data: { outcome: "refused", code: "cap_reached" }, error: null }],
    "premier_refill_purchases.update": [{ data: [{ status: "refund_needed" }], error: null }],
  });
  const { stripe, calls } = fakeStripe({ "GET checkout/sessions/cs_1": { ...PAID_SESSION, livemode: true } });
  assertEquals(await settleRefillPurchase(admin, stripe, { ...OPEN, livemode: true }, T0), "refund_needed");
  assertEquals(calls, ["GET checkout/sessions/cs_1"]);
});

Deno.test("settle: a refund Stripe refuses leaves refund_needed", async () => {
  const { admin } = fakeAdmin({
    "rpc.premier_refill_settle": [{ data: { outcome: "refused", code: "paid_higher" }, error: null }],
    "premier_refill_purchases.update": [{ data: [{ status: "refund_needed" }], error: null }],
  });
  const { stripe } = fakeStripe({ "GET checkout/sessions/cs_1": PAID_SESSION, "POST refunds": new Error("boom") });
  assertEquals(await settleRefillPurchase(admin, stripe, OPEN, T0), "refund_needed");
});
