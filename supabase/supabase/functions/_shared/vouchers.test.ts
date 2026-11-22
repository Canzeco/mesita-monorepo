// MESITA-3303 — the money rules of selling a voucher: who can buy what, why
// not, and the `opening` row a buy writes (the Checkout went with MESITA-4065;
// the saved-card charge is voucher-card.test.ts).

import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { MIN_CHARGE_CENTS, VOUCHER_CATALOG, voucherFeeCents } from "./money.ts";
import type { AccountRow, PaymentSettings } from "./payments.ts";
import {
  basketUnits,
  buyRefusal,
  guestReason,
  vipRefusal,
  CATALOG_LINES,
  guestBlocksFrom,
  guestSell,
  offerFrom,
  openPurchaseRow,
  overCreditLimit,
  parseBasket,
  sameUnits,
  voucherMetadata,
} from "./vouchers.ts";

const PLACE = "00000000-0000-4000-8000-0000000a3303";
const GUEST = "00000000-0000-4000-8000-0000000b3303";
const REQUEST = "00000000-0000-4000-8000-0000000c3303";
const ROW = "00000000-0000-4000-8000-0000000d3303";

const ALL_ON: PaymentSettings = {
  stripe_payments: true,
  pay_cards: true,
  prepayments: true,
  loyalty_cards: true,
  cash_payments: true,
  voucher_welcome: true,
  voucher_200: true,
  voucher_1000: true,
  voucher_5000: true,
  voucher_vip: false,
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

Deno.test("every switched-on voucher sells, Welcome first (MESITA-4645); VIP off here reads off (MESITA-4640); Medium is back (MESITA-4056)", () => {
  const o = offerFrom(base);
  assertEquals(o.sell, ["voucher_welcome", "voucher_200", "voucher_1000", "voucher_5000"]);
  assertEquals(o.unavailable, { voucher_vip: "off" });
  assertEquals(o.test_mode, true);
  assertEquals(o.charges_enabled, true);
  assertEquals(o.mesita_pay, true);
  assertEquals("pay_cards" in o.vouchers, false);
  assertEquals(o.catalog.voucher_200, { price_cents: 20000, bonus_cents: 2000, credit_cents: 22000, available_after_sec: 10800 });
  // Welcome is back (MESITA-4645): MX$100 +100%, its bonus in 3 hours. No
  // Story (MESITA-4642) in the catalog.
  assertEquals(o.catalog.voucher_welcome, { price_cents: 10000, bonus_cents: 10000, credit_cents: 20000, available_after_sec: 10800 });
  assertEquals("voucher_story" in o.catalog, false);
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
  assertEquals(used.sell, ["voucher_200", "voucher_1000", "voucher_5000"]);
  assertEquals(used.unavailable.voucher_welcome, "used");
  const live = offerFrom({ ...base, livemode: true });
  assertEquals(live.sell, []);
  assertEquals(live.unavailable.voucher_200, "needs_account");
  assertEquals(live.charges_enabled, false);
  const none = offerFrom({ ...base, account: null });
  assertEquals(none.unavailable.voucher_200, "needs_account");
});

Deno.test("Story is retired (MESITA-4641): a basket naming it is refused with voucher_retired", () => {
  const one = parseBasket({ voucher: "voucher_story" });
  assertEquals(one.ok, false);
  assertEquals(one.ok ? null : one.code, "voucher_retired");
  const mixed = parseBasket({ items: [{ voucher: "voucher_200", qty: 1 }, { voucher: "voucher_story", qty: 1 }] });
  assertEquals(mixed.ok ? null : mixed.code, "voucher_retired");
  assertEquals(parseBasket({ voucher: "voucher_200" }).ok, true);
});

Deno.test("VIP is back (MESITA-4640), Welcome is back (MESITA-4645)", () => {
  assertEquals(parseBasket({ voucher: "voucher_vip" }).ok, true);
  assertEquals(parseBasket({ voucher: "voucher_welcome" }).ok, true);
  // One Welcome a basket: it is once per guest per place.
  assertEquals(parseBasket({ items: [{ voucher: "voucher_welcome", qty: 2 }] }).ok, false);
  // One VIP a basket: it is one each new visit.
  assertEquals(parseBasket({ items: [{ voucher: "voucher_vip", qty: 2 }] }).ok, false);
});

Deno.test("vipRefusal: only the VIP class buys the VIP voucher; the 409 names the guest's own facts", () => {
  assertEquals(vipRefusal("voucher_vip", { guest_class: "vip", followers: 6000, is_private: false }), null);
  const regular = vipRefusal("voucher_vip", { guest_class: "regular", followers: 2026, is_private: false });
  assertEquals(regular?.status, 409);
  assertEquals(regular?.code, "not_vip");
  assertEquals(regular?.followers, 2026);
  assertEquals(regular?.isPrivate, false);
  assertEquals(vipRefusal("voucher_vip", null)?.code, "not_vip");
  // Any other voucher passes, whatever the Class.
  assertEquals(vipRefusal("voucher_200", { guest_class: "regular", followers: 0, is_private: true }), null);
});

Deno.test("VIP is one each new visit (MESITA-4640)", () => {
  assertEquals(guestReason("voucher_vip", { welcomeUsed: false, perVisitUsed: { voucher_vip: true } }), "needs_visit");
  assertEquals(guestReason("voucher_vip", { welcomeUsed: false, perVisitUsed: { voucher_vip: false } }), null);
  // Welcome is its own gate: once per place, whatever the visits.
  assertEquals(guestReason("voucher_welcome", { welcomeUsed: true }), "used");
  assertEquals(guestReason("voucher_200", { welcomeUsed: true }), null);
});

Deno.test("buyRefusal: codes for every closed door, null for an open one", () => {
  const o = offerFrom(base);
  assertEquals(buyRefusal(o, "voucher_200", ACCOUNT), null);
  assertEquals(buyRefusal(o, "voucher_5000", ACCOUNT), null);
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

Deno.test("a buy opens one `opening` row under the request_id with the price, bonus, fee and account", async () => {
  const fake = fakeAdmin({});
  const r = await openPurchaseRow(fake.admin, BUY);
  assertEquals(r, { ok: true, duplicate: false, purchaseId: ROW });
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
});

Deno.test("any other insert error is thrown, so the EF answers 500 and nothing reaches Stripe", async () => {
  const fake = fakeAdmin({ insertError: { code: "42501", message: "denied" } });
  await assertRejects(() => openPurchaseRow(fake.admin, BUY), Error, "purchase_insert");
});

// ── MESITA-3947: the Credits Limit; MESITA-3305 ─────────────────

Deno.test("place_cap: a buy that would take the place past its Credits Limit is refused, in test and live alike", async () => {
  // MX$99,900 outstanding + MX$220 of credit from a MX$200 Small = MX$100,120.
  for (const livemode of [false, true]) {
    const fake = fakeAdmin({ outstanding: 99_900_00 });
    const r = await openPurchaseRow(fake.admin, { ...BUY, livemode });
    assertEquals(r.ok === false && r.code, "place_cap");
    assertEquals(fake.inserts.length, 0);
  }
  assertEquals(overCreditLimit(99_900_00, "voucher_200", LIMIT), true);
  assertEquals(overCreditLimit(99_780_00, "voucher_200", LIMIT), false);
});

Deno.test("Credits Limit: landing exactly on the limit sells; a place's own limit binds; no limit refuses", async () => {
  // MX$220 of credit lands exactly on the limit: allowed (over, not at).
  assertEquals(overCreditLimit(LIMIT - 220_00, "voucher_200", LIMIT), false);
  assertEquals(overCreditLimit(LIMIT - 219_00, "voucher_200", LIMIT), true);
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
  // USD: US$20 Small gives US$22 of credit against US$10,000.
  assertEquals(overCreditLimit(10_000_00 - 22_00, "voucher_200", 10_000_00, "usd"), false);
  assertEquals(overCreditLimit(10_000_00 - 21_00, "voucher_200", 10_000_00, "usd"), true);
});

Deno.test("the mark (MESITA-3408) is taken before Welcome-used and the pause, so it matches the list rows", () => {
  // Pay by phone off, so only the voucher can light the mark.
  const onlyWelcome: PaymentSettings = { ...ALL_ON, pay_cards: false, voucher_200: false, voucher_1000: false, voucher_5000: false, voucher_vip: false };
  const used = offerFrom({ ...base, settings: onlyWelcome, welcomeUsed: true });
  assertEquals(used.sell, []);
  assertEquals(used.mesita_pay, true);
  assertEquals(offerFrom({ ...base, settings: onlyWelcome, paused: true }).mesita_pay, true);
  // Nothing on: no mark.
  const nothing: PaymentSettings = { ...onlyWelcome, voucher_welcome: false };
  assertEquals(offerFrom({ ...base, settings: nothing }).mesita_pay, false);
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
  assertEquals(parseBasket({ items: [{ voucher: "voucher_welcome", qty: 1 }] }).ok, true);
  assertEquals(parseBasket({ items: [{ voucher: "voucher_vip", qty: 2 }] }).ok, false);
  assertEquals(parseBasket({ items: [{ voucher: "voucher_200", qty: 1 }, { voucher: "voucher_200", qty: 1 }] }).ok, false);
  assertEquals(parseBasket({ items: [{ voucher: "nope", qty: 1 }] }).ok, false);
});

Deno.test("basketUnits: one unit per row, Welcome then VIP leads; sameUnits compares baskets as multisets", () => {
  const units = basketUnits([{ voucher: "voucher_200", qty: 2 }, { voucher: "voucher_vip", qty: 1 }, { voucher: "voucher_1000", qty: 1 }]);
  assertEquals(units, ["voucher_vip", "voucher_200", "voucher_200", "voucher_1000"]);
  // Welcome leads, then VIP, then the sizes (MESITA-4645).
  const both = basketUnits([{ voucher: "voucher_vip", qty: 1 }, { voucher: "voucher_200", qty: 1 }, { voucher: "voucher_welcome", qty: 1 }]);
  assertEquals(both, ["voucher_welcome", "voucher_vip", "voucher_200"]);
  assertEquals(sameUnits(["voucher_200", "voucher_1000"], ["voucher_1000", "voucher_200"]), true);
  assertEquals(sameUnits(["voucher_200"], ["voucher_200", "voucher_200"]), false);
  assertEquals(sameUnits([], []), true);
});

Deno.test("the Credits Limit counts the whole basket's credit", () => {
  // 2× Small (MX$220 credit each) + Medium (MX$1,200): MX$1,640.
  const basket = ["voucher_200", "voucher_200", "voucher_1000"] as const;
  assertEquals(overCreditLimit(LIMIT - 1_640_00, basket, LIMIT), false);
  assertEquals(overCreditLimit(LIMIT - 1_639_00, basket, LIMIT), true);
});

Deno.test("a basket's rows: the lead under the request_id, one follower row per other unit pointing to it, no request_id", async () => {
  const fake = fakeAdmin({});
  const r = await openPurchaseRow(fake.admin, { ...BUY, followers: ["voucher_200", "voucher_1000"] });
  assertEquals(r, { ok: true, duplicate: false, purchaseId: ROW });
  assertEquals(fake.inserts.length, 2);
  assertEquals(fake.inserts[0].request_id, REQUEST);
  const followers = fake.inserts[1] as unknown as Array<Record<string, unknown>>;
  assertEquals(followers.map((f) => [f.voucher, f.amount_cents, f.bonus_cents, f.basket_lead_id, f.status, "request_id" in f]), [
    ["voucher_200", 20000, 2000, ROW, "opening", false],
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
    amount_cents: "20000",
    bonus_cents: "2000",
  });
  const many = voucherMetadata({ purchaseId: ROW, placeId: PLACE, consumerId: GUEST, voucher: "voucher_200", followers: ["voucher_200", "voucher_1000"] });
  assertEquals(many.purchase_id, ROW);
  assertEquals(many.amount_cents, "140000");
  assertEquals(many.bonus_cents, "24000");
  assertEquals(many.basket, "3");
  assertEquals(many.basket_items, "voucher_200x2,voucher_1000x1");
});

// MESITA-4207: the list rows' chips drop what THIS guest already used, by
// the same rule as the place screen's Offers (offerFrom).
Deno.test("list rows: guestSell drops Welcome used here and a per-visit voucher spent this visit, like offerFrom", () => {
  const sell = ["voucher_welcome", "voucher_200", "voucher_1000", "voucher_5000", "voucher_vip"] as const;
  const vipOn = { ...base, settings: { ...ALL_ON, voucher_vip: true } };
  const blocks = guestBlocksFrom(
    [
      { place_id: "a", voucher: "voucher_story" },
      { place_id: "e", voucher: "voucher_welcome" },
      { place_id: "b", voucher: "voucher_vip" },
      { place_id: "c", voucher: "voucher_vip" },
      { place_id: "c", voucher: "voucher_vip" },
    ],
    [{ place_id: "c" }, { place_id: "d" }],
  );
  // a: a Story bought before MESITA-4642 blocks nothing.
  assertEquals(guestSell(sell, blocks.get("a")), [...sell]);
  // b: one VIP, no visit yet: spent until the guest pays a bill here.
  assertEquals(guestSell(sell, blocks.get("b")), ["voucher_welcome", "voucher_200", "voucher_1000", "voucher_5000"]);
  // e: Welcome bought here; VIP still open (no VIP bought).
  assertEquals(guestSell(sell, blocks.get("e")), ["voucher_200", "voucher_1000", "voucher_5000", "voucher_vip"]);
  // c: two VIPs, one visit: spent.
  assertEquals(blocks.get("c")?.perVisitUsed.voucher_vip, true);
  // d: a visit and no purchase: nothing blocked, no entry.
  assertEquals(blocks.has("d"), false);
  assertEquals(guestSell(sell, blocks.get("d")), [...sell]);
  // Same answer as the place screen's offer for every place.
  for (const id of ["a", "b", "c", "d", "e"]) {
    const g = blocks.get(id);
    const o = offerFrom({ ...vipOn, welcomeUsed: g?.welcomeUsed ?? false, perVisitUsed: g?.perVisitUsed });
    assertEquals(guestSell(sell, g), o.sell);
  }
});

Deno.test("list rows: one VIP per visit opens again after a visit (MESITA-3463, MESITA-4207)", () => {
  const blocks = guestBlocksFrom([{ place_id: "p", voucher: "voucher_vip" }], [{ place_id: "p" }]);
  assertEquals(blocks.get("p"), { welcomeUsed: false, perVisitUsed: { voucher_vip: false } });
  assertEquals(guestSell(["voucher_vip"], blocks.get("p")), ["voucher_vip"]);
});
