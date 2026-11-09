// MESITA-3303 — the money rules of selling a voucher: who can buy what, why
// not, what the Checkout on the connected account carries, and that a
// refused Checkout leaves a `failed` row and never a dangling `opening` one.

import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { type StripeCall, StripeError } from "./boost.ts";
import { MESITA_FEE_BPS_VOUCHER, MIN_CHARGE_CENTS, VOUCHER_CATALOG, voucherFeeCents } from "./money.ts";
import type { AccountRow, PaymentSettings } from "./payments.ts";
import { buyRefusal, CATALOG_LINES, storyRefusal, offerFrom, openVoucherCheckout, overPlaceCap, PLACE_CAP_CENTS, voucherCheckoutParams } from "./vouchers.ts";

const PLACE = "00000000-0000-4000-8000-0000000a3303";
const GUEST = "00000000-0000-4000-8000-0000000b3303";
const REQUEST = "00000000-0000-4000-8000-0000000c3303";
const ROW = "00000000-0000-4000-8000-0000000d3303";

const ALL_ON: PaymentSettings = {
  pay_cards: true,
  cashback: true,
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

const base = { settings: ALL_ON, account: ACCOUNT, livemode: false, currency: "mxn", paused: false, balance: null, welcomeUsed: false };

Deno.test("MX$200, MX$1,000, Welcome and Story sell (MESITA-3507); the rest say why", () => {
  const o = offerFrom(base);
  assertEquals(o.sell, ["voucher_200", "voucher_1000", "voucher_welcome", "voucher_story"]);
  assertEquals(o.unavailable, { voucher_5000: "not_yet", voucher_vip: "needs_card_payments" });
  assertEquals(o.test_mode, true);
  assertEquals(o.charges_enabled, true);
  assertEquals(o.cashback, true);
  assertEquals(o.mesita_pay, true);
  assertEquals("pay_cards" in o.vouchers || "cashback" in o.vouchers, false);
  assertEquals(o.catalog.voucher_200, { price_cents: 20000, bonus_cents: 2000, credit_cents: 22000, available_after_sec: 3600 });
  // Every voucher waits an hour except Story (MESITA-3323).
  assertEquals(o.catalog.voucher_welcome.available_after_sec, 3600);
  assertEquals(o.catalog.voucher_story.available_after_sec, 0);
});

Deno.test("the catalog the client shows is the server's, credit = price + bonus", () => {
  for (const [k, line] of Object.entries(CATALOG_LINES)) {
    const v = VOUCHER_CATALOG[k as keyof typeof VOUCHER_CATALOG];
    assertEquals(line.price_cents, v.price_cents);
    assertEquals(line.credit_cents, line.price_cents + line.bonus_cents);
  }
});

Deno.test("paused stops every sale; Welcome once; an account from the other universe cannot charge", () => {
  assertEquals(offerFrom({ ...base, paused: true }).sell, []);
  assertEquals(offerFrom({ ...base, paused: true }).unavailable.voucher_200, "paused");
  const used = offerFrom({ ...base, welcomeUsed: true });
  assertEquals(used.sell, ["voucher_200", "voucher_1000", "voucher_story"]);
  assertEquals(used.unavailable.voucher_welcome, "used");
  const live = offerFrom({ ...base, livemode: true });
  assertEquals(live.sell, []);
  assertEquals(live.unavailable.voucher_200, "needs_account");
  assertEquals(live.charges_enabled, false);
  assertEquals(live.cashback, false);
  const none = offerFrom({ ...base, account: null });
  assertEquals(none.unavailable.voucher_200, "needs_account");
});

Deno.test("Story is one each new visit (MESITA-3463): spent reads needs_visit and the buy door refuses it", () => {
  const spent = offerFrom({ ...base, perVisitUsed: { voucher_story: true } });
  assertEquals(spent.sell, ["voucher_200", "voucher_1000", "voucher_welcome"]);
  assertEquals(spent.unavailable.voucher_story, "needs_visit");
  assertEquals(buyRefusal(spent, "voucher_story", ACCOUNT)?.code, "needs_visit");
  assertEquals(offerFrom({ ...base, perVisitUsed: { voucher_story: false } }).sell.includes("voucher_story"), true);
});

Deno.test("buyRefusal: codes for every closed door, null for an open one", () => {
  const o = offerFrom(base);
  assertEquals(buyRefusal(o, "voucher_200", ACCOUNT), null);
  assertEquals(buyRefusal(o, "voucher_5000", ACCOUNT)?.code, "not_yet");
  assertEquals(buyRefusal(o, "voucher_vip", ACCOUNT)?.code, "needs_card_payments");
  assertEquals(buyRefusal(o, "voucher_story", ACCOUNT), null);
  assertEquals(buyRefusal(offerFrom({ ...base, paused: true }), "voucher_200", ACCOUNT)?.code, "paused");
  assertEquals(buyRefusal(offerFrom({ ...base, welcomeUsed: true }), "voucher_welcome", ACCOUNT)?.code, "welcome_used");
  assertEquals(buyRefusal(offerFrom({ ...base, account: null }), "voucher_200", null)?.code, "no_account");
  const off = offerFrom({ ...base, settings: { ...ALL_ON, voucher_200: false } });
  assertEquals(buyRefusal(off, "voucher_200", ACCOUNT)?.code, "not_available");
  // The place sells in pesos; a US account settles in dollars.
  const us = { ...ACCOUNT, account_country: "US" };
  assertEquals(buyRefusal(offerFrom({ ...base, account: us }), "voucher_200", us)?.code, "currency_mismatch");
  assertEquals(buyRefusal(offerFrom({ ...base, currency: "usd" }), "voucher_200", ACCOUNT)?.code, "currency_mismatch");
  // Every sellable price clears Stripe's minimum.
  for (const k of o.sell) assertEquals(CATALOG_LINES[k].price_cents >= MIN_CHARGE_CENTS.mxn, true);
});

Deno.test("the Checkout: payment mode, the fee as application fee, the row id in metadata and client_reference_id, success to the Wallet", () => {
  const p = voucherCheckoutParams({
    purchaseId: ROW,
    placeId: PLACE,
    consumerId: GUEST,
    email: "guest@example.com",
    voucher: "voucher_200",
    currency: "mxn",
    placeName: "Strana",
    returnUrl: "https://mesita.ai/place/strana",
    nowSec: 1_000_000,
  });
  assertEquals(p.mode, "payment");
  assertEquals(p.client_reference_id, ROW);
  assertEquals(p.customer_email, "guest@example.com");
  assertEquals(p.success_url, "https://mesita.ai/wallet?prepay={CHECKOUT_SESSION_ID}");
  assertEquals(p.cancel_url, "https://mesita.ai/place/strana");
  assertEquals(p.expires_at, 1_000_000 + 31 * 60);
  const items = p.line_items as Array<{ quantity: number; price_data: { currency: string; unit_amount: number } }>;
  assertEquals(items.length, 1);
  assertEquals(items[0].price_data.unit_amount, 20000);
  assertEquals(items[0].price_data.currency, "mxn");
  const pid = p.payment_intent_data as { application_fee_amount: number; metadata: Record<string, string> };
  assertEquals(pid.application_fee_amount, voucherFeeCents("voucher_200"));
  assertEquals(pid.application_fee_amount, Math.floor((20000 * MESITA_FEE_BPS_VOUCHER) / 10000));
  assertEquals(pid.metadata.purchase_id, ROW);
  assertEquals((p.metadata as Record<string, string>).mesita_kind, "wallet_voucher");
  assertEquals((p.metadata as Record<string, string>).voucher, "voucher_200");
  // No platform customer: the charge is the place's.
  assertEquals("customer" in p, false);
});

type Fake = {
  admin: SupabaseClient;
  inserts: Array<Record<string, unknown>>;
  updates: Array<{ patch: Record<string, unknown>; eq: Record<string, unknown> }>;
};

/** A wallet_purchases table of one insert and its updates; the place's
 *  outstanding credit (MESITA-3305's cap) answers `outstanding`, 0 by default. */
function fakeAdmin(opts: { insertError?: { code: string; message: string }; existing?: Record<string, unknown> | null; outstanding?: number }): Fake {
  const inserts: Fake["inserts"] = [];
  const updates: Fake["updates"] = [];
  const admin = {
    rpc: (name: string) => {
      assertEquals(name, "wallet_place_outstanding");
      return Promise.resolve({ data: opts.outstanding ?? 0, error: null });
    },
    from: (table: string) => {
      assertEquals(table, "wallet_purchases");
      return {
        insert: (row: Record<string, unknown>) => {
          inserts.push(row);
          return {
            select: () => ({
              single: () => Promise.resolve(opts.insertError ? { data: null, error: opts.insertError } : { data: { id: ROW }, error: null }),
            }),
          };
        },
        update: (patch: Record<string, unknown>) => {
          const eq: Record<string, unknown> = {};
          const chain = {
            eq: (k: string, v: unknown) => {
              eq[k] = v;
              return chain;
            },
            then: (resolve: (v: { error: null }) => void) => {
              updates.push({ patch, eq });
              resolve({ error: null });
            },
          };
          return chain;
        },
        select: () => {
          const chain = {
            eq: () => chain,
            maybeSingle: () => Promise.resolve({ data: opts.existing ?? null, error: null }),
          };
          return chain;
        },
      };
    },
  } as unknown as SupabaseClient;
  return { admin, inserts, updates };
}

const BUY = {
  consumerId: GUEST,
  email: null,
  place: { id: PLACE, name: "Strana", state: "active", currency: "MXN" },
  account: ACCOUNT,
  voucher: "voucher_200" as const,
  currency: "mxn",
  requestId: REQUEST,
  returnUrl: "https://mesita.ai/place/strana",
  livemode: false,
  nowSec: 1_000_000,
};

Deno.test("a buy: one opening row under the request_id, one Checkout on the account keyed by the row, then open with its session", async () => {
  const fake = fakeAdmin({});
  const calls: Array<{ method: string; path: string; opts?: Record<string, unknown> }> = [];
  const stripe: StripeCall = (method, path, _params, opts) => {
    calls.push({ method, path, opts: opts as Record<string, unknown> });
    return Promise.resolve({ id: "cs_1", url: "https://checkout.stripe.com/c/cs_1" });
  };
  const r = await openVoucherCheckout(fake.admin, stripe, BUY);
  assertEquals(r, { ok: true, url: "https://checkout.stripe.com/c/cs_1", purchase_id: ROW });
  assertEquals(fake.inserts.length, 1);
  const row = fake.inserts[0];
  assertEquals(row.status, "opening");
  assertEquals(row.request_id, REQUEST);
  assertEquals(row.stripe_account_id, "acct_place");
  assertEquals(row.amount_cents, 20000);
  assertEquals(row.bonus_cents, 2000);
  assertEquals(row.application_fee_cents, voucherFeeCents("voucher_200"));
  assertEquals(row.voucher, "voucher_200");
  assertEquals(row.livemode, false);
  assertEquals(calls, [{ method: "POST", path: "checkout/sessions", opts: { idempotencyKey: ROW, stripeAccount: "acct_place" } }]);
  assertEquals(fake.updates.length, 1);
  assertEquals(fake.updates[0].patch.status, "open");
  assertEquals(fake.updates[0].patch.stripe_checkout_session_id, "cs_1");
  assertEquals(fake.updates[0].eq, { id: ROW, status: "opening" });
});

Deno.test("Stripe refuses: the row reads failed with the code, the guest gets 502 checkout_failed", async () => {
  const fake = fakeAdmin({});
  const stripe: StripeCall = () => Promise.reject(new StripeError("checkout/sessions", "invalid_request_error", "account_invalid", 400, "no"));
  const r = await openVoucherCheckout(fake.admin, stripe, BUY);
  assertEquals(r, { ok: false, status: 502, code: "checkout_failed", error: "Stripe refused the checkout: account_invalid" });
  assertEquals(fake.updates.length, 1);
  assertEquals(fake.updates[0].patch.status, "failed");
  assertEquals(fake.updates[0].patch.stripe_error, "account_invalid");
  assertEquals(fake.updates[0].eq, { id: ROW, status: "opening" });
});

Deno.test("the same request_id again: the open session's url, never a second charge", async () => {
  const fake = fakeAdmin({
    insertError: { code: "23505", message: "duplicate" },
    existing: { id: ROW, status: "open", stripe_checkout_session_id: "cs_1" },
  });
  const calls: string[] = [];
  const stripe: StripeCall = (method, path) => {
    calls.push(`${method} ${path}`);
    return Promise.resolve({ id: "cs_1", status: "open", url: "https://checkout.stripe.com/c/cs_1" });
  };
  const r = await openVoucherCheckout(fake.admin, stripe, BUY);
  assertEquals(r, { ok: true, url: "https://checkout.stripe.com/c/cs_1", purchase_id: ROW });
  assertEquals(calls, ["GET checkout/sessions/cs_1"]);
  assertEquals(fake.updates.length, 0);
});

Deno.test("the same request_id on a closed row is a refusal, not a new row", async () => {
  const fake = fakeAdmin({ insertError: { code: "23505", message: "duplicate" }, existing: { id: ROW, status: "failed", stripe_checkout_session_id: null } });
  const stripe: StripeCall = () => Promise.reject(new Error("never called"));
  const r = await openVoucherCheckout(fake.admin, stripe, BUY);
  assertEquals(r.ok, false);
  assertEquals((r as { code: string }).code, "checkout_failed");
});

Deno.test("any other insert error is thrown, so the EF answers 500 and nothing reaches Stripe", async () => {
  const fake = fakeAdmin({ insertError: { code: "42501", message: "denied" } });
  const stripe: StripeCall = () => Promise.reject(new Error("never called"));
  await assertRejects(() => openVoucherCheckout(fake.admin, stripe, BUY), Error, "purchase_insert");
});

// ── MESITA-3305: the test-mode cap and a second Welcome buy ─────────────────

Deno.test("place_cap: a buy that would push the place past MX$20,000 of outstanding credit is refused in test mode, never live", async () => {
  // MX$19,790 outstanding + MX$220 of credit from a MX$200 voucher = MX$20,010.
  const fake = fakeAdmin({ outstanding: 19_790_00 });
  const stripe: StripeCall = () => Promise.reject(new Error("never called"));
  const r = await openVoucherCheckout(fake.admin, stripe, BUY);
  assertEquals(r.ok, false);
  assertEquals((r as { code: string }).code, "place_cap");
  assertEquals(fake.inserts.length, 0);
  assertEquals(overPlaceCap(19_790_00, "voucher_200", false), true);
  assertEquals(overPlaceCap(19_780_00, "voucher_200", false), false);
  assertEquals(overPlaceCap(19_790_00, "voucher_200", true), false);
  assertEquals(PLACE_CAP_CENTS, 20_000_00);
});

Deno.test("a second Welcome buy while the first one's Checkout is open answers in_progress with that url, never a 500", async () => {
  const fake = fakeAdmin({ insertError: { code: "23505", message: "welcome once" }, existing: null });
  // The request_id read finds nothing; the Welcome read finds the open row.
  let reads = 0;
  const admin = {
    rpc: fake.admin.rpc,
    from: (table: string) => {
      assertEquals(table, "wallet_purchases");
      return {
        insert: (fake.admin.from(table) as unknown as { insert: unknown }).insert,
        select: () => {
          const chain = {
            eq: () => chain,
            in: () => chain,
            maybeSingle: () => {
              reads++;
              return Promise.resolve({ data: reads === 1 ? null : { id: ROW, status: "open", stripe_checkout_session_id: "cs_w" }, error: null });
            },
          };
          return chain;
        },
      };
    },
  } as unknown as SupabaseClient;
  const stripe: StripeCall = (_m, path) => {
    assertEquals(path, "checkout/sessions/cs_w");
    return Promise.resolve({ status: "open", url: "https://checkout.stripe.com/c/w" });
  };
  const r = await openVoucherCheckout(admin, stripe, { ...BUY, voucher: "voucher_welcome", requestId: "00000000-0000-4000-8000-0000000e3303" });
  assertEquals(r, { ok: false, status: 409, code: "in_progress", error: "Your Welcome voucher's checkout is still open", url: "https://checkout.stripe.com/c/w" });
});

Deno.test("the mark (MESITA-3408) is taken before Welcome-used and the pause, so it matches the list rows", () => {
  // Pay by phone off, so only the voucher can light the mark.
  const onlyWelcome: PaymentSettings = { ...ALL_ON, pay_cards: false, voucher_200: false, voucher_1000: false, voucher_5000: false, voucher_story: false, voucher_vip: false };
  const used = offerFrom({ ...base, settings: onlyWelcome, welcomeUsed: true });
  assertEquals(used.sell, []);
  assertEquals(used.mesita_pay, true);
  assertEquals(offerFrom({ ...base, settings: onlyWelcome, paused: true }).mesita_pay, true);
  // Nothing on: no mark.
  const nothing: PaymentSettings = { ...onlyWelcome, voucher_welcome: false };
  assertEquals(offerFrom({ ...base, settings: nothing }).mesita_pay, false);
});

Deno.test("storyRefusal: Story needs a linked Instagram with MORE than 1,000 followers; other vouchers pass (MESITA-3507)", () => {
  assertEquals(storyRefusal("voucher_200", null), null);
  assertEquals(storyRefusal("voucher_story", null)?.code, "needs_instagram");
  assertEquals(storyRefusal("voucher_story", { instagram_handle: null, instagram_followers_count: 50_000 })?.code, "needs_instagram");
  assertEquals(storyRefusal("voucher_story", { instagram_handle: "ana", instagram_followers_count: null })?.code, "few_followers");
  assertEquals(storyRefusal("voucher_story", { instagram_handle: "ana", instagram_followers_count: 1000 })?.code, "few_followers");
  assertEquals(storyRefusal("voucher_story", { instagram_handle: "ana", instagram_followers_count: 1001 }), null);
});
