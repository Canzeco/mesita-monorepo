// MESITA-3303 — the money rules of selling a voucher: who can buy what, why
// not, what the Checkout on the connected account carries, and that a
// refused Checkout leaves a `failed` row and never a dangling `opening` one.

import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { MESITA_FEE_BPS_VOUCHER, MIN_CHARGE_CENTS, VOUCHER_CATALOG, voucherFeeCents } from "./money.ts";
import type { AccountRow, PaymentSettings } from "./payments.ts";
import {
  basketUnits,
  buyRefusal,
  CATALOG_LINES,
  offerFrom,
  openPurchaseRow,
  openVoucherCheckout,
  overCreditLimit,
  parseBasket,
  sameUnits,
  storyRefusal,
  vipRefusal,
  voucherCheckoutParams,
  voucherMetadata,
} from "./vouchers.ts";
import { type StripeCall, StripeError } from "./stripe.ts";

const PLACE = "00000000-0000-4000-8000-0000000a3303";
const GUEST = "00000000-0000-4000-8000-0000000b3303";
const REQUEST = "00000000-0000-4000-8000-0000000c3303";
const ROW = "00000000-0000-4000-8000-0000000d3303";

const ALL_ON: PaymentSettings = {
  stripe_payments: true,
  pay_cards: true,
  prepayments: true,
  house_credits: true,
  cash_payments: true,
  card_cashback_bps: 500,
  cash_cashback_bps: 200, credit_cashback_bps: null, prepay_cashback_bps: null,
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

Deno.test("every switched-on voucher sells but Story and MX$5,000, off sale (MESITA-3831, MESITA-3834)", () => {
  const o = offerFrom(base);
  assertEquals(o.sell, ["voucher_200", "voucher_1000", "voucher_welcome", "voucher_vip"]);
  assertEquals(o.unavailable, { voucher_5000: "not_yet", voucher_story: "not_yet" });
  assertEquals(o.test_mode, true);
  assertEquals(o.charges_enabled, true);
  assertEquals(o.cashback, true);
  assertEquals(o.mesita_pay, true);
  assertEquals("pay_cards" in o.vouchers || "cashback" in o.vouchers, false);
  assertEquals(o.catalog.voucher_200, { price_cents: 10000, bonus_cents: 1000, credit_cents: 11000, available_after_sec: 3600 });
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
  assertEquals(used.sell, ["voucher_200", "voucher_1000", "voucher_vip"]);
  assertEquals(used.unavailable.voucher_welcome, "used");
  const live = offerFrom({ ...base, livemode: true });
  assertEquals(live.sell, []);
  assertEquals(live.unavailable.voucher_200, "needs_account");
  assertEquals(live.charges_enabled, false);
  assertEquals(live.cashback, false);
  const none = offerFrom({ ...base, account: null });
  assertEquals(none.unavailable.voucher_200, "needs_account");
});

// Story's one-each-new-visit rule (MESITA-3463) is unreachable while Story is
// parked; the parked reason wins and the buy door refuses it.
Deno.test("Story is parked (MESITA-3831): not_yet, whatever the visit count, and the buy door refuses it; VIP sells (MESITA-3833)", () => {
  const o = offerFrom({ ...base, perVisitUsed: { voucher_story: true } });
  assertEquals(o.sell, ["voucher_200", "voucher_1000", "voucher_welcome", "voucher_vip"]);
  assertEquals(o.unavailable.voucher_story, "not_yet");
  assertEquals(buyRefusal(o, "voucher_story", ACCOUNT)?.code, "not_yet");
  assertEquals(buyRefusal(o, "voucher_vip", ACCOUNT), null);
});

Deno.test("buyRefusal: codes for every closed door, null for an open one", () => {
  const o = offerFrom(base);
  assertEquals(buyRefusal(o, "voucher_200", ACCOUNT), null);
  assertEquals(buyRefusal(o, "voucher_5000", ACCOUNT)?.code, "not_yet");
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
  // The place's House Card, never the Wallet's rails (MESITA-3617).
  assertEquals(p.success_url, `https://mesita.ai/wallet/${PLACE}?prepay={CHECKOUT_SESSION_ID}`);
  assertEquals(p.cancel_url, "https://mesita.ai/place/strana");
  assertEquals(p.expires_at, 1_000_000 + 31 * 60);
  const items = p.line_items as Array<{ quantity: number; price_data: { currency: string; unit_amount: number } }>;
  assertEquals(items.length, 1);
  assertEquals(items[0].price_data.unit_amount, 10000);
  assertEquals(items[0].price_data.currency, "mxn");
  // d5a (MESITA-3461): no application fee; the row stores the fee to bill.
  const pid = p.payment_intent_data as { application_fee_amount?: number; metadata: Record<string, string> };
  assertEquals("application_fee_amount" in pid, false);
  assertEquals(voucherFeeCents("voucher_200"), Math.floor((10000 * MESITA_FEE_BPS_VOUCHER) / 10000));
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
/** Mexico's default Credits Limit, MX$100,000 (MESITA-3947). */
const LIMIT = 100_000_00;

function fakeAdmin(opts: {
  insertError?: { code: string; message: string };
  /** A basket's follower insert (MESITA-3841). */
  followerError?: { code: string; message: string };
  existing?: Record<string, unknown> | null;
  outstanding?: number;
  /** place_credit_limit; undefined = MX$100,000, the MXN default. */
  limit?: number | null;
}): Fake {
  const inserts: Fake["inserts"] = [];
  const updates: Fake["updates"] = [];
  const admin = {
    rpc: (name: string) => {
      if (name === "place_credit_limit") return Promise.resolve({ data: opts.limit === undefined ? LIMIT : opts.limit, error: null });
      assertEquals(name, "wallet_place_outstanding");
      return Promise.resolve({ data: opts.outstanding ?? 0, error: null });
    },
    from: (table: string) => {
      assertEquals(table, "wallet_purchases");
      return {
        insert: (row: Record<string, unknown>) => {
          inserts.push(row);
          if (Array.isArray(row)) return Promise.resolve({ error: opts.followerError ?? null });
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
  assertEquals(row.amount_cents, 10000);
  assertEquals(row.bonus_cents, 1000);
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

// ── MESITA-3947: the Credits Limit; MESITA-3305: a second Welcome buy ─────────────────

Deno.test("place_cap: a buy that would take the place past its Credits Limit is refused, in test and live alike", async () => {
  // MX$99,900 outstanding + MX$110 of credit from a MX$100 voucher = MX$100,010.
  for (const livemode of [false, true]) {
    const fake = fakeAdmin({ outstanding: 99_900_00 });
    const stripe: StripeCall = () => Promise.reject(new Error("never called"));
    const r = await openVoucherCheckout(fake.admin, stripe, { ...BUY, livemode });
    assertEquals(r.ok === false && r.code, "place_cap");
    assertEquals(fake.inserts.length, 0);
  }
  assertEquals(overCreditLimit(99_900_00, "voucher_200", LIMIT), true);
  assertEquals(overCreditLimit(99_890_00, "voucher_200", LIMIT), false);
});

Deno.test("Credits Limit: landing exactly on the limit sells; a place's own limit binds; no limit refuses", async () => {
  // MX$110 of credit lands exactly on the limit: allowed (over, not at).
  assertEquals(overCreditLimit(LIMIT - 110_00, "voucher_200", LIMIT), false);
  assertEquals(overCreditLimit(LIMIT - 109_00, "voucher_200", LIMIT), true);
  // A place's own MX$500 limit, nothing owed yet: one Small sells, Big does not.
  const own = fakeAdmin({ limit: 500_00 });
  assertEquals((await openPurchaseRow(own.admin, BUY)).ok, true);
  const big = fakeAdmin({ limit: 500_00 });
  const r = await openPurchaseRow(big.admin, { ...BUY, voucher: "voucher_1000" });
  assertEquals(r.ok === false && r.code, "place_cap");
  // A currency without a default: fail closed.
  assertEquals(overCreditLimit(0, "voucher_200", null), true);
  // A limit of 0 stops every sale.
  assertEquals(overCreditLimit(0, "voucher_200", 0), true);
  // USD: US$10 Small gives US$11 of credit against US$10,000.
  assertEquals(overCreditLimit(10_000_00 - 11_00, "voucher_200", 10_000_00, "usd"), false);
  assertEquals(overCreditLimit(10_000_00 - 10_00, "voucher_200", 10_000_00, "usd"), true);
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

Deno.test("vipRefusal: VIP needs the VIP class, not past vip_until; other vouchers pass (MESITA-3550)", () => {
  const today = "2026-11-09";
  const vip = { guest_class: "vip", vip_until: null };
  assertEquals(vipRefusal("voucher_200", null, today), null);
  assertEquals(vipRefusal("voucher_vip", null, today)?.code, "not_vip");
  assertEquals(vipRefusal("voucher_vip", { ...vip, guest_class: "regular" }, today)?.code, "not_vip");
  assertEquals(vipRefusal("voucher_vip", vip, today), null);
  // vip_until is the last day VIP holds.
  assertEquals(vipRefusal("voucher_vip", { ...vip, vip_until: today }, today), null);
  assertEquals(vipRefusal("voucher_vip", { ...vip, vip_until: "2026-11-08" }, today)?.code, "not_vip");
});

// ── The basket (MESITA-3841) ───────────────────────────────────────────────

Deno.test("parseBasket: the old voucher field is a basket of one; items need known keys, qty 1..5, one Welcome / VIP, no key twice", () => {
  assertEquals(parseBasket({ voucher: "voucher_200" }), { ok: true, items: [{ voucher: "voucher_200", qty: 1 }] });
  assertEquals(parseBasket({ items: [{ voucher: "voucher_200", qty: 2 }, { voucher: "voucher_1000", qty: 1 }] }).ok, true);
  assertEquals(parseBasket({ voucher: "bogus" }).ok, false);
  assertEquals(parseBasket({ items: [] }).ok, false);
  assertEquals(parseBasket({ items: [{ voucher: "voucher_200", qty: 6 }] }).ok, false);
  assertEquals(parseBasket({ items: [{ voucher: "voucher_200", qty: 0 }] }).ok, false);
  assertEquals(parseBasket({ items: [{ voucher: "voucher_200", qty: 1.5 }] }).ok, false);
  assertEquals(parseBasket({ items: [{ voucher: "voucher_welcome", qty: 2 }] }).ok, false);
  assertEquals(parseBasket({ items: [{ voucher: "voucher_vip", qty: 2 }] }).ok, false);
  assertEquals(parseBasket({ items: [{ voucher: "voucher_200", qty: 1 }, { voucher: "voucher_200", qty: 1 }] }).ok, false);
  assertEquals(parseBasket({ items: [{ voucher: "nope", qty: 1 }] }).ok, false);
});

Deno.test("basketUnits: one unit per row, Welcome leads; sameUnits compares baskets as multisets", () => {
  const units = basketUnits([{ voucher: "voucher_200", qty: 2 }, { voucher: "voucher_welcome", qty: 1 }, { voucher: "voucher_1000", qty: 1 }]);
  assertEquals(units, ["voucher_welcome", "voucher_200", "voucher_200", "voucher_1000"]);
  assertEquals(sameUnits(["voucher_200", "voucher_1000"], ["voucher_1000", "voucher_200"]), true);
  assertEquals(sameUnits(["voucher_200"], ["voucher_200", "voucher_200"]), false);
  assertEquals(sameUnits([], []), true);
});

Deno.test("the Credits Limit counts the whole basket's credit", () => {
  // 2× Small (MX$110 credit each) + Big (MX$1,200): MX$1,420.
  const basket = ["voucher_200", "voucher_200", "voucher_1000"] as const;
  assertEquals(overCreditLimit(LIMIT - 1_420_00, basket, LIMIT), false);
  assertEquals(overCreditLimit(LIMIT - 1_419_00, basket, LIMIT), true);
});

Deno.test("a basket's rows: the lead under the request_id, one follower row per other unit pointing to it, no request_id", async () => {
  const fake = fakeAdmin({});
  const r = await openPurchaseRow(fake.admin, { ...BUY, followers: ["voucher_200", "voucher_1000"] });
  assertEquals(r, { ok: true, duplicate: false, purchaseId: ROW });
  assertEquals(fake.inserts.length, 2);
  assertEquals(fake.inserts[0].request_id, REQUEST);
  const followers = fake.inserts[1] as unknown as Array<Record<string, unknown>>;
  assertEquals(followers.map((f) => [f.voucher, f.amount_cents, f.bonus_cents, f.basket_lead_id, f.status, "request_id" in f]), [
    ["voucher_200", 10000, 1000, ROW, "opening", false],
    ["voucher_1000", 100000, 20000, ROW, "opening", false],
  ]);
});

Deno.test("a basket the Credits Limit refuses writes no row; a follower the database refuses fails the lead (all or nothing)", async () => {
  const capped = fakeAdmin({ outstanding: LIMIT - 200_00 });
  const r = await openPurchaseRow(capped.admin, { ...BUY, followers: ["voucher_200"] });
  assertEquals(r.ok === false && r.code, "place_cap");
  assertEquals(capped.inserts.length, 0);

  const broken = fakeAdmin({ followerError: { code: "XX000", message: "boom" } });
  await assertRejects(() => openPurchaseRow(broken.admin, { ...BUY, followers: ["voucher_200"] }), Error, "basket_insert");
  assertEquals(broken.updates.map((u) => [u.patch.status, u.patch.stripe_error, u.eq]), [["failed", "basket_write", { id: ROW, status: "opening" }]]);
});

Deno.test("a basket's metadata names the lead and carries the sums; a single voucher's is unchanged", () => {
  const one = voucherMetadata({ purchaseId: ROW, placeId: PLACE, consumerId: GUEST, voucher: "voucher_200" });
  assertEquals(one, {
    mesita_kind: "wallet_voucher",
    purchase_id: ROW,
    place_id: PLACE,
    consumer_id: GUEST,
    voucher: "voucher_200",
    amount_cents: "10000",
    bonus_cents: "1000",
  });
  const many = voucherMetadata({ purchaseId: ROW, placeId: PLACE, consumerId: GUEST, voucher: "voucher_200", followers: ["voucher_200", "voucher_1000"] });
  assertEquals(many.purchase_id, ROW);
  assertEquals(many.amount_cents, "120000");
  assertEquals(many.bonus_cents, "22000");
  assertEquals(many.basket, "3");
  assertEquals(many.basket_items, "voucher_200x2,voucher_1000x1");
});
